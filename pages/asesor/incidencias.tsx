import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { Incidencia } from '@/types';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import FilterBar, { Filter } from '@/components/FilterBar';
import IncidentChat from '@/components/IncidentChat';
import DocumentViewer from '@/components/DocumentViewer';
import Dialog from '@/components/Dialog';
import toast from 'react-hot-toast';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default function AsesorIncidencias() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [clientesAsignados, setClientesAsignados] = useState<any[]>([]);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState<any | null>(null);
  const [mostrarChat, setMostrarChat] = useState(false);
  const [mostrarNuevaIncidencia, setMostrarNuevaIncidencia] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);
  const [vistaActual, setVistaActual] = useState<'clientes' | 'incidencias'>('clientes');
  
  // Form state for new incident
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [selectedDocumentoId, setSelectedDocumentoId] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [documentosDisponibles, setDocumentosDisponibles] = useState<any[]>([]);

  // Define handleMessageAdded before it's used in useEffect
  const handleMessageAdded = useCallback((nuevoMensaje: any) => {
    // Update the selected incident with the new message
    if (incidenciaSeleccionada) {
      // Check if message already exists to prevent duplicates
      const messageExists = incidenciaSeleccionada.mensajes?.some(
        (msg: any) => msg.id === nuevoMensaje.id
      );

      if (messageExists) {
        console.log('Message already exists, skipping:', nuevoMensaje.id);
        return;
      }

      const updatedIncidencia = {
        ...incidenciaSeleccionada,
        mensajes: [...(incidenciaSeleccionada.mensajes || []), nuevoMensaje],
        fechaUltimaRespuesta: nuevoMensaje.fecha,
      };
      setIncidenciaSeleccionada(updatedIncidencia);

      // Also update the incident in the main list
      setIncidencias(prevIncidencias =>
        prevIncidencias.map(inc =>
          inc.id === incidenciaSeleccionada.id
            ? updatedIncidencia
            : inc
        )
      );
    }
  }, [incidenciaSeleccionada]);

  // Load documents when client is selected
  useEffect(() => {
    if (selectedClienteId) {
      loadDocumentosByCliente(selectedClienteId);
    } else {
      setDocumentosDisponibles([]);
    }
  }, [selectedClienteId]);

  // Reset form when modal is closed (but keep selected client if viewing client-specific view)
  useEffect(() => {
    if (!mostrarNuevaIncidencia) {
      // Only reset client selection if not in client-specific view
      if (vistaActual !== 'incidencias') {
        setSelectedClienteId('');
      }
      setSelectedDocumentoId('');
      setDescripcion('');
      setDocumentosDisponibles([]);
    }
  }, [mostrarNuevaIncidencia, vistaActual]);

  // Pre-select client when opening new incident form from client-specific view
  useEffect(() => {
    if (mostrarNuevaIncidencia && vistaActual === 'incidencias' && clienteSeleccionado) {
      setSelectedClienteId(clienteSeleccionado);
    }
  }, [mostrarNuevaIncidencia, vistaActual, clienteSeleccionado]);

  // Real-time subscription for messages when viewing an incident
  useEffect(() => {
    if (!incidenciaSeleccionada?.id) return;

    console.log('🔌 Setting up real-time subscription for incident:', incidenciaSeleccionada.id);

    // Subscribe to new messages for this incident
    const channel = supabase
      .channel(`incidencia-${incidenciaSeleccionada.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_incidencia',
          filter: `incidencia_id=eq.${incidenciaSeleccionada.id}`,
        },
        async (payload) => {
          console.log('📨 New message received via real-time:', payload);
          
          // Transform the new message to match the expected format
          const newMessage = {
            id: payload.new.id,
            usuarioId: payload.new.usuario_id,
            mensaje: payload.new.mensaje,
            rol: payload.new.rol,
            fecha: new Date(payload.new.fecha),
            archivosAdjuntos: payload.new.archivos_adjuntos || [],
            esIA: payload.new.es_ia || false,
          };

          // Only add message from other users (current user's messages are added via onMessageAdded callback)
          if (newMessage.usuarioId !== user?.id) {
            console.log('✅ Adding message from other user');
            handleMessageAdded(newMessage);
          } else {
            console.log('⏭️ Skipping own message (already added via callback)');
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active');
        }
        if (err) {
          console.error('❌ Real-time subscription error:', err);
          toast.error('Error al conectar chat en tiempo real');
        }
      });

    // Cleanup subscription on unmount or when incident changes
    return () => {
      console.log('🔌 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [incidenciaSeleccionada?.id, user?.id, handleMessageAdded]);

  const loadIncidencias = useCallback(async () => {
    try {
      setLoadingData(true);

      // Get advisor's assigned clients
      const { data: assignedClients, error: clientError } = await supabaseAdmin
        .from('asesor_cliente')
        .select('cliente_id, clientes(id, razon_social, nombre_comercial)')
        .eq('asesor_id', user?.id);

      if (clientError) throw clientError;

      const clientes = assignedClients?.map(ac => ac.clientes).filter(Boolean) || [];
      const clientIds = assignedClients?.map(ac => ac.cliente_id) || [];
      setClientesAsignados(clientes);

      // Get incidents for these clients
      const { data: incidents, error: incidentsError } = await supabaseAdmin
        .from('incidencias')
        .select(`
          *,
          clientes(id, razon_social, nombre_comercial),
          documentos(id, nombre, tipo, estado, fecha_subida, procesado_ia, tamanio, url_archivo, nro_asiento_erp, datos_ia, cliente_id, asesor_id),
          mensajes_incidencia(
            id,
            usuario_id,
            mensaje,
            rol,
            fecha
          )
        `)
        .in('cliente_id', clientIds)
        .order('fecha_creacion', { ascending: false });

      if (incidentsError) throw incidentsError;

      // Transform data to match expected format
      const transformedIncidents = incidents?.map(inc => ({
        id: inc.id,
        documentoId: inc.documento_id,
        clienteId: inc.cliente_id,
        asesorId: inc.asesor_id,
        estado: inc.estado,
        origen: inc.origen,
        fechaCreacion: inc.fecha_creacion,
        fechaUltimaRespuesta: inc.fecha_ultima_respuesta,
        cliente: inc.clientes,
        documento: inc.documentos ? {
          id: inc.documentos.id,
          nombre: inc.documentos.nombre,
          clienteId: inc.documentos.cliente_id,
          asesorId: inc.documentos.asesor_id,
          tipo: inc.documentos.tipo,
          estado: inc.documentos.estado,
          fechaSubida: new Date(inc.documentos.fecha_subida),
          procesadoIA: inc.documentos.procesado_ia,
          tamaño: inc.documentos.tamanio,
          urlArchivo: inc.documentos.url_archivo,
          nroAsientoERP: inc.documentos.nro_asiento_erp,
          datosIA: inc.documentos.datos_ia,
        } : null,
        mensajes: inc.mensajes_incidencia?.map((msg: any) => ({
          id: msg.id,
          usuarioId: msg.usuario_id,
          mensaje: msg.mensaje,
          rol: msg.rol,
          fecha: msg.fecha,
          archivosAdjuntos: msg.archivos_adjuntos || [],
          esIA: msg.es_ia || false,
        })) || [],
      })) || [];

      setIncidencias(transformedIncidents);
    } catch (error) {
      console.error('Error loading incidents:', error);
      toast.error('Error al cargar incidencias');
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  // Real-time subscription for incident updates in the list
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔌 Setting up real-time subscription for incidents list');

    // Subscribe to incidencias updates (status changes, new incidents)
    const incidenciasChannel = supabase
      .channel(`asesor-incidencias-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidencias',
        },
        async () => {
          console.log('📊 Incidencias list updated, refreshing...');
          await loadIncidencias();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Incidencias list subscription active');
        }
        if (err) {
          console.error('❌ Incidencias list subscription error:', err);
        }
      });

    // Cleanup subscription
    return () => {
      console.log('🔌 Cleaning up incidencias list subscription');
      supabase.removeChannel(incidenciasChannel);
    };
  }, [user?.id, loadIncidencias]);

  // Load data on mount
  useEffect(() => {
    if (!loading && (!user || user.rol !== 'asesor')) {
      router.push('/');
    }
    if (user && user.rol === 'asesor') {
      loadIncidencias();
    }
  }, [user, loading, router, loadIncidencias]);

  const loadDocumentosByCliente = async (clienteId: string) => {
    try {
      const { data: docs, error } = await supabaseAdmin
        .from('documentos')
        .select('id, nombre')
        .eq('cliente_id', clienteId)
        .order('fecha_subida', { ascending: false });

      if (error) throw error;
      setDocumentosDisponibles(docs || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Error al cargar documentos');
    }
  };

  const filterConfig: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'ID incidencia, cliente...',
    },
    {
      key: 'cliente',
      label: 'Cliente',
      type: 'select',
      options: clientesAsignados.map((c: any) => ({ value: c.id, label: c.razon_social })),
    },
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
  ];

  const incidenciasFiltradas = incidencias.filter(inc => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      const idStr = inc.id?.toString().toLowerCase() || '';
      const razonSocial = inc.cliente?.razon_social?.toLowerCase() || '';
      if (!idStr.includes(busqueda) && !razonSocial.includes(busqueda)) {
        return false;
      }
    }
    if (filtros.cliente && inc.clienteId !== filtros.cliente) return false;
    if (filtros.estado && inc.estado !== filtros.estado) return false;
    return true;
  });

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros({ ...filtros, [key]: value });
  };

  const handleLimpiarFiltros = () => {
    setFiltros({});
  };

  const handleVerIncidencia = (inc: any) => {
    setIncidenciaSeleccionada(inc);
    setMostrarChat(true);
  };

  const estadisticas = {
    total: incidencias.length,
    nuevas: incidencias.filter(i => i.estado === 'nueva').length,
    enRevision: incidencias.filter(i => i.estado === 'en_revision').length,
    resueltas: incidencias.filter(i => i.estado === 'resuelta').length,
  };

  // Calculate incident stats per client
  interface ClienteStats {
    cliente: any;
    totalIncidencias: number;
    nuevas: number;
    enRevision: number;
    resueltas: number;
    ultimaIncidencia?: Date;
  }

  const getClienteStats = (): ClienteStats[] => {
    const statsMap = new Map<string, ClienteStats>();

    // Initialize stats for all clients
    clientesAsignados.forEach((cliente) => {
      statsMap.set(cliente.id, {
        cliente,
        totalIncidencias: 0,
        nuevas: 0,
        enRevision: 0,
        resueltas: 0,
      });
    });

    // Count incidents by client
    incidencias.forEach((inc) => {
      const stats = statsMap.get(inc.clienteId);
      if (stats) {
        stats.totalIncidencias++;
        if (inc.estado === 'nueva') {
          stats.nuevas++;
        } else if (inc.estado === 'en_revision') {
          stats.enRevision++;
        } else if (inc.estado === 'resuelta') {
          stats.resueltas++;
        }
        const incDate = new Date(inc.fechaCreacion);
        if (!stats.ultimaIncidencia || incDate > stats.ultimaIncidencia) {
          stats.ultimaIncidencia = incDate;
        }
      }
    });

    // Convert to array and sort by pending incidents first
    return Array.from(statsMap.values())
      .sort((a, b) => {
        // Sort by new + in_revision incidents first (descending), then by total
        const aPendientes = a.nuevas + a.enRevision;
        const bPendientes = b.nuevas + b.enRevision;
        if (bPendientes !== aPendientes) {
          return bPendientes - aPendientes;
        }
        return b.totalIncidencias - a.totalIncidencias;
      });
  };

  const handleClienteClick = (clienteId: string) => {
    setClienteSeleccionado(clienteId);
    setVistaActual('incidencias');
  };

  const handleVolverAClientes = () => {
    setClienteSeleccionado(null);
    setVistaActual('clientes');
  };

  const getIncidenciasDelCliente = (clienteId: string): any[] => {
    return incidencias
      .filter((inc) => inc.clienteId === clienteId)
      .sort((a, b) => {
        // Sort by status priority (nueva > en_revision > resuelta)
        const statusPriority: any = { nueva: 0, en_revision: 1, resuelta: 2, cerrada: 3 };
        const aPriority = statusPriority[a.estado] ?? 999;
        const bPriority = statusPriority[b.estado] ?? 999;
        if (aPriority !== bPriority) return aPriority - bPriority;
        // Then by date (most recent first)
        return new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime();
      });
  };

  const getClienteById = (id: string): any | undefined => {
    return clientesAsignados.find(c => c.id === id);
  };

  const clienteStats = getClienteStats();

  return (
    <Layout rol="asesor">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Incidencias</h1>
            <p className="text-gray-600 mt-1">Gestión de incidencias por cliente</p>
          </div>
          <button
            onClick={() => setMostrarNuevaIncidencia(true)}
            className="btn btn-asesor"
          >
            + Nueva Incidencia
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>

        {vistaActual === 'clientes' ? (
          // Client cards view
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingData ? (
              <div className="col-span-full text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <p className="mt-4 text-gray-600">Cargando incidencias...</p>
              </div>
            ) : clienteStats.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No tienes clientes asignados
                </h3>
                <p className="text-gray-600">
                  No hay clientes asignados a tu cuenta.
                </p>
              </div>
            ) : (
              clienteStats.map((stats) => {
                const iniciales = stats.cliente.razon_social
                  .split(' ')
                  .map((palabra: string) => palabra[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={stats.cliente.id}
                    className="card hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleClienteClick(stats.cliente.id)}
                  >
                    <div className="flex items-start space-x-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg">
                        {iniciales}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {stats.cliente.razon_social}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {stats.cliente.nombre_comercial || 'Sin nombre comercial'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Última incidencia</span>
                        <span className="text-sm text-gray-900">
                          {stats.ultimaIncidencia
                            ? `hace ${Math.floor(
                                (Date.now() - stats.ultimaIncidencia.getTime()) /
                                  (1000 * 60 * 60 * 24)
                              )} días`
                            : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {stats.nuevas}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">nuevas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {stats.enRevision}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">en revisión</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {stats.resueltas}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">resueltas</div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClienteClick(stats.cliente.id);
                      }}
                      className="btn btn-sm btn-asesor w-full mt-4"
                    >
                      Ver Incidencias
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // Incidents view for selected client
          <>
            {clienteSeleccionado && (
              <>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handleVolverAClientes}
                      className="btn btn-secondary"
                    >
                      ← Volver a Clientes
                    </button>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {getClienteById(clienteSeleccionado)?.razon_social}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {getIncidenciasDelCliente(clienteSeleccionado).length} incidencias
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMostrarNuevaIncidencia(true)}
                    className="btn btn-asesor"
                  >
                    + Nueva Incidencia
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getIncidenciasDelCliente(clienteSeleccionado).map((inc) => {
                    const cliente = inc.cliente;
                    return (
                      <div
                        key={inc.id}
                        className="card hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleVerIncidencia(inc)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">#{inc.id.substring(0, 8)}</h3>
                            <p className="text-sm text-gray-600">{cliente?.razon_social}</p>
                          </div>
                          <span className={`badge ${
                            inc.estado === 'nueva' ? 'badge-warning' :
                            inc.estado === 'en_revision' ? 'badge-info' :
                            inc.estado === 'resuelta' ? 'badge-success' :
                            'badge-secondary'
                          }`}>
                            {inc.estado === 'nueva' ? '🟡 Nueva' :
                             inc.estado === 'en_revision' ? '🟠 En Revisión' :
                             inc.estado === 'resuelta' ? '🟢 Resuelta' :
                             '⚪ Cerrada'}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Origen:</span>
                            <span className={`badge text-xs ${
                              inc.origen === 'ia' ? 'badge-info' :
                              inc.origen === 'asesor' ? 'badge-asesor' :
                              'badge-warning'
                            }`}>
                              {inc.origen === 'ia' ? '🤖 IA' :
                               inc.origen === 'asesor' ? '👔 Asesor' :
                               '✋ Manual'}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Mensajes:</span>
                            <span className="font-medium text-gray-900">{inc.mensajes.length}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Creada:</span>
                            <span className="text-gray-900">
                              {new Date(inc.fechaCreacion).toLocaleDateString('es-ES')}
                            </span>
                          </div>

                          {inc.fechaUltimaRespuesta && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Última actualización:</span>
                              <span className="text-gray-900">
                                {new Date(inc.fechaUltimaRespuesta).toLocaleDateString('es-ES')}
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerIncidencia(inc);
                          }}
                          className="btn btn-sm btn-asesor w-full mt-4"
                        >
                          💬 Ver Conversación
                        </button>
                      </div>
                    );
                  })}

                  {getIncidenciasDelCliente(clienteSeleccionado).length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <div className="text-6xl mb-4">⚠️</div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No hay incidencias
                      </h3>
                      <p className="text-gray-600">
                        Este cliente no tiene incidencias registradas.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {incidenciaSeleccionada && (
          <Dialog
            isOpen={mostrarChat}
            onClose={() => {
              setMostrarChat(false);
              setIncidenciaSeleccionada(null);
            }}
            maxWidth="5xl"
            customContent
            title={
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">Incidencia #{incidenciaSeleccionada.id?.substring(0, 8)}</h2>
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
                  <span>📄 {incidenciaSeleccionada.documento?.nombre || 'Sin documento'}</span>
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
                  {incidenciaSeleccionada.mensajes?.length || 0} mensaje{(incidenciaSeleccionada.mensajes?.length || 0) !== 1 ? 's' : ''}
                </div>
                <div className="flex space-x-2">
                  {incidenciaSeleccionada.estado !== 'resuelta' && incidenciaSeleccionada.estado !== 'cerrada' && (
                    <button
                      onClick={async () => {
                        try {
                          await supabase
                            .from('incidencias')
                            .update({ estado: 'resuelta' })
                            .eq('id', incidenciaSeleccionada.id);
                          toast.success('Incidencia marcada como resuelta');
                          await loadIncidencias();
                          setMostrarChat(false);
                        } catch (error) {
                          console.error('Error updating incident:', error);
                          toast.error('Error al actualizar la incidencia');
                        }
                      }}
                      className="btn btn-success"
                    >
                      ✓ Marcar como Resuelta
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
                    currentUserRole="asesor"
                    onMessageAdded={handleMessageAdded}
                  />
                </div>
              </div>

              {/* Previsualización del documento */}
              <div className="w-96 border-l border-gray-200">
                {incidenciaSeleccionada.documento ? (
                  <DocumentViewer 
                    documento={incidenciaSeleccionada.documento}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <span className="text-4xl block mb-2">📄</span>
                      Sin documento asociado
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Dialog>
        )}

        <Dialog
          isOpen={mostrarNuevaIncidencia}
          onClose={() => setMostrarNuevaIncidencia(false)}
          title="Nueva Incidencia"
          maxWidth="2xl"
          footer={
            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  // Validation
                  if (!selectedClienteId) {
                    toast.error('Por favor selecciona un cliente');
                    return;
                  }
                  if (!descripcion.trim()) {
                    toast.error('Por favor escribe una descripción');
                    return;
                  }

                  try {
                    // Create incident in database
                    const { data: incidencia, error: incError } = await supabase
                      .from('incidencias')
                      .insert({
                        documento_id: selectedDocumentoId || null,
                        cliente_id: selectedClienteId,
                        asesor_id: user?.id,
                        estado: 'nueva',
                        origen: 'asesor',
                        fecha_creacion: new Date().toISOString(),
                      })
                      .select()
                      .single();

                    if (incError) throw incError;

                    // Create first message
                    const { error: msgError } = await supabase
                      .from('mensajes_incidencia')
                      .insert({
                        incidencia_id: incidencia.id,
                        usuario_id: user?.id,
                        mensaje: descripcion,
                        fecha: new Date().toISOString(),
                      });

                    if (msgError) throw msgError;

                    toast.success('Incidencia creada correctamente');
                    setMostrarNuevaIncidencia(false);
                    loadIncidencias(); // Reload incidents
                  } catch (error) {
                    console.error('Error creating incident:', error);
                    toast.error('Error al crear la incidencia');
                  }
                }}
                className="btn btn-asesor flex-1"
                disabled={!selectedClienteId || !descripcion.trim()}
              >
                Crear Incidencia
              </button>
              <button
                onClick={() => setMostrarNuevaIncidencia(false)}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cliente *</label>
              <select 
                className="input w-full"
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
              >
                <option value="">Seleccione un cliente...</option>
                {clientesAsignados.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.razon_social}</option>
                ))}
              </select>
              {clientesAsignados.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  ⚠️ No tienes clientes asignados
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Documento (opcional)</label>
              <select 
                className="input w-full"
                value={selectedDocumentoId}
                onChange={(e) => setSelectedDocumentoId(e.target.value)}
                disabled={!selectedClienteId}
              >
                <option value="">Sin documento relacionado</option>
                {documentosDisponibles.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
              {selectedClienteId && documentosDisponibles.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Este cliente no tiene documentos cargados
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descripción *</label>
              <textarea
                className="input w-full"
                rows={5}
                placeholder="Describe la incidencia..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              ></textarea>
            </div>
          </div>
        </Dialog>
      </div>
    </Layout>
  );
}
