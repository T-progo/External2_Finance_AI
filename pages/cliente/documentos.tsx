import { useState, useMemo, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Documento } from '@/types';
import { getDocumentos, getClienteIdByUserId, deleteDocumento, uploadMultipleDocumentos } from '@/lib/supabaseService';
import { useAuth } from '@/lib/authContext';
import DocumentViewer from '@/components/DocumentViewer';
import DataTable from '@/components/DataTable';
import FilterBar, { Filter } from '@/components/FilterBar';
import Dialog from '@/components/Dialog';
import toast from 'react-hot-toast';

export default function ClienteDocumentos() {
  const { user } = useAuth();
  
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<Documento | null>(null);
  const [mostrarVisor, setMostrarVisor] = useState(false);
  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Documento[]>([]);
  const [vistaActiva, setVistaActiva] = useState<'tabla' | 'tarjetas'>('tabla');
  const [loadingData, setLoadingData] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Fetch documents from Supabase
  useEffect(() => {
    const fetchDocumentos = async () => {
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

        const docs = await getDocumentos(cId);
        setDocumentos(docs);
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setLoadingData(false);
      }
    };

    if (user?.id) {
      fetchDocumentos();
    }
  }, [user?.id]);

  // Filtros
  const [filtros, setFiltros] = useState<Record<string, any>>({
    busqueda: '',
    estado: '',
    tipo: '',
    fecha_desde: '',
    fecha_hasta: '',
  });

  const filtrosConfig: Filter[] = [
    {
      key: 'busqueda',
      label: 'Buscar',
      type: 'text',
      placeholder: 'Nombre o nº de factura...',
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'procesado_ia', label: 'Procesando' },
        { value: 'validado', label: 'Validado' },
        { value: 'contabilizado', label: 'Contabilizado' },
        { value: 'incidencia', label: 'Con Incidencia' },
      ],
    },
    {
      key: 'tipo',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'emitida_pdf', label: 'Facturas emitidas (PDF)' },
        { value: 'recibida_pdf', label: 'Factura recibidas (PDF)' },
        { value: 'emitida_excel', label: 'Facturas emitidas (Excel)' },
        { value: 'recibida_excel', label: 'Facturas recibidas (Excel)' },
        { value: 'otro', label: 'Otros' },
      ],
    },
    {
      key: 'fecha',
      label: 'Rango de Fechas',
      type: 'daterange',
    },
  ];

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
  };

  const handleLimpiarFiltros = () => {
    setFiltros({
      busqueda: '',
      estado: '',
      tipo: '',
      fecha_desde: '',
      fecha_hasta: '',
    });
  };

  // Aplicar filtros
  const documentosFiltrados = useMemo(() => {
    return documentos.filter(doc => {
      // Búsqueda por nombre o número de factura
      if (filtros.busqueda) {
        const busqueda = filtros.busqueda.toLowerCase();
        const coincideNombre = doc.nombre.toLowerCase().includes(busqueda);
        const coincideNumero = doc.datosIA?.numeroFactura?.toLowerCase().includes(busqueda);
        if (!coincideNombre && !coincideNumero) return false;
      }

      // Filtro por estado
      if (filtros.estado && doc.estado !== filtros.estado) {
        return false;
      }

      // Filtro por tipo
      if (filtros.tipo && doc.tipo !== filtros.tipo) {
        return false;
      }

      // Filtro por rango de fechas
      if (filtros.fecha_desde) {
        const fechaDoc = new Date(doc.fechaSubida);
        const fechaDesde = new Date(filtros.fecha_desde);
        if (fechaDoc < fechaDesde) return false;
      }

      if (filtros.fecha_hasta) {
        const fechaDoc = new Date(doc.fechaSubida);
        const fechaHasta = new Date(filtros.fecha_hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        if (fechaDoc > fechaHasta) return false;
      }

      return true;
    });
  }, [documentos, filtros]);

  // Helper function to get document type display info
  const getTipoDocumentoInfo = (tipo: string) => {
    if (tipo === 'emitida_pdf') return { icon: '📤', label: 'Facturas emitidas (PDF)' };
    if (tipo === 'recibida_pdf') return { icon: '📥', label: 'Factura recibidas (PDF)' };
    if (tipo === 'emitida_excel') return { icon: '📤', label: 'Facturas emitidas (Excel)' };
    if (tipo === 'recibida_excel') return { icon: '📥', label: 'Facturas recibidas (Excel)' };
    return { icon: '📄', label: 'Otros' };
  };

  const handleVerDocumento = (doc: Documento) => {
    setDocumentoSeleccionado(doc);
    setMostrarVisor(true);
  };

  const handleSubirDocumentos = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clienteId) {
      toast.error('Error: No se encontró tu información de cliente');
      return;
    }

    const form = e.target as HTMLFormElement;
    const tipoSelect = form.querySelector('select[name="tipo"]') as HTMLSelectElement;
    const notasInput = form.querySelector('textarea[name="notas"]') as HTMLTextAreaElement;

    const tipo = tipoSelect.value as 'emitida_pdf' | 'recibida_pdf' | 'emitida_excel' | 'recibida_excel' | 'otro';
    const notas = notasInput.value;

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
        const docId = await uploadDocumento(file, clienteId, tipo, notas);
        uploadedIds.push(docId);
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      // Refresh the documents list
      const docs = await getDocumentos(clienteId);
      setDocumentos(docs);

      toast.success(`Documentos subidos correctamente. Tu asesor los revisará pronto.`);
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
      toast.error('Algunos archivos fueron ignorados. Solo se permiten PDF, Excel (.xls, .xlsx), XML, JPG y PNG');
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDescargarSeleccionados = async () => {
    if (seleccionados.length === 0) {
      toast.error('Selecciona al menos un documento');
      return;
    }

    const loadingToast = toast.loading('Preparando ZIP...');
    
    try {
      const documentoIds = seleccionados.map(doc => doc.id);
      
      const res = await fetch('/api/documents/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al descargar ZIP');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentos-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.dismiss(loadingToast);
      toast.success(`ZIP descargado con ${seleccionados.length} documento(s)`);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Error al descargar ZIP');
      console.error('Error downloading ZIP:', error);
    }
  };

  const handleEliminarSeleccionados = async () => {
    if (seleccionados.length === 0) {
      toast.error('Selecciona al menos un documento');
      return;
    }

    // Verificar que todos los documentos seleccionados sean pendientes
    const hayContabilizados = seleccionados.some(doc => 
      doc.estado === 'contabilizado' || doc.estado === 'validado'
    );

    if (hayContabilizados) {
      toast.error('No puedes eliminar documentos que ya han sido contabilizados o validados por tu asesor.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar',
      message: `¿Tem certeza de que deseja eliminar ${seleccionados.length} documento(s)?`,
      onConfirm: async () => {
        try {
          await Promise.all(seleccionados.map(doc => deleteDocumento(doc.id)));
          // Refresh the list
          setDocumentos(prev => prev.filter(d => !seleccionados.find(s => s.id === d.id)));
          setSeleccionados([]);
          toast.success('Documentos eliminados correctamente');
        } catch (error) {
          console.error('Error deleting documents:', error);
          toast.error('Error al eliminar documentos');
        }
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
      }
    });
  };

  const handleEliminarDocumento = async (doc: Documento) => {
    if (doc.estado === 'contabilizado' || doc.estado === 'validado') {
      toast.error('No puedes eliminar documentos que ya han sido contabilizados o validados por tu asesor.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar',
      message: `¿Tem certeza de que deseja eliminar ${doc.nombre}?`,
      onConfirm: async () => {
        try {
          await deleteDocumento(doc.id);
          // Refresh the list
          setDocumentos(prev => prev.filter(d => d.id !== doc.id));
          toast.success('Documento eliminado correctamente');
        } catch (error) {
          console.error('Error deleting document:', error);
          toast.error('Error al eliminar el documento');
        }
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
      }
    });
  };

  const estadisticas = {
    total: documentosFiltrados.length,
    pendientes: documentosFiltrados.filter(d => d.estado === 'pendiente' || d.estado === 'procesado_ia').length,
    contabilizados: documentosFiltrados.filter(d => d.estado === 'validado' || d.estado === 'contabilizado').length,
    incidencias: documentosFiltrados.filter(d => d.estado === 'incidencia').length,
  };

  // Columnas para la tabla
  const columnas = [
    {
      key: 'nombre',
      header: 'Documento',
      sortable: true,
      render: (doc: Documento) => (
        <div className="flex items-center space-x-3 min-w-0 max-w-60">
          <span className="text-2xl flex-shrink-0">
            {getTipoDocumentoInfo(doc.tipo).icon}
          </span>
          <div className="min-w-0 flex-1">
            <div 
              className="font-medium text-gray-900 truncate" 
              title={doc.nombre}
            >
              {doc.nombre}
            </div>
            {doc.datosIA?.numeroFactura && (
              <div className="text-xs text-gray-500 truncate">Nº {doc.datosIA.numeroFactura}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'fechaSubida',
      header: 'Fecha Subida',
      sortable: true,
      render: (doc: Documento) => (
        <span className="text-sm text-gray-700">
          {new Date(doc.fechaSubida).toLocaleDateString('es-ES')}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      render: (doc: Documento) => (
        <span className="text-sm text-gray-700">
          {getTipoDocumentoInfo(doc.tipo).label}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (doc: Documento) => (
        <span className={`badge ${
          doc.estado === 'contabilizado' ? 'badge-success' :
          doc.estado === 'validado' ? 'badge-success' :
          doc.estado === 'procesado_ia' ? 'badge-info' :
          doc.estado === 'incidencia' ? 'badge-danger' :
          'badge-warning'
        }`}>
          {doc.estado === 'pendiente' ? '⏳ Pendiente' :
           doc.estado === 'procesado_ia' ? '🔄 Procesando' :
           doc.estado === 'validado' ? '✅ Validado' :
           doc.estado === 'contabilizado' ? '✅ Contabilizado' :
           doc.estado === 'incidencia' ? '⚠️ Incidencia' : doc.estado}
        </span>
      ),
    },
  ];

  if (loadingData) {
    return (
      <Layout rol="cliente">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cliente mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando documentos...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Mis Documentos</h1>
            <p className="text-gray-600 mt-1">Gestión de facturas y documentos contables</p>
          </div>
          <button
            onClick={() => setMostrarSubida(true)}
            className="btn btn-cliente"
          >
            ⬆️ Subir Documentos
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{estadisticas.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{estadisticas.pendientes}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Contabilizados</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticas.contabilizados}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Con Incidencias</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{estadisticas.incidencias}</div>
          </div>
        </div>

        {/* Filtros */}
        <FilterBar
          filters={filtrosConfig}
          values={filtros}
          onChange={handleFiltroChange}
          onClear={handleLimpiarFiltros}
        />

        {/* Barra de acciones */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setVistaActiva('tabla')}
              className={`btn btn-sm ${vistaActiva === 'tabla' ? 'btn-cliente' : 'btn-secondary'}`}
            >
              📋 Tabla
            </button>
            <button
              onClick={() => setVistaActiva('tarjetas')}
              className={`btn btn-sm ${vistaActiva === 'tarjetas' ? 'btn-cliente' : 'btn-secondary'}`}
            >
              🗂️ Tarjetas
            </button>
          </div>

          {seleccionados.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {seleccionados.length} seleccionado(s)
              </span>
              <button
                onClick={handleDescargarSeleccionados}
                className="btn btn-sm btn-secondary"
              >
                ⬇️ Descargar ZIP
              </button>
              <button
                onClick={handleEliminarSeleccionados}
                className="btn btn-sm btn-danger"
              >
                🗑️ Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Consejos */}
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Consejos</h3>
              <p className="text-sm text-blue-800">
                • Los documentos <strong>pendientes</strong> pueden eliminarse antes de que tu asesor los revise.<br/>
                • Los documentos <strong>contabilizados o validados</strong> solo pueden descargarse (no se pueden eliminar).<br/>
                • Formatos aceptados: PDF, XML, JPG, PNG (máx. 10MB cada uno).
              </p>
            </div>
          </div>
        </div>

        {/* Vista de documentos */}
        {vistaActiva === 'tabla' ? (
          <div className="card p-4 md:p-8">
            <DataTable
              data={documentosFiltrados}
              columns={columnas}
              onRowClick={handleVerDocumento}
              selectable={true}
              onSelectionChange={setSeleccionados}
              actions={(doc: Documento) => (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVerDocumento(doc);
                    }}
                    className="text-cliente hover:text-cliente/80"
                    title="Ver"
                  >
                    👁️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.success('Descargando...');
                    }}
                    className="text-blue-600 hover:text-blue-800"
                    title="Descargar"
                  >
                    ⬇️
                  </button>
                  {doc.estado !== 'contabilizado' && doc.estado !== 'validado' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEliminarDocumento(doc);
                      }}
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  )}
                  {doc.incidencias && doc.incidencias.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast('Abriendo incidencia...');
                      }}
                      className="text-orange-600 hover:text-orange-800"
                      title="Ver Incidencia"
                    >
                      💬
                    </button>
                  )}
                </div>
              )}
            />
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documentosFiltrados.map(doc => (
            <div
              key={doc.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleVerDocumento(doc)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{doc.nombre}</h3>
                  <p className="text-xs text-gray-500">
                    {new Date(doc.fechaSubida).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <div className="text-2xl">
                  {getTipoDocumentoInfo(doc.tipo).icon}
                </div>
              </div>

                <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium text-gray-900">
                      {getTipoDocumentoInfo(doc.tipo).label}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <span className={`badge text-xs ${
                    doc.estado === 'contabilizado' ? 'badge-success' :
                    doc.estado === 'validado' ? 'badge-success' :
                    doc.estado === 'procesado_ia' ? 'badge-info' :
                    doc.estado === 'incidencia' ? 'badge-danger' :
                    'badge-warning'
                  }`}>
                    {doc.estado === 'pendiente' ? '⏳ Pendiente' :
                       doc.estado === 'procesado_ia' ? '🔄 Procesando' :
                     doc.estado === 'validado' ? '✅ Validado' :
                     doc.estado === 'contabilizado' ? '✅ Contabilizado' :
                       doc.estado === 'incidencia' ? '⚠️ Incidencia' : doc.estado}
                  </span>
                </div>
              </div>

                <div className="flex space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerDocumento(doc);
                }}
                    className="btn btn-sm btn-cliente flex-1"
                  >
                    👁️ Ver
                  </button>
                  {doc.estado !== 'contabilizado' && doc.estado !== 'validado' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEliminarDocumento(doc);
                      }}
                      className="btn btn-sm btn-danger"
                    >
                      🗑️
              </button>
                  )}
                </div>
            </div>
          ))}

            {documentosFiltrados.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No se encontraron documentos
              </h3>
              <p className="text-gray-600 mb-4">
                  Intenta ajustar los filtros o sube tu primer documento
              </p>
              <button
                onClick={() => setMostrarSubida(true)}
                className="btn btn-cliente"
              >
                  ⬆️ Subir Documentos
              </button>
            </div>
          )}
        </div>
        )}

        {/* Modal de visualización */}
        <Dialog
          isOpen={mostrarVisor && !!documentoSeleccionado}
          onClose={() => {
            setMostrarVisor(false);
            setDocumentoSeleccionado(null);
          }}
          title={documentoSeleccionado?.nombre || ''}
          maxWidth="4xl"
          footer={
            <div className="flex justify-between">
              <div className="space-x-2">
                <button
                  onClick={() => toast.success('Descargando...')}
                  className="btn btn-secondary"
                >
                  ⬇️ Descargar
                </button>
                {documentoSeleccionado && documentoSeleccionado.estado !== 'contabilizado' && documentoSeleccionado.estado !== 'validado' && (
                  <button
                    onClick={() => {
                      handleEliminarDocumento(documentoSeleccionado);
                      setMostrarVisor(false);
                    }}
                    className="btn btn-danger"
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
              <button
                onClick={() => setMostrarVisor(false)}
                className="btn btn-secondary"
              >
                Cerrar
              </button>
            </div>
          }
        >
          {documentoSeleccionado && (
            <>
              <p className="text-gray-600 mb-6">
                Subido el {new Date(documentoSeleccionado.fechaSubida).toLocaleDateString('es-ES')}
              </p>

              {/* Datos leídos por IA */}
              {documentoSeleccionado.datosIA && (
                <div className="mb-6 card bg-blue-50 border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <span className="mr-2">🤖</span>
                    Datos extraídos por IA
                    <span className="ml-2 text-xs badge badge-info">
                      Confianza: {documentoSeleccionado.datosIA.nivelConfianza}%
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {documentoSeleccionado.datosIA.fechaFactura && (
                      <div>
                        <span className="text-gray-600">Fecha:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {documentoSeleccionado.datosIA.fechaFactura}
                        </span>
                      </div>
                    )}
                    {documentoSeleccionado.datosIA.numeroFactura && (
                      <div>
                        <span className="text-gray-600">Número:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {documentoSeleccionado.datosIA.numeroFactura}
                        </span>
                      </div>
                    )}
                    {documentoSeleccionado.datosIA.nifEmisor && (
                      <div>
                        <span className="text-gray-600">NIF:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {documentoSeleccionado.datosIA.nifEmisor}
                        </span>
                      </div>
                    )}
                    {documentoSeleccionado.datosIA.razonSocialEmisor && (
                      <div>
                        <span className="text-gray-600">Emisor:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {documentoSeleccionado.datosIA.razonSocialEmisor}
                        </span>
                      </div>
                    )}
                    {documentoSeleccionado.datosIA.baseImponible !== undefined && (
                      <div>
                        <span className="text-gray-600">Base:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {documentoSeleccionado.datosIA.baseImponible.toFixed(2)}€
                        </span>
                      </div>
                    )}
                    {documentoSeleccionado.datosIA.cuotaIVA !== undefined && (
                      <div>
                        <span className="text-gray-600">IVA:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {documentoSeleccionado.datosIA.cuotaIVA.toFixed(2)}€ ({documentoSeleccionado.datosIA.tipoIVA}%)
                        </span>
                      </div>
                    )}
                    {documentoSeleccionado.datosIA.totalFactura !== undefined && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Total:</span>
                        <span className="ml-2 font-bold text-xl text-cliente">
                          {documentoSeleccionado.datosIA.totalFactura.toFixed(2)}€
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Enlace a incidencia si existe */}
              {documentoSeleccionado.incidencias && documentoSeleccionado.incidencias.length > 0 && (
                <div className="mb-6 card bg-orange-50 border-orange-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <h4 className="font-semibold text-orange-900">Este documento tiene incidencias</h4>
                        <p className="text-sm text-orange-700">
                          Tu asesor ha reportado un problema que requiere tu atención
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        toast('Abriendo chat de incidencia...');
                      }}
                      className="btn btn-sm btn-warning"
                    >
                      💬 Ver Incidencia
                    </button>
                  </div>
                </div>
              )}

              {/* Previsualización del documento */}
              <DocumentViewer documento={documentoSeleccionado} />
            </>
          )}
        </Dialog>

        {/* Modal de subida de documentos */}
        <Dialog
          isOpen={mostrarSubida}
          onClose={() => {
            if (!uploading) {
              setMostrarSubida(false);
              setSelectedFiles([]);
            }
          }}
          title="Subir Documentos"
          maxWidth="2xl"
          closeOnBackdrop={!uploading}
          closeOnEscape={!uploading}
        >
          <form onSubmit={handleSubirDocumentos}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Documento
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
                  Archivos (puedes seleccionar varios)
                </label>
                
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    isDragging
                      ? 'border-cliente bg-cliente/5 scale-[1.02]'
                      : 'border-gray-300 hover:border-gray-400'
                  } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => !uploading && document.getElementById('fileInput')?.click()}
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
                          <span className="text-cliente font-semibold">haz clic para seleccionar</span>
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
                    id="fileInput"
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
                  placeholder="Añade cualquier nota o aclaración para tu asesor..."
                  disabled={uploading}
                ></textarea>
              </div>

              {uploading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cliente"></div>
                    <span className="text-sm font-medium text-blue-900">
                      Subiendo documentos... {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-cliente h-2 rounded-full transition-all duration-300"
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
                      Todos se subirán con el mismo tipo de documento. Si necesitas subir diferentes tipos, 
                      hazlo en lotes separados.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button type="submit" className="btn btn-cliente flex-1" disabled={uploading}>
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

        {/* Confirmation Dialog */}
        <Dialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
          title=""
          maxWidth="sm"
        >
          <div className="pb-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{confirmDialog.title}</h2>
            <p className="text-gray-700 text-base mb-6">{confirmDialog.message}</p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={confirmDialog.onConfirm}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
                className="px-6 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg border border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Dialog>
      </div>
    </Layout>
  );
}
