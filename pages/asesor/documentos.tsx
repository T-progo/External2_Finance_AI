import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { Documento } from '@/types';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import FilterBar, { Filter } from '@/components/FilterBar';
import DocumentViewer from '@/components/DocumentViewer';
import toast from 'react-hot-toast';

export default function AsesorDocumentos() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<any | null>(null);
  const [mostrarVisor, setMostrarVisor] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const loadDocuments = useCallback(async () => {
    try {
      setLoadingData(true);

      // Get advisor's assigned clients
      const { data: assignedClients, error: clientError } = await supabase
        .from('asesor_cliente')
        .select('cliente_id, clientes(*)')
        .eq('asesor_id', user?.id);

      if (clientError) throw clientError;

      const clientIds = assignedClients?.map(ac => ac.cliente_id) || [];
      setClientes(assignedClients?.map(ac => ac.clientes) || []);

      // Get all documents from assigned clients
      const { data: docs, error: docsError } = await supabase
        .from('documentos')
        .select('*, clientes(razon_social, nombre_comercial)')
        .in('cliente_id', clientIds)
        .order('fecha_subida', { ascending: false });

      if (docsError) throw docsError;

      setDocumentos(docs || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'asesor')) {
      router.push('/');
    }
    if (user && user.rol === 'asesor') {
      loadDocuments();
    }
  }, [user, loading, router, loadDocuments]);

  const filterConfig: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'Nombre documento, cliente...',
    },
    {
      key: 'cliente',
      label: 'Cliente',
      type: 'select',
      options: clientes.map((c: any) => ({ value: c.id, label: c.razon_social })),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'emitida_pdf', label: 'Factura Emitida (PDF)' },
        { value: 'recibida_pdf', label: 'Factura Recibida (PDF)' },
        { value: 'emitida_excel', label: 'Factura Emitida (Excel)' },
        { value: 'recibida_excel', label: 'Factura Recibida (Excel)' },
        { value: 'otro', label: 'Otro' },
      ],
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'procesado_ia', label: 'Procesado IA' },
        { value: 'validado', label: 'Validado' },
        { value: 'contabilizado', label: 'Contabilizado' },
        { value: 'incidencia', label: 'Con Incidencia' },
      ],
    },
  ];

  const documentosFiltrados = documentos.filter(doc => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      const clienteNombre = doc.clientes?.razon_social || doc.clientes?.nombre_comercial || '';
      if (!doc.nombre.toLowerCase().includes(busqueda) && 
          !clienteNombre.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.cliente && doc.cliente_id !== filtros.cliente) return false;
    if (filtros.tipo && doc.tipo !== filtros.tipo) return false;
    if (filtros.estado && doc.estado !== filtros.estado) return false;
    return true;
  });

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros({ ...filtros, [key]: value });
  };

  const handleLimpiarFiltros = () => {
    setFiltros({});
  };

  const handleVerDocumento = (doc: Documento) => {
    setDocumentoSeleccionado(doc);
    setMostrarVisor(true);
  };

  const handleValidarDocumento = async (doc: any) => {
    try {
      const { error } = await supabase
        .from('documentos')
        .update({ estado: 'validado' })
        .eq('id', doc.id);

      if (error) throw error;

      toast.success(`Documento ${doc.nombre} validado correctamente`);
      loadDocuments(); // Reload to show updated status
    } catch (error) {
      console.error('Error validating document:', error);
      toast.error('Error al validar documento');
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-asesor mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando documentos...</p>
        </div>
      </div>
    );
  }

  const estadisticas = {
    total: documentos.length,
    pendientes: documentos.filter(d => d.estado === 'pendiente').length,
    procesadosIA: documentos.filter(d => d.estado === 'procesado_ia').length,
    validados: documentos.filter(d => d.estado === 'validado').length,
    contabilizados: documentos.filter(d => d.estado === 'contabilizado').length,
  };

  return (
    <Layout rol="asesor">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documentos</h1>
          <p className="text-gray-600 mt-1">Gestión, clasificación y validación de documentos</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{estadisticas.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{estadisticas.pendientes}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Procesados IA</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{estadisticas.procesadosIA}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Validados</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{estadisticas.validados}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Contabilizados</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticas.contabilizados}</div>
          </div>
        </div>

        <FilterBar
          filters={filterConfig}
          values={filtros}
          onChange={handleFiltroChange}
          onClear={handleLimpiarFiltros}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documentosFiltrados.map(doc => {
            const clienteNombre = doc.clientes?.nombre_comercial || doc.clientes?.razon_social || 'Cliente';
            return (
              <div
                key={doc.id}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleVerDocumento(doc)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{doc.nombre}</h3>
                    <p className="text-sm text-gray-600">{clienteNombre}</p>
                  </div>
                  <div className="text-2xl">📄</div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium text-gray-900">
                      {doc.tipo === 'emitida_pdf' ? '📤 Emitida (PDF)' : 
                       doc.tipo === 'recibida_pdf' ? '📥 Recibida (PDF)' :
                       doc.tipo === 'emitida_excel' ? '� Emitida (Excel)' :
                       doc.tipo === 'recibida_excel' ? '� Recibida (Excel)' : '📄 Otro'}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Estado:</span>
                    <span className={`badge text-xs ${
                      doc.estado === 'contabilizado' ? 'badge-success' :
                      doc.estado === 'validado' ? 'badge-success' :
                      doc.estado === 'procesado_ia' ? 'badge-info' :
                      doc.estado === 'incidencia' ? 'badge-danger' :
                      'badge-warning'
                    }`}>
                      {doc.estado === 'pendiente' ? '🟡 Pendiente' :
                       doc.estado === 'procesado_ia' ? '🧠 Procesado IA' :
                       doc.estado === 'validado' ? '✅ Validado' :
                       doc.estado === 'contabilizado' ? '📘 Contabilizado' :
                       doc.estado === 'incidencia' ? '⚠️ Incidencia' : doc.estado}
                    </span>
                  </div>

                  {doc.datos_ia && doc.datos_ia.nivelConfianza && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Confianza IA:</span>
                      <span className={`font-medium ${
                        doc.datos_ia.nivelConfianza >= 95 ? 'text-green-600' :
                        doc.datos_ia.nivelConfianza >= 80 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {doc.datos_ia.nivelConfianza.toFixed(0)}%
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subido:</span>
                    <span className="text-gray-900">
                      {new Date(doc.fecha_subida).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVerDocumento(doc);
                    }}
                    className="btn btn-sm btn-asesor flex-1"
                  >
                    👁️ Ver
                  </button>
                  {(doc.estado === 'procesado_ia' || doc.estado === 'pendiente') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleValidarDocumento(doc);
                      }}
                      className="btn btn-sm btn-success flex-1"
                    >
                      ✓ Validar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {mostrarVisor && documentoSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{documentoSeleccionado.nombre}</h2>
                  <p className="text-gray-600">
                    {documentoSeleccionado.clientes?.nombre_comercial || documentoSeleccionado.clientes?.razon_social}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMostrarVisor(false);
                    setDocumentoSeleccionado(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <DocumentViewer documento={documentoSeleccionado} />
                
                <div className="mt-6 flex space-x-3">
                  {(documentoSeleccionado.estado === 'procesado_ia' || documentoSeleccionado.estado === 'pendiente') && (
                    <>
                      <button
                        onClick={() => handleValidarDocumento(documentoSeleccionado)}
                        className="btn btn-success"
                      >
                        ✓ Validar Documento
                      </button>
                      <button className="btn btn-warning">
                        ⚠️ Crear Incidencia
                      </button>
                    </>
                  )}
                  <button className="btn btn-secondary">
                    ⬇️ Descargar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
