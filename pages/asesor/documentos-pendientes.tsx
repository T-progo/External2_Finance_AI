import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import DocumentViewer from '@/components/DocumentViewer';
import Dialog from '@/components/Dialog';
import toast from 'react-hot-toast';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

interface Cliente {
  id: string;
  razon_social: string;
  nombre_comercial: string;
  nif: string;
}

interface DocumentoPendiente {
  id: string;
  nombre: string;
  tipo: string;
  fecha_subida: string;
  tamanio: number;
  url_archivo: string;
  datos_ia?: any;
  cliente_id: string;
  estado?: string;
}

interface DocumentoConCliente extends DocumentoPendiente {
  cliente: Cliente;
}

interface ClienteConDocumentos {
  cliente: Cliente;
  documentos: DocumentoPendiente[];
  documentosProcesados: number;
  ultimoDocumentoFecha?: Date;
}

interface FinancialData {
  fechaFactura?: string;
  numeroFactura?: string;
  nifEmisor?: string;
  razonSocialEmisor?: string;
  nifReceptor?: string;
  razonSocialReceptor?: string;
  baseImponible?: number;
  tipoIVA?: number;
  cuotaIVA?: number;
  totalFactura?: number;
}

export default function DocumentosPendientes() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [clientesConDocs, setClientesConDocs] = useState<ClienteConDocumentos[]>([]);
  const [allClientes, setAllClientes] = useState<Cliente[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [mostrarVisor, setMostrarVisor] = useState(false);
  const [documentoActual, setDocumentoActual] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Financial data states
  const [editingFinancial, setEditingFinancial] = useState(false);
  const [financialData, setFinancialData] = useState<FinancialData>({});
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [verifyingAI, setVerifyingAI] = useState(false);
  const [savingFinancial, setSavingFinancial] = useState(false);

  const loadPendingDocuments = useCallback(async () => {
    try {
      setLoadingData(true);
      
      if (!user?.id) {
        console.error('No user ID found');
        toast.error('Error: No se pudo obtener el ID del usuario');
        return;
      }

      
      // Get advisor's assigned clients
      const { data: assignedClients, error: clientError } = await supabaseAdmin
        .from('asesor_cliente')
        .select('cliente_id, clientes(*)')
        .eq('asesor_id', user.id);

      if (clientError) {
        console.error('Error loading assigned clients:', clientError);
        throw clientError;
      }


      // Store all assigned clients for the upload modal
      const todosClientes: Cliente[] = [];
      assignedClients?.forEach(ac => {
        if (ac.clientes) {
          todosClientes.push(ac.clientes as unknown as Cliente);
        }
      });
      setAllClientes(todosClientes);

      const clientIds = assignedClients?.map(ac => ac.cliente_id) || [];

      if (clientIds.length === 0) {
        console.log('No assigned clients found');
        setClientesConDocs([]);
        return;
      }

      // Get pending documents
      const { data: pendingDocs, error: docsError } = await supabaseAdmin
        .from('documentos')
        .select('*')
        .in('cliente_id', clientIds)
        .in('estado', ['pendiente', 'procesado_ia']);

      if (docsError) {
        console.error('Error loading documents:', docsError);
        throw docsError;
      }

      // Get processed documents count for each client
      const { data: processedDocs, error: processedError } = await supabaseAdmin
        .from('documentos')
        .select('id, cliente_id, fecha_subida')
        .in('cliente_id', clientIds)
        .in('estado', ['contabilizado', 'validado']);

      if (processedError) {
        console.error('Error loading processed documents:', processedError);
        // Continue without processed count
      }

      // Get all documents to find last document date
      const { data: allDocs, error: allDocsError } = await supabaseAdmin
        .from('documentos')
        .select('id, cliente_id, fecha_subida')
        .in('cliente_id', clientIds)
        .order('fecha_subida', { ascending: false });

      if (allDocsError) {
        console.error('Error loading all documents:', allDocsError);
      }

      // Group documents by client
      const grouped: ClienteConDocumentos[] = [];
      
      assignedClients?.forEach(ac => {
        const clienteDocs = pendingDocs?.filter(d => d.cliente_id === ac.cliente_id) || [];
        const processedCount = processedDocs?.filter(d => d.cliente_id === ac.cliente_id).length || 0;
        
        // Find last document date for this client
        const clientAllDocs = allDocs?.filter(d => d.cliente_id === ac.cliente_id) || [];
        const ultimoDoc = clientAllDocs.length > 0 ? clientAllDocs[0] : null;
        const ultimoDocumentoFecha = ultimoDoc ? new Date(ultimoDoc.fecha_subida) : undefined;

        // Include clients with pending documents OR show all assigned clients
        if (ac.clientes) {
          grouped.push({
            cliente: ac.clientes as any,
            documentos: clienteDocs as any,
            documentosProcesados: processedCount,
            ultimoDocumentoFecha
          });
        }
      });

      // Show all assigned clients (even if they have no pending documents)
      setClientesConDocs(grouped);
    } catch (error: any) {
      console.error('Error loading pending documents:', error);
      toast.error(`Error al cargar documentos pendientes: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'asesor')) {
      router.push('/');
    }
    if (user && user.rol === 'asesor') {
      loadPendingDocuments();
    }
  }, [user, loading, router, loadPendingDocuments]);

  const toggleDocSelection = (docId: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  };


  const handleBulkDelete = async () => {
    if (selectedDocs.size === 0) {
      toast.error('No hay documentos seleccionados');
      return;
    }

    if (!confirm(`¿Eliminar ${selectedDocs.size} documento(s)?`)) return;

    try {
      const { error } = await supabase
        .from('documentos')
        .delete()
        .in('id', Array.from(selectedDocs));

      if (error) throw error;

      toast.success(`${selectedDocs.size} documento(s) eliminado(s)`);
      setSelectedDocs(new Set());
      loadPendingDocuments();
    } catch (error) {
      console.error('Error deleting documents:', error);
      toast.error('Error al eliminar documentos');
    }
  };

  const handleBulkDownload = () => {
    if (selectedDocs.size === 0) {
      toast.error('No hay documentos seleccionados');
      return;
    }
    toast.success('Preparando descarga ZIP... (función en desarrollo)');
    // TODO: Implement ZIP download
  };

  const handlePostAutomatically = async () => {
    if (selectedDocs.size === 0) {
      toast.error('No hay documentos seleccionados');
      return;
    }

    try {
      // Call AI posting API
      const response = await fetch('/api/documents/post-automatically', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(selectedDocs) })
      });

      if (!response.ok) throw new Error('Error posting documents');

      const data = await response.json();
      toast.success(`${data.posted} documento(s) contabilizado(s) automáticamente`);
      setSelectedDocs(new Set());
      loadPendingDocuments();
    } catch (error) {
      console.error('Error posting documents:', error);
      toast.error('Error al contabilizar documentos');
    }
  };

  const handlePostManually = () => {
    if (selectedDocs.size === 0) {
      toast.error('No hay documentos seleccionados');
      return;
    }
    // Navigate to manual posting page
    router.push(`/asesor/contabilizacion-manual?docs=${Array.from(selectedDocs).join(',')}`);
  };

  // Single document handlers
  const handleDownloadDocument = (docId: string) => {
    toast.success('Preparando descarga... (función en desarrollo)');
    // TODO: Implement single document download
  };

  const handlePostAutomaticallySingle = async (docId: string) => {
    try {
      const response = await fetch('/api/documents/post-automatically', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: [docId] })
      });

      if (!response.ok) throw new Error('Error posting document');

      const data = await response.json();
      toast.success('Documento contabilizado automáticamente');
      loadPendingDocuments();
    } catch (error) {
      console.error('Error posting document:', error);
      toast.error('Error al contabilizar documento');
    }
  };

  const handlePostManuallySingle = (docId: string) => {
    router.push(`/asesor/contabilizacion-manual?docs=${docId}`);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('¿Eliminar este documento?')) return;

    try {
      const { error } = await supabase
        .from('documentos')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      toast.success('Documento eliminado');
      loadPendingDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  const handleVerDocumento = (doc: DocumentoPendiente) => {
    setDocumentoActual(doc);
    // Initialize financial data from AI data if available
    if (doc.datos_ia) {
      setFinancialData({
        fechaFactura: doc.datos_ia.fechaFactura || doc.datos_ia.fecha || '',
        numeroFactura: doc.datos_ia.numeroFactura || '',
        nifEmisor: doc.datos_ia.nifEmisor || '',
        razonSocialEmisor: doc.datos_ia.razonSocialEmisor || '',
        nifReceptor: doc.datos_ia.nifReceptor || '',
        razonSocialReceptor: doc.datos_ia.razonSocialReceptor || '',
        baseImponible: doc.datos_ia.baseImponible,
        tipoIVA: doc.datos_ia.tipoIVA,
        cuotaIVA: doc.datos_ia.cuotaIVA,
        totalFactura: doc.datos_ia.totalFactura || doc.datos_ia.importeTotal,
      });
      setIsManualEntry(false);
    } else {
      setFinancialData({});
      setIsManualEntry(true);
    }
    setEditingFinancial(false);
    setMostrarVisor(true);
  };

  const handleVerifyWithAI = async () => {
    if (!documentoActual) return;

    setVerifyingAI(true);
    try {
      const response = await fetch('/api/documents/verify-financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentoId: documentoActual.id,
          forceReextract: true 
        }),
      });

      if (!response.ok) throw new Error('Error en verificación IA');

      const { datosIA } = await response.json();
      
      // Update financial data with AI results
      setFinancialData({
        fechaFactura: datosIA.fechaFactura || datosIA.fecha || '',
        numeroFactura: datosIA.numeroFactura || '',
        nifEmisor: datosIA.nifEmisor || '',
        razonSocialEmisor: datosIA.razonSocialEmisor || '',
        nifReceptor: datosIA.nifReceptor || '',
        razonSocialReceptor: datosIA.razonSocialReceptor || '',
        baseImponible: datosIA.baseImponible,
        tipoIVA: datosIA.tipoIVA,
        cuotaIVA: datosIA.cuotaIVA,
        totalFactura: datosIA.totalFactura || datosIA.importeTotal,
      });
      
      // Update documento actual
      setDocumentoActual({ ...documentoActual, datos_ia: datosIA, procesado_ia: true });
      
      // Refresh document list
      await loadPendingDocuments();
      
      setIsManualEntry(false);
      toast.success('Datos financieros extraídos correctamente por IA');
    } catch (error: any) {
      console.error('Error verifying with AI:', error);
      toast.error(`Error al verificar con IA: ${error.message}`);
    } finally {
      setVerifyingAI(false);
    }
  };

  const handleSaveFinancialData = async () => {
    if (!documentoActual) return;

    setSavingFinancial(true);
    try {
      // Prepare datosIA structure
      const datosIA = {
        ...(documentoActual.datos_ia || {}),
        fechaFactura: financialData.fechaFactura || undefined,
        numeroFactura: financialData.numeroFactura || undefined,
        nifEmisor: financialData.nifEmisor || undefined,
        razonSocialEmisor: financialData.razonSocialEmisor || undefined,
        nifReceptor: financialData.nifReceptor || undefined,
        razonSocialReceptor: financialData.razonSocialReceptor || undefined,
        baseImponible: financialData.baseImponible,
        tipoIVA: financialData.tipoIVA,
        cuotaIVA: financialData.cuotaIVA,
        totalFactura: financialData.totalFactura,
        // Maintain existing confidence if editing, or set to manual
        nivelConfianza: documentoActual.datos_ia?.nivelConfianza || (isManualEntry ? 1.0 : 0.5),
        // Aliases
        fecha: financialData.fechaFactura || undefined,
        importeTotal: financialData.totalFactura,
        proveedor: financialData.razonSocialEmisor || undefined,
      };

      const response = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentoId: documentoActual.id,
          updates: {
            datosIA: datosIA,
            procesadoIA: true,
          },
        }),
      });

      if (!response.ok) throw new Error('Error al guardar datos');

      const { data } = await response.json();
      setDocumentoActual({ ...documentoActual, datos_ia: datosIA, procesado_ia: true });
      
      // Refresh document list
      await loadPendingDocuments();
      
      setEditingFinancial(false);
      toast.success('Datos financieros guardados correctamente');
    } catch (error: any) {
      console.error('Error saving financial data:', error);
      toast.error(`Error al guardar datos: ${error.message}`);
    } finally {
      setSavingFinancial(false);
    }
  };

  const calculateTotal = () => {
    if (financialData.baseImponible && financialData.cuotaIVA) {
      return financialData.baseImponible + financialData.cuotaIVA;
    }
    if (financialData.baseImponible && financialData.tipoIVA) {
      return financialData.baseImponible * (1 + financialData.tipoIVA / 100);
    }
    return financialData.totalFactura || 0;
  };

  const calculateIVA = () => {
    if (financialData.cuotaIVA) return financialData.cuotaIVA;
    if (financialData.baseImponible && financialData.tipoIVA) {
      return financialData.baseImponible * (financialData.tipoIVA / 100);
    }
    return 0;
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFileSelection(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFileSelection(files);
    }
  };

  const handleFileSelection = (files: File[]) => {
    // Validate file types
    const validTypes = ['.pdf', '.xml', '.jpg', '.jpeg', '.png', '.xls', '.xlsx'];
    const validFiles = files.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return validTypes.includes(extension);
    });

    if (validFiles.length !== files.length) {
      toast.error('Algunos archivos fueron ignorados. Solo se permiten PDF, Excel, XML, JPG y PNG');
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubirDocumentos = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const clienteSelect = form.querySelector('select[name="cliente"]') as HTMLSelectElement;
    const tipoSelect = form.querySelector('select[name="tipo"]') as HTMLSelectElement;
    const notasInput = form.querySelector('textarea[name="notas"]') as HTMLTextAreaElement;

    const clienteId = clienteSelect.value;
    const tipo = tipoSelect.value as 'emitida_pdf' | 'recibida_pdf' | 'emitida_excel' | 'recibida_excel' | 'otro';
    const notas = notasInput.value;

    if (!clienteId) {
      toast.error('Por favor selecciona un cliente');
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error('Por favor selecciona al menos un archivo');
      return;
    }

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024; // 10MB
    for (let i = 0; i < selectedFiles.length; i++) {
      if (selectedFiles[i].size > maxSize) {
        toast.error(`El archivo "${selectedFiles[i].name}" excede el tamaño máximo de 10MB`);
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = selectedFiles.length;
      
      // Upload files one by one to show progress
      const uploadedIds: string[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const { uploadDocumento } = await import('@/lib/supabaseService');
        const docId = await uploadDocumento(file, clienteId, tipo, notas, user?.id);
        uploadedIds.push(docId);
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      // Refresh the documents list
      await loadPendingDocuments();

      toast.success(`${totalFiles} documento(s) subido(s) correctamente en nombre del cliente.`);
      setMostrarSubida(false);
      setSelectedFiles([]);
      
      // Reset form
      form.reset();
    } catch (error) {
      console.error('Error uploading documents:', error);
      
      let errorMessage = 'Error desconocido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle Supabase errors
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.error_description) {
          errorMessage = supabaseError.error_description;
        }
      }
      
      toast.error(`Error al subir documentos: ${errorMessage}. Por favor, revisa el formato y tamaño de los archivos e inténtalo de nuevo.`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Helper function to calculate days ago
  const getDaysAgo = (date: Date | undefined): string => {
    if (!date) return 'N/A';
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'hace 1 día';
    return `hace ${diffDays} días`;
  };

  // Helper function to get client initial
  const getClientInitial = (cliente: Cliente): string => {
    const name = cliente.nombre_comercial || cliente.razon_social || '';
    return name.charAt(0).toUpperCase() || '?';
  };

  // Handle Trabajar button click
  const handleTrabajar = (clienteId: string) => {
    // Navigate to a page where the advisor can work on this client's documents
    // For now, we'll navigate to the manual accounting page filtered by client
    router.push(`/asesor/contabilizacion-manual?cliente=${clienteId}`);
  };

  const totalPendientes = clientesConDocs.reduce((sum, c) => sum + c.documentos.length, 0);
  const clientesConPendientes = clientesConDocs.filter(c => c.documentos.length > 0).length;

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

  return (
    <>
      <Head>
        <title>Documentos Pendientes - Externaliza2</title>
      </Head>
      <Layout rol="asesor">
        <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Documentos Pendientes</h1>
              <p className="text-gray-600 mt-1">
                {totalPendientes} documento(s) pendiente(s) de {clientesConPendientes} cliente(s)
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setMostrarSubida(true)}
                className="btn btn-asesor"
              >
                ⬆️ Subir Documentos
              </button>
            </div>
          </div>

          {/* Client Cards Grid */}
          {clientesConDocs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientesConDocs.map(({ cliente, documentos, documentosProcesados, ultimoDocumentoFecha }) => {
                // Get client initials (first letter of each word, max 2)
                const iniciales = (cliente.nombre_comercial || cliente.razon_social || '')
                  .split(' ')
                  .map((palabra) => palabra[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase() || getClientInitial(cliente);

                return (
                  <div
                    key={cliente.id}
                    className="card hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleTrabajar(cliente.id)}
                  >
                    {/* Client Identifier Section */}
                    <div className="flex items-start space-x-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-lg">
                        {iniciales}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {cliente.nombre_comercial || cliente.razon_social}
                        </h3>
                        <p className="text-sm text-gray-600">{cliente.nif}</p>
                      </div>
                    </div>

                    {/* Last Document Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Último documento</span>
                        <span className="text-sm text-gray-900">
                          {getDaysAgo(ultimoDocumentoFecha)}
                        </span>
                      </div>
                    </div>

                    {/* Statistics Section */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                      <div className="text-center flex-1">
                        <div className="text-2xl font-bold text-orange-600">
                          {documentos.length}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">a contabilizar</div>
                      </div>
                      <div className="h-8 w-px bg-gray-200"></div>
                      <div className="text-center flex-1">
                        <div className="text-2xl font-bold text-green-600">
                          {documentosProcesados}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">procesados</div>
                      </div>
                    </div>

                    {/* Trabajar Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrabajar(cliente.id);
                      }}
                      className="btn btn-sm btn-asesor w-full mt-4"
                    >
                      Trabajar
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                No hay documentos pendientes
              </h3>
              <p className="text-gray-600">
                Todos los documentos han sido procesados
              </p>
            </div>
          )}
        </div>

        {/* Document Viewer Modal */}
        {mostrarVisor && documentoActual && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{documentoActual.nombre}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {documentoActual.datos_ia?.nivelConfianza && (
                      <span className={`font-medium ${
                        documentoActual.datos_ia.nivelConfianza >= 0.8 ? 'text-green-600' :
                        documentoActual.datos_ia.nivelConfianza >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        Confianza IA: {(documentoActual.datos_ia.nivelConfianza * 100).toFixed(0)}%
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMostrarVisor(false);
                    setDocumentoActual(null);
                    setEditingFinancial(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Document Viewer */}
                <div className="card">
                  <DocumentViewer documento={documentoActual} />
                </div>

                {/* Financial Data Section */}
                <div className="card border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <span className="mr-2">💰</span>
                      Datos Financieros
                    </h3>
                    <div className="flex space-x-2">
                      {!editingFinancial && (
                        <>
                          <button
                            onClick={handleVerifyWithAI}
                            disabled={verifyingAI}
                            className="btn btn-sm btn-asesor"
                          >
                            {verifyingAI ? (
                              <>
                                <span className="animate-spin mr-2">⏳</span>
                                Verificando...
                              </>
                            ) : (
                              <>
                                🤖 Verificar con IA
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setEditingFinancial(true)}
                            className="btn btn-sm btn-secondary"
                          >
                            ✏️ {documentoActual.datos_ia ? 'Editar' : 'Ingresar Manualmente'}
                          </button>
                        </>
                      )}
                      {editingFinancial && (
                        <>
                          <button
                            onClick={handleSaveFinancialData}
                            disabled={savingFinancial}
                            className="btn btn-sm btn-success"
                          >
                            {savingFinancial ? 'Guardando...' : '💾 Guardar'}
                          </button>
                          <button
                            onClick={() => {
                              // Reset to original data
                              if (documentoActual.datos_ia) {
                                setFinancialData({
                                  fechaFactura: documentoActual.datos_ia.fechaFactura || documentoActual.datos_ia.fecha || '',
                                  numeroFactura: documentoActual.datos_ia.numeroFactura || '',
                                  nifEmisor: documentoActual.datos_ia.nifEmisor || '',
                                  razonSocialEmisor: documentoActual.datos_ia.razonSocialEmisor || '',
                                  nifReceptor: documentoActual.datos_ia.nifReceptor || '',
                                  razonSocialReceptor: documentoActual.datos_ia.razonSocialReceptor || '',
                                  baseImponible: documentoActual.datos_ia.baseImponible,
                                  tipoIVA: documentoActual.datos_ia.tipoIVA,
                                  cuotaIVA: documentoActual.datos_ia.cuotaIVA,
                                  totalFactura: documentoActual.datos_ia.totalFactura || documentoActual.datos_ia.importeTotal,
                                });
                              }
                              setEditingFinancial(false);
                            }}
                            className="btn btn-sm btn-secondary"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingFinancial ? (
                    /* Manual Entry Form */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nº Factura
                          </label>
                          <input
                            type="text"
                            value={financialData.numeroFactura || ''}
                            onChange={(e) => setFinancialData({ ...financialData, numeroFactura: e.target.value })}
                            className="input w-full"
                            placeholder="Ej: FAC-2024-001"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha Factura
                          </label>
                          <input
                            type="date"
                            value={financialData.fechaFactura || ''}
                            onChange={(e) => setFinancialData({ ...financialData, fechaFactura: e.target.value })}
                            className="input w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            NIF Emisor
                          </label>
                          <input
                            type="text"
                            value={financialData.nifEmisor || ''}
                            onChange={(e) => setFinancialData({ ...financialData, nifEmisor: e.target.value })}
                            className="input w-full"
                            placeholder="Ej: B12345678"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Razón Social Emisor
                          </label>
                          <input
                            type="text"
                            value={financialData.razonSocialEmisor || ''}
                            onChange={(e) => setFinancialData({ ...financialData, razonSocialEmisor: e.target.value })}
                            className="input w-full"
                            placeholder="Nombre del emisor"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Base Imponible (€)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={financialData.baseImponible || ''}
                            onChange={(e) => {
                              const base = parseFloat(e.target.value) || 0;
                              const tipoIVA = financialData.tipoIVA || 21;
                              const cuota = base * (tipoIVA / 100);
                              const total = base + cuota;
                              setFinancialData({
                                ...financialData,
                                baseImponible: base || undefined,
                                cuotaIVA: cuota || undefined,
                                totalFactura: total || undefined,
                              });
                            }}
                            className="input w-full"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo IVA (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={financialData.tipoIVA || ''}
                            onChange={(e) => {
                              const tipoIVA = parseFloat(e.target.value) || 0;
                              const base = financialData.baseImponible || 0;
                              const cuota = base * (tipoIVA / 100);
                              const total = base + cuota;
                              setFinancialData({
                                ...financialData,
                                tipoIVA: tipoIVA || undefined,
                                cuotaIVA: cuota || undefined,
                                totalFactura: total || undefined,
                              });
                            }}
                            className="input w-full"
                            placeholder="21"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cuota IVA (€)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={financialData.cuotaIVA || ''}
                            onChange={(e) => {
                              const cuota = parseFloat(e.target.value) || 0;
                              const base = financialData.baseImponible || 0;
                              const total = base + cuota;
                              setFinancialData({
                                ...financialData,
                                cuotaIVA: cuota || undefined,
                                totalFactura: total || undefined,
                              });
                            }}
                            className="input w-full"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Total Factura (€)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={financialData.totalFactura || calculateTotal()}
                            onChange={(e) => setFinancialData({ ...financialData, totalFactura: parseFloat(e.target.value) || undefined })}
                            className="input w-full font-bold text-green-600"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          <strong>💡 Consejo:</strong> Al ingresar la base imponible y el tipo de IVA, el sistema calculará automáticamente la cuota IVA y el total.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Display Financial Data */
                    <div className="space-y-4">
                      {(!documentoActual.datos_ia || Object.keys(financialData).length === 0) ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-600 mb-4">No hay datos financieros disponibles</p>
                          <p className="text-sm text-gray-500">
                            Usa &quot;Verificar con IA&quot; para extraer automáticamente o &quot;Ingresar Manualmente&quot; para agregar los datos.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {financialData.numeroFactura && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-xs text-gray-600 mb-1">Nº Factura</div>
                              <div className="font-semibold text-gray-900">{financialData.numeroFactura}</div>
                            </div>
                          )}
                          {financialData.fechaFactura && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-xs text-gray-600 mb-1">Fecha</div>
                              <div className="font-semibold text-gray-900">
                                {new Date(financialData.fechaFactura).toLocaleDateString('es-ES')}
                              </div>
                            </div>
                          )}
                          {financialData.razonSocialEmisor && (
                            <div className="bg-gray-50 p-3 rounded-lg md:col-span-2">
                              <div className="text-xs text-gray-600 mb-1">Emisor</div>
                              <div className="font-semibold text-gray-900">{financialData.razonSocialEmisor}</div>
                              {financialData.nifEmisor && (
                                <div className="text-sm text-gray-600 mt-1">NIF: {financialData.nifEmisor}</div>
                              )}
                            </div>
                          )}
                          
                          {financialData.baseImponible !== undefined && (
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="text-xs text-gray-600 mb-1">Base Imponible</div>
                              <div className="text-xl font-bold text-blue-900">
                                {financialData.baseImponible.toFixed(2)}€
                              </div>
                            </div>
                          )}
                          {financialData.cuotaIVA !== undefined && financialData.tipoIVA !== undefined && (
                            <div className="bg-purple-50 p-4 rounded-lg">
                              <div className="text-xs text-gray-600 mb-1">IVA ({financialData.tipoIVA}%)</div>
                              <div className="text-xl font-bold text-purple-900">
                                {financialData.cuotaIVA.toFixed(2)}€
                              </div>
                            </div>
                          )}
                          {financialData.totalFactura !== undefined && (
                            <div className="bg-green-50 p-4 rounded-lg md:col-span-2">
                              <div className="text-xs text-gray-600 mb-1">Total Factura</div>
                              <div className="text-2xl font-bold text-green-700">
                                {financialData.totalFactura.toFixed(2)}€
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        <Dialog
          isOpen={mostrarSubida}
          onClose={() => {
            if (!uploading) {
              setMostrarSubida(false);
              setSelectedFiles([]);
            }
          }}
          title="Subir Documentos en Nombre del Cliente"
          maxWidth="2xl"
          closeOnBackdrop={!uploading}
          closeOnEscape={!uploading}
        >
          <form onSubmit={handleSubirDocumentos}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Cliente <span className="text-red-500">*</span>
                </label>
                <select name="cliente" className="input w-full" required disabled={uploading}>
                  <option value="">Selecciona un cliente...</option>
                  {allClientes.map(cliente => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre_comercial || cliente.razon_social} ({cliente.nif})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecciona para qué cliente estás subiendo estos documentos
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Documento <span className="text-red-500">*</span>
                </label>
                <select name="tipo" className="input w-full" required disabled={uploading}>
                  <option value="">Selecciona un tipo...</option>
                  <option value="emitida_pdf">Facturas emitidas (PDF)</option>
                  <option value="recibida_pdf">Factura recibidas (PDF)</option>
                  <option value="emitida_excel">Facturas emitidas (Excel)</option>
                  <option value="recibida_excel">Facturas recibidas (Excel)</option>
                  <option value="otro">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivos <span className="text-red-500">*</span>
                </label>
                
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    isDragging
                      ? 'border-asesor bg-asesor/5 scale-[1.02]'
                      : 'border-gray-300 hover:border-gray-400'
                  } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => !uploading && document.getElementById('fileInputAsesor')?.click()}
                >
                  {/* Cloud Icon */}
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-16 w-16 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  
                  {/* Text */}
                  <div className="mb-2">
                    <p className="text-base text-gray-700 font-medium">
                      {isDragging ? (
                        'Suelta los archivos aquí'
                      ) : (
                        <>
                          Arrastra y suelta tus archivos aquí, o{' '}
                          <span className="text-asesor font-semibold">haz clic para seleccionar</span>
                        </>
                      )}
                    </p>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    Formatos: PDF, Excel (.xls, .xlsx), XML, JPG, PNG
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Máximo 10MB por archivo
                  </p>
                  
                  {/* Hidden File Input */}
                  <input
                    id="fileInputAsesor"
                    type="file"
                    className="hidden"
                    accept=".pdf,.xml,.jpg,.jpeg,.png,.xls,.xlsx"
                    multiple
                    onChange={handleFileInputChange}
                    disabled={uploading}
                  />
                </div>
                
                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Archivos seleccionados ({selectedFiles.length}):
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200"
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="text-2xl">
                              {file.type.includes('pdf') ? '📄' :
                               file.type.includes('image') ? '🖼️' :
                               file.type.includes('xml') ? '📋' :
                               file.type.includes('excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx') ? '📊' :
                               '📎'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          {!uploading && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFile(index);
                              }}
                              className="ml-3 text-red-600 hover:text-red-800 transition-colors"
                              title="Eliminar"
                            >
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  name="notas"
                  className="input w-full"
                  rows={3}
                  placeholder="Añade cualquier nota o aclaración sobre estos documentos..."
                  disabled={uploading}
                ></textarea>
              </div>

              {uploading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-asesor"></div>
                    <span className="text-sm font-medium text-blue-900">
                      Subiendo documentos... {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-asesor h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {!uploading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <span className="text-blue-600">ℹ️</span>
                    <div className="text-sm text-blue-800">
                      <strong>Subida masiva:</strong> Puedes seleccionar múltiples archivos a la vez. 
                      Todos se subirán con el mismo tipo de documento y para el mismo cliente. 
                      Si necesitas subir diferentes tipos o para diferentes clientes, hazlo en lotes separados.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button type="submit" className="btn btn-asesor flex-1" disabled={uploading}>
                  {uploading ? '⏳ Subiendo...' : '⬆️ Subir Documento(s)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarSubida(false);
                    setSelectedFiles([]);
                  }}
                  className="btn btn-secondary flex-1"
                  disabled={uploading}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </Dialog>
      </Layout>
    </>
  );
}
