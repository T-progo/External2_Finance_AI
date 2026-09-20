import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { getClientes, uploadDocumentoFinanciero, getDocumentosFinancieros } from '@/lib/supabaseService';
import { useAuth } from '@/lib/authContext';
import type { Cliente, DocumentoFinanciero } from '@/types';
import toast from 'react-hot-toast';

export default function AsesorPanelFinanciero() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [documentos, setDocumentos] = useState<DocumentoFinanciero[]>([]);
  const [filtroCliente, setFiltroCliente] = useState<string>('');

  // Form state
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [clienteFormulario, setClienteFormulario] = useState<string>('');

  const fetchClientes = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getClientes(user.id);
      setClientes(data);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchDocumentos = useCallback(async () => {
    if (!user?.id || clientes.length === 0) return;
    try {
      // Fetch documents for all clients assigned to this advisor using API route
      const allDocs: DocumentoFinanciero[] = [];
      for (const cliente of clientes) {
        try {
          const response = await fetch(`/api/financial/get-documents?clienteId=${cliente.id}`);
          if (response.ok) {
            const data = await response.json();
            const docs = data.map((doc: any) => ({
              ...doc,
              fechaSubida: new Date(doc.fechaSubida),
            }));
            allDocs.push(...docs);
          } else {
            // Fallback to direct query
            try {
              const docs = await getDocumentosFinancieros(cliente.id);
              allDocs.push(...docs);
            } catch (fallbackError) {
              console.error(`Error fetching documents for cliente ${cliente.id}:`, fallbackError);
            }
          }
        } catch (error) {
          console.error(`Error fetching documents for cliente ${cliente.id}:`, error);
          // Fallback to direct query
          try {
            const docs = await getDocumentosFinancieros(cliente.id);
            allDocs.push(...docs);
          } catch (fallbackError) {
            console.error(`Fallback also failed for cliente ${cliente.id}:`, fallbackError);
          }
        }
      }
      // Sort by date, newest first
      allDocs.sort((a, b) => b.fechaSubida.getTime() - a.fechaSubida.getTime());
      setDocumentos(allDocs);
      console.log(`[AsesorPanelFinanciero] Loaded ${allDocs.length} documents total`);
    } catch (error) {
      console.error('Error fetching documentos:', error);
    }
  }, [user?.id, clientes]);

  useEffect(() => {
    fetchClientes();
  }, [user, fetchClientes]);

  useEffect(() => {
    if (clientes.length > 0) {
      fetchDocumentos();
    }
  }, [clientes, fetchDocumentos]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArchivoSeleccionado(e.target.files[0]);
    }
  };

  const handleSubirDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoSeleccionado || !clienteFormulario || !user?.id) {
      toast.error('Por favor, selecciona un cliente y un archivo');
      return;
    }

    setSubiendo(true);
    try {
      // Use default values: 'otro_financiero' for type and current year-month for period
      const currentDate = new Date();
      const defaultPeriodo = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      await uploadDocumentoFinanciero(
        archivoSeleccionado,
        clienteFormulario,
        user.id,
        'otro_financiero',
        defaultPeriodo
      );

      // Reset form
      setArchivoSeleccionado(null);
      setClienteFormulario('');
      setMostrarFormulario(false);
      
      // Refresh documents list
      await fetchDocumentos();
      
      toast.success('Documento subido correctamente');
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Error al subir el documento');
    } finally {
      setSubiendo(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getTipoNombre = (tipo: string) => {
    const tipos: Record<string, string> = {
      pyg: 'PyG (Pérdidas y Ganancias)',
      balance: 'Balance de Situación',
      mayor: 'Libro Mayor',
      extracto: 'Extracto Bancario',
      excel: 'Excel Financiero',
      otro_financiero: 'Otro Documento',
    };
    return tipos[tipo] || tipo;
  };

  const documentosFiltrados = filtroCliente
    ? documentos.filter(doc => doc.clienteId === filtroCliente)
    : documentos;

  const getClienteNombre = (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente?.razonSocial || 'Cliente desconocido';
  };


  if (loading) {
    return (
      <Layout rol="asesor">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-asesor mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="asesor">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel Financiero</h1>
            <p className="text-gray-600 mt-1">Subir documentos financieros para tus clientes</p>
          </div>
          <button
            onClick={() => setMostrarFormulario(true)}
            className="btn btn-asesor"
          >
            📤 Subir Documento
          </button>
        </div>

        {/* Filter by Client */}
        {clientes.length > 0 && (
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Cliente:
            </label>
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="input w-full"
            >
              <option value="">Todos los clientes</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.razonSocial}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Documents List */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Documentos Financieros ({documentosFiltrados.length})
          </h2>
          
          {documentosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay documentos financieros
              </h3>
              <p className="text-gray-600 mb-4">
                {filtroCliente 
                  ? 'No hay documentos para este cliente. Sube el primer documento financiero.'
                  : 'No hay documentos financieros subidos. Haz clic en "Subir Documento" para comenzar.'}
              </p>
              <button
                onClick={() => setMostrarFormulario(true)}
                className="btn btn-asesor"
              >
                📤 Subir Documento
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {documentosFiltrados.map(doc => (
                <div
                  key={doc.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-2xl">📄</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{doc.nombre}</h3>
                          <p className="text-sm text-gray-600">
                            {getClienteNombre(doc.clienteId)} • {getTipoNombre(doc.tipo)} • {doc.periodo}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatFileSize(doc.tamaño)}</span>
                        <span>{doc.fechaSubida.toLocaleDateString('es-ES')}</span>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <a
                        href={doc.urlArchivo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        👁️ Ver
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {mostrarFormulario && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  Subir Documento Financiero
                </h2>
                <button
                  onClick={() => {
                    setMostrarFormulario(false);
                    setArchivoSeleccionado(null);
                    setClienteFormulario('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubirDocumento} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente: *
                  </label>
                  <select
                    value={clienteFormulario}
                    onChange={(e) => setClienteFormulario(e.target.value)}
                    className="input w-full"
                    required
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.razonSocial}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Archivo: *
                  </label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.xlsx,.xls,.csv"
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-asesor file:text-white
                      hover:file:bg-asesor-dark
                      cursor-pointer"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formatos soportados: PDF, Excel (xlsx, xls), CSV
                  </p>
                </div>

                {archivoSeleccionado && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-700">
                      <strong>Archivo seleccionado:</strong> {archivoSeleccionado.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(archivoSeleccionado.size)}
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setArchivoSeleccionado(null);
                      setClienteFormulario('');
                    }}
                    className="btn btn-secondary flex-1"
                    disabled={subiendo}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-asesor flex-1"
                    disabled={subiendo || !archivoSeleccionado || !clienteFormulario}
                  >
                    {subiendo ? '⏳ Subiendo...' : '📤 Subir Documento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
