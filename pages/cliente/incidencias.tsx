import { useState, useMemo, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Incidencia, Documento, MensajeIncidencia } from '@/types';
import { getIncidencias, getDocumentos, getClienteIdByUserId, updateIncidencia } from '@/lib/supabaseService';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import IncidentChat from '@/components/IncidentChat';
import DocumentViewer from '@/components/DocumentViewer';
import AINotificationSystem from '@/components/AINotificationSystem';
import FilterBar, { Filter } from '@/components/FilterBar';
import Dialog from '@/components/Dialog';
import toast from 'react-hot-toast';

export default function ClienteIncidencias() {
  const { user } = useAuth();
  
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState<Incidencia | null>(null);
  const [mostrarChat, setMostrarChat] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      setLoadingData(true);
      try {
        const cId = await getClienteIdByUserId(user.id);
        if (!cId) {
          console.error('No se encontró el cliente para este usuario');
          setLoadingData(false);
          return;
        }
        setClienteId(cId);

        const [incData, docsData] = await Promise.all([
          getIncidencias(cId),
          getDocumentos(cId),
        ]);

        setIncidencias(incData);
        setDocumentos(docsData);
      } catch (error) {
        console.error('Error fetching incidencias:', error);
      } finally {
        setLoadingData(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  // Real-time subscriptions for incidencias and messages
  useEffect(() => {
    if (!clienteId) return;

    // Subscribe to incidencias changes (updates, status changes)
    const incidenciasChannel = supabase
      .channel(`cliente-incidencias-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'incidencias',
          filter: `cliente_id=eq.${clienteId}`,
        },
        async (payload) => {
          // Fetch the updated incidencia with all its messages
          const updatedData = await getIncidencias(clienteId);
          setIncidencias(updatedData);
          
          // Update the selected incidencia if it's the one that changed
          if (incidenciaSeleccionada?.id === payload.new.id) {
            const updatedIncidencia = updatedData.find(inc => inc.id === payload.new.id);
            if (updatedIncidencia) {
              setIncidenciaSeleccionada(updatedIncidencia);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to new messages for all incidencias
    const mensajesChannel = supabase
      .channel(`cliente-mensajes-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_incidencia',
        },
        async (payload) => {
          // Refresh incidencias to get updated message counts
          const updatedData = await getIncidencias(clienteId);
          setIncidencias(updatedData);
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(incidenciasChannel);
      supabase.removeChannel(mensajesChannel);
    };
  }, [clienteId, incidenciaSeleccionada?.id]);

  // Filtros
  const [filtros, setFiltros] = useState<Record<string, any>>({
    estado: '',
    fecha_desde: '',
    fecha_hasta: '',
    documento: '',
  });

  const filtrosConfig: Filter[] = [
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'nueva', label: 'Nueva' },
        { value: 'en_revision', label: 'En Revisión' },
        { value: 'resuelta', label: 'Resuelta' },
        { value: 'cerrada', label: 'Cerrada' },
      ],
    },
    {
      key: 'fecha',
      label: 'Rango de Fechas',
      type: 'daterange',
    },
    {
      key: 'documento',
      label: 'Buscar Documento',
      type: 'text',
      placeholder: 'Nombre del documento...',
    },
  ];

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
  };

  const handleLimpiarFiltros = () => {
    setFiltros({
      estado: '',
      fecha_desde: '',
      fecha_hasta: '',
      documento: '',
    });
  };

  // Aplicar filtros
  const incidenciasFiltradas = useMemo(() => {
    return incidencias.filter(inc => {
      // Filtro por estado
      if (filtros.estado && inc.estado !== filtros.estado) {
        return false;
      }

      // Filtro por rango de fechas
      if (filtros.fecha_desde) {
        const fechaInc = new Date(inc.fechaCreacion);
        const fechaDesde = new Date(filtros.fecha_desde);
        if (fechaInc < fechaDesde) return false;
      }

      if (filtros.fecha_hasta) {
        const fechaInc = new Date(inc.fechaCreacion);
        const fechaHasta = new Date(filtros.fecha_hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        if (fechaInc > fechaHasta) return false;
      }

      // Filtro por documento
      if (filtros.documento) {
        const documento = documentos.find(d => d.id === inc.documentoId);
        if (!documento || !documento.nombre.toLowerCase().includes(filtros.documento.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [incidencias, filtros, documentos]);

  const handleVerIncidencia = (inc: Incidencia) => {
    setIncidenciaSeleccionada(inc);
    setMostrarChat(true);
  };

  const handleCerrarIncidencia = async () => {
    if (!incidenciaSeleccionada) return;
    
    if (incidenciaSeleccionada.estado !== 'resuelta') {
      toast.error('Solo puedes cerrar incidencias que hayan sido marcadas como resueltas por tu asesor.');
      return;
    }

    if (confirm('¿Confirmas que esta incidencia ha sido resuelta satisfactoriamente?')) {
      try {
        await updateIncidencia(incidenciaSeleccionada.id, { estado: 'cerrada' });
        // Update local state
        setIncidencias(prev => prev.map(inc => 
          inc.id === incidenciaSeleccionada.id ? { ...inc, estado: 'cerrada' as any } : inc
        ));
        toast.success('Incidencia cerrada correctamente');
        setMostrarChat(false);
      } catch (error) {
        console.error('Error closing incidencia:', error);
        toast.error('Error al cerrar la incidencia');
      }
    }
  };

  const handleMessageAdded = (mensaje: MensajeIncidencia) => {
    if (!incidenciaSeleccionada) return;
    
    // Update the selected incident with the new message
    setIncidenciaSeleccionada(prev => {
      if (!prev) return null;
      return {
        ...prev,
        mensajes: [...prev.mensajes, mensaje],
        fechaUltimaRespuesta: new Date(),
      };
    });

    // Update the incidents list
    setIncidencias(prev => prev.map(inc => 
      inc.id === incidenciaSeleccionada.id 
        ? { ...inc, mensajes: [...inc.mensajes, mensaje], fechaUltimaRespuesta: new Date() }
        : inc
    ));
  };

  const handleAIIncidenciaUpdated = (incidenciaActualizada: Incidencia) => {
    // Update the incidents list with AI notification
    setIncidencias(prev => prev.map(inc => 
      inc.id === incidenciaActualizada.id ? incidenciaActualizada : inc
    ));

    // If this is the currently selected incident, update it too
    if (incidenciaSeleccionada?.id === incidenciaActualizada.id) {
      setIncidenciaSeleccionada(incidenciaActualizada);
    }
  };

  const estadisticas = {
    total: incidenciasFiltradas.length,
    nuevas: incidenciasFiltradas.filter(i => i.estado === 'nueva').length,
    enRevision: incidenciasFiltradas.filter(i => i.estado === 'en_revision').length,
    resueltas: incidenciasFiltradas.filter(i => i.estado === 'resuelta').length,
    cerradas: incidenciasFiltradas.filter(i => i.estado === 'cerrada').length,
  };

  const getDocumentoNombre = (documentoId: string) => {
    const doc = documentos.find(d => d.id === documentoId);
    return doc?.nombre || 'Documento no disponible';
  };

  if (loadingData) {
    return (
      <Layout rol="cliente">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cliente mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando incidencias...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="cliente">
      {/* AI Notification System */}
      <AINotificationSystem 
        incidencias={incidencias}
        onIncidenciaUpdated={handleAIIncidenciaUpdated}
      />
      
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incidencias</h1>
          <p className="text-gray-600 mt-1">Responde a las incidencias creadas por tu asesor</p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{estadisticas.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Nuevas</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{estadisticas.nuevas}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">En Revisión</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{estadisticas.enRevision}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Resueltas</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticas.resueltas}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Cerradas</div>
            <div className="text-2xl font-bold text-gray-500 mt-1">{estadisticas.cerradas}</div>
          </div>
        </div>

        {/* Filtros */}
        <FilterBar
          filters={filtrosConfig}
          values={filtros}
          onChange={handleFiltroChange}
          onClear={handleLimpiarFiltros}
        />

        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">💬</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Comunicación con tu Asesor</h3>
              <p className="text-sm text-blue-800">
                Tu asesor crea incidencias para comunicarse contigo sobre problemas o dudas relacionadas con tus documentos. 
                Puedes responder directamente en el chat de cada incidencia.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de incidencias */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidenciasFiltradas.map(inc => {
            const documento = documentos.find(d => d.id === inc.documentoId);
            const ultimoMensaje = inc.mensajes[inc.mensajes.length - 1];
            
            return (
              <div
                key={inc.id}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleVerIncidencia(inc)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900">#{inc.id}</h3>
                      <span className={`badge ${
                        inc.estado === 'nueva' ? 'badge-warning' :
                        inc.estado === 'en_revision' ? 'badge-info' :
                        inc.estado === 'resuelta' ? 'badge-success' :
                        'badge-secondary'
                      }`}>
                        {inc.estado === 'nueva' ? '🟡 Nueva' :
                         inc.estado === 'en_revision' ? '🔵 En Revisión' :
                         inc.estado === 'resuelta' ? '🟢 Resuelta' :
                         '⚪ Cerrada'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Creada el {new Date(inc.fechaCreacion).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <span className="text-xl">
                    {inc.origen === 'ia' ? '🤖' :
                     inc.origen === 'asesor' ? '👤' : '📝'}
                  </span>
                </div>

                {/* Documento asociado */}
                <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📄</span>
                    <span className="text-gray-700 truncate">{getDocumentoNombre(inc.documentoId || '')}</span>
                  </div>
                </div>

                {/* Último mensaje */}
                {ultimoMensaje && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-medium text-blue-900">
                        {ultimoMensaje.rol === 'cliente' ? 'Tú' :
                         ultimoMensaje.rol === 'asesor' ? 'Tu Asesor' : 'Sistema IA'}
                      </span>
                      <span className="text-xs text-blue-600">
                        {new Date(ultimoMensaje.fecha).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {ultimoMensaje.mensaje}
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    {inc.mensajes.length} mensaje{inc.mensajes.length !== 1 ? 's' : ''}
                  </span>
                  {inc.fechaUltimaRespuesta && (
                    <span className="text-gray-500 text-xs">
                      Actualizado {new Date(inc.fechaUltimaRespuesta).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVerIncidencia(inc);
                  }}
                  className="btn btn-sm btn-cliente w-full mt-4"
                >
                  💬 Abrir Chat
                </button>
              </div>
            );
          })}

          {incidenciasFiltradas.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {incidencias.length === 0 ? 'No tienes incidencias' : 'No se encontraron incidencias'}
              </h3>
              <p className="text-gray-600">
                {incidencias.length === 0 
                  ? 'Tu asesor no ha creado ninguna incidencia. Cuando tenga alguna pregunta o necesite información, aparecerá aquí.'
                  : 'Intenta ajustar los filtros de búsqueda'}
              </p>
            </div>
          )}
        </div>

        {/* Modal de chat de incidencia */}
        {incidenciaSeleccionada && (
          <Dialog
            isOpen={mostrarChat}
            onClose={() => {
              setMostrarChat(false);
              setIncidenciaSeleccionada(null);
            }}
            maxWidth="5xl"
            customContent
            footerClassName="bg-gray-50"
            title={
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">Incidencia #{incidenciaSeleccionada.id}</h2>
                  <span className={`badge ${
                    incidenciaSeleccionada.estado === 'nueva' ? 'badge-warning' :
                    incidenciaSeleccionada.estado === 'en_revision' ? 'badge-info' :
                    incidenciaSeleccionada.estado === 'resuelta' ? 'badge-success' :
                    'badge-secondary'
                  }`}>
                    {incidenciaSeleccionada.estado === 'nueva' ? '🟡 Nueva' :
                     incidenciaSeleccionada.estado === 'en_revision' ? '🔵 En Revisión' :
                     incidenciaSeleccionada.estado === 'resuelta' ? '🟢 Resuelta' :
                     '⚪ Cerrada'}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>📄 {getDocumentoNombre(incidenciaSeleccionada.documentoId || '')}</span>
                  <span>•</span>
                  <span>Creada el {new Date(incidenciaSeleccionada.fechaCreacion).toLocaleDateString('es-ES')}</span>
                  <span>•</span>
                  <span>
                    Origen: {incidenciaSeleccionada.origen === 'ia' ? '🤖 IA' :
                            incidenciaSeleccionada.origen === 'asesor' ? '👤 Asesor' : '📝 Manual'}
                  </span>
                </div>
              </div>
            }
            footer={
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {incidenciaSeleccionada.estado === 'resuelta' && (
                    <span className="text-green-600 font-medium">
                      ✓ Tu asesor marcó esta incidencia como resuelta
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  {incidenciaSeleccionada.estado === 'resuelta' && (
                    <button
                      onClick={handleCerrarIncidencia}
                      className="btn btn-success"
                    >
                      ✓ Confirmar y Cerrar
                    </button>
                  )}
                  <button
                    onClick={() => setMostrarChat(false)}
                    className="btn btn-secondary"
                  >
                    Cerrar Vista
                  </button>
                </div>
              </div>
            }
          >
            {/* Vista dividida: Chat + Documento */}
            <div className="flex-1 flex overflow-hidden">
              {/* Chat */}
              <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  <IncidentChat 
                    incidencia={incidenciaSeleccionada} 
                    currentUserRole="cliente"
                    onMessageAdded={handleMessageAdded}
                  />
                </div>
              </div>

              {/* Previsualización del documento */}
              <div className="w-96 border-l border-gray-200">
                {(() => {
                  const documento = documentos.find(d => d.id === incidenciaSeleccionada.documentoId);
                  if (!documento) {
                    return (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <span className="text-4xl block mb-2">📄</span>
                          Documento no disponible
                        </div>
                      </div>
                    );
                  }

                  return (
                    <DocumentViewer 
                      documento={documento}
                    />
                  );
                })()}
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}
