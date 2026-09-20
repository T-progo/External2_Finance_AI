import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { getClienteIdByUserId, getDocumentosFinancieros } from '@/lib/supabaseService';
import { useAuth } from '@/lib/authContext';
import type { DocumentoFinanciero } from '@/types';
import { supabase } from '@/lib/supabase';

export default function ClientePanelFinanciero() {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoFinanciero[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch financial documents from Supabase
  const fetchData = useCallback(async () => {
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

      // Fetch advisor-uploaded financial documents via API route
      let docsFinancieros: DocumentoFinanciero[] = [];
      try {
        console.log(`[ClientePanelFinanciero] Fetching documents for clienteId: ${cId}`);
        const response = await fetch(`/api/financial/get-documents?clienteId=${cId}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`[ClientePanelFinanciero] Received ${data.length} documents from API`);
          docsFinancieros = data.map((doc: any) => ({
            ...doc,
            fechaSubida: doc.fechaSubida ? new Date(doc.fechaSubida) : new Date(),
          }));
        } else {
          const errorText = await response.text();
          console.error('[ClientePanelFinanciero] Error fetching financial documents:', errorText);
          // Fallback to direct query
          try {
            docsFinancieros = await getDocumentosFinancieros(cId);
            console.log(`[ClientePanelFinanciero] Fallback query returned ${docsFinancieros.length} documents`);
          } catch (fallbackError) {
            console.error('[ClientePanelFinanciero] Fallback query also failed:', fallbackError);
          }
        }
      } catch (error) {
        console.error('[ClientePanelFinanciero] Error fetching financial documents via API:', error);
        // Fallback to direct query
        try {
          docsFinancieros = await getDocumentosFinancieros(cId);
          console.log(`[ClientePanelFinanciero] Fallback query returned ${docsFinancieros.length} documents`);
        } catch (fallbackError) {
          console.error('[ClientePanelFinanciero] Fallback query also failed:', fallbackError);
        }
      }
      
      console.log(`[ClientePanelFinanciero] Total financial documents: ${docsFinancieros.length}`);

      // Only show advisor-uploaded financial documents
      setDocumentos(docsFinancieros || []);
    } catch (error) {
      console.error('Error fetching financial documents:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id, fetchData]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
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

  if (loadingData) {
    return (
      <Layout rol="cliente">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cliente mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando documentos financieros...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="cliente">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel Financiero</h1>
            <p className="text-gray-600 mt-1">Documentos financieros subidos por tu asesor</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loadingData}
            className="btn btn-cliente"
          >
            {refreshing ? '🔄 Actualizando...' : '🔄 Actualizar'}
          </button>
        </div>

        {/* Documents List */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Documentos Financieros ({documentos.length})
          </h2>
          
          {documentos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay documentos disponibles
              </h3>
              <p className="text-gray-600">
                Tu asesor subirá aquí tus documentos financieros (PyG, balances, extractos, etc.)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documentos.map(doc => {
                const sourceTipo = doc.datosExtraidos?.__sourceTipo || doc.tipo;
                const tipoLabel =
                  sourceTipo === 'emitida'
                    ? 'Ingreso (emitida)'
                    : sourceTipo === 'recibida'
                    ? 'Gasto (recibida)'
                    : sourceTipo === 'gasto'
                    ? 'Gasto'
                    : getTipoNombre(doc.tipo);

                return (
                  <div
                    key={doc.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <span className="text-3xl">📄</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{doc.nombre}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {(doc.periodo || 'Sin periodo')} • Subido el {doc.fechaSubida.toLocaleDateString('es-ES')}
                          </p>

                          <div className="flex flex-wrap gap-2 mt-2 text-xs">
                            <span className="badge bg-blue-50 text-blue-700">{tipoLabel}</span>
                            <span className="badge bg-gray-50 text-gray-700">
                              {formatFileSize(doc.tamaño)}
                            </span>
                            <span className="badge bg-gray-50 text-gray-700">
                              Fecha: {doc.fechaSubida.toLocaleDateString('es-ES')}
                            </span>
                          </div>

                          {doc.analisisIA && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm text-blue-900">
                                <strong>Análisis IA:</strong> {doc.analisisIA.resumenGeneral}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <a
                        href={doc.urlArchivo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-cliente ml-4"
                      >
                        👁️ Ver Documento
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
