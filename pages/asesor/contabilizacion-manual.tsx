import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import DocumentViewer from '@/components/DocumentViewer';
import Dialog from '@/components/Dialog';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { Documento } from '@/types';
import { createIncidencia, addMensajeIncidencia } from '@/lib/supabaseService';

interface Cliente {
  id: string;
  razon_social: string;
  nombre_comercial: string;
  nif: string;
}

interface DocumentoDB {
  id: string;
  nombre: string;
  cliente_id: string;
  tipo: string;
  estado: string;
  fecha_subida: string;
  procesado_ia: boolean;
  tamanio: number;
  url_archivo: string;
  datos_ia?: any;
  nro_asiento_erp?: string;
}

export default function AsesorContabilizacionManual() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [documentos, setDocumentos] = useState<DocumentoDB[]>([]);
  const [clientes, setClientes] = useState<Map<string, Cliente>>(new Map());
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<DocumentoDB | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);
  const [vistaActual, setVistaActual] = useState<'clientes' | 'documentos'>('clientes');
  const [documentosPendientes, setDocumentosPendientes] = useState<DocumentoDB[]>([]);
  const [indiceDocumentoActual, setIndiceDocumentoActual] = useState<number>(0);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [ultimoNumeroAsiento, setUltimoNumeroAsiento] = useState<string>('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Convert database format to Documento interface format
  const mapDocumentoToInterface = (doc: DocumentoDB): Documento => {
    return {
      id: doc.id,
      nombre: doc.nombre,
      clienteId: doc.cliente_id,
      asesorId: null,
      tipo: doc.tipo as any,
      estado: doc.estado as any,
      fechaSubida: new Date(doc.fecha_subida),
      procesadoIA: doc.procesado_ia,
      tamaño: doc.tamanio,
      urlArchivo: doc.url_archivo,
      nroAsientoERP: doc.nro_asiento_erp,
      datosIA: doc.datos_ia,
    };
  };
  
  const [formularioAsiento, setFormularioAsiento] = useState({
    tipoDocumento: '',
    asiento: '',
    notas: '',
  });

  const loadUnprocessedDocuments = useCallback(async () => {
    try {
      setLoadingData(true);
      
      if (!user?.id) {
        console.error('No user ID found');
        toast.error('Error: No se pudo obtener el ID del usuario');
        return;
      }

      console.log('Loading documents for advisor:', user.id);
      
      // Get advisor's assigned clients
      const { data: assignedClients, error: clientError } = await supabaseAdmin
        .from('asesor_cliente')
        .select('cliente_id, clientes(*)')
        .eq('asesor_id', user.id);

      if (clientError) {
        console.error('Error loading assigned clients:', clientError);
        throw clientError;
      }

      console.log('Assigned clients:', assignedClients);

      const clientIds = assignedClients?.map(ac => ac.cliente_id) || [];

      if (clientIds.length === 0) {
        console.log('No assigned clients found');
        setDocumentos([]);
        return;
      }

      // Build clients map
      const clientsMap = new Map<string, Cliente>();
      assignedClients?.forEach(ac => {
        if (ac.clientes) {
          clientsMap.set(ac.cliente_id, ac.clientes as any);
        }
      });
      setClientes(clientsMap);

      // Get all documents for manual accounting (both pending and processed)
      const { data: allDocs, error: docsError } = await supabaseAdmin
        .from('documentos')
        .select('*')
        .in('cliente_id', clientIds)
        .in('estado', ['pendiente', 'contabilizado']);

      if (docsError) {
        console.error('Error loading documents:', docsError);
        throw docsError;
      }

      console.log('All documents:', allDocs);
      setDocumentos(allDocs || []);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast.error(`Error al cargar documentos: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'asesor')) {
      router.push('/');
    }
    if (user && user.rol === 'asesor') {
      loadUnprocessedDocuments();
    }
  }, [user, loading, router, loadUnprocessedDocuments]);

  // Handle cliente query parameter
  useEffect(() => {
    if (router.query.cliente && typeof router.query.cliente === 'string' && !loadingData) {
      const clienteId = router.query.cliente;
      // Wait for clients to be loaded
      if (clientes.size > 0 && clientes.has(clienteId)) {
        setClienteSeleccionado(clienteId);
        const docsCliente = getDocumentosDelCliente(clienteId).filter(d => d.estado === 'pendiente');
        setDocumentosPendientes(docsCliente);
        setIndiceDocumentoActual(0);
        setSeleccionados(new Set());
        setVistaActual('documentos');
      }
    }
  }, [router.query.cliente, clientes, loadingData]);

  const handleVerDocumento = (doc: DocumentoDB, index?: number) => {
    setDocumentoSeleccionado(doc);
    if (index !== undefined) {
      setIndiceDocumentoActual(index);
    }
    setMostrarFormulario(true);
    // Reset form with AI data if available
    if (doc.datos_ia) {
      setFormularioAsiento({
        tipoDocumento: doc.datos_ia.tipoDocumento || '',
        asiento: doc.nro_asiento_erp || '',
        notas: doc.datos_ia.notas || '',
      });
    } else {
      setFormularioAsiento({
        tipoDocumento: '',
        asiento: '',
        notas: '',
      });
    }
  };

  const calcularSiguienteNumeroAsiento = (): string => {
    if (!formularioAsiento.asiento) return '';
    
    // Try to extract a number from the current asiento value
    const match = formularioAsiento.asiento.match(/(\d+)$/);
    if (match) {
      const numero = parseInt(match[1], 10);
      const siguienteNumero = numero + 1;
      // Replace the last number with the next one
      return formularioAsiento.asiento.replace(/\d+$/, siguienteNumero.toString());
    }
    
    // If it's just a number, increment it
    const asNumero = parseInt(formularioAsiento.asiento, 10);
    if (!isNaN(asNumero)) {
      return (asNumero + 1).toString();
    }
    
    return formularioAsiento.asiento;
  };

  const handleSiguienteDocumento = () => {
    // Save the current asiento number for increment
    const siguienteNumero = calcularSiguienteNumeroAsiento();
    
    if (indiceDocumentoActual < documentosPendientes.length - 1) {
      const siguiente = documentosPendientes[indiceDocumentoActual + 1];
      setIndiceDocumentoActual(indiceDocumentoActual + 1);
      setDocumentoSeleccionado(siguiente);
      
      // Pre-fill the form with incremented asiento number
      setFormularioAsiento({
        tipoDocumento: formularioAsiento.tipoDocumento, // Keep same type
        asiento: siguienteNumero,
        notas: '',
      });
    } else {
      // No more documents
      toast.success('No hay más documentos pendientes');
      setMostrarFormulario(false);
      setDocumentoSeleccionado(null);
    }
  };

  const handleTerminar = () => {
    setMostrarFormulario(false);
    setDocumentoSeleccionado(null);
    // Stay in documents list view
  };

  const handleCrearIncidencia = async () => {
    try {
      if (!documentoSeleccionado) return;

      // Validate that notes are provided
      if (!formularioAsiento.notas || !formularioAsiento.notas.trim()) {
        toast.error('Por favor explica el motivo de la incidencia en el campo Notas');
        return;
      }

      if (!user?.id) {
        toast.error('No se pudo obtener el ID del usuario');
        return;
      }

      // Create the incidencia
      const incidenciaId = await createIncidencia({
        documentoId: documentoSeleccionado.id,
        clienteId: documentoSeleccionado.cliente_id,
        asesorId: user.id,
        estado: 'nueva',
        origen: 'asesor',
      });

      // Add the first message with the notes
      await addMensajeIncidencia(incidenciaId, {
        usuarioId: user.id,
        rol: 'asesor',
        mensaje: formularioAsiento.notas.trim(),
        esIA: false,
      });

      // Update document status to 'incidencia'
      const response = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentoId: documentoSeleccionado.id,
          updates: {
            estado: 'incidencia',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al actualizar el estado del documento');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar el estado del documento');
      }

      toast.success('Incidencia creada correctamente. El documento ha sido marcado como incidencia.');

      // Remove from pending list
      const nuevaLista = documentosPendientes.filter(d => d.id !== documentoSeleccionado.id);
      setDocumentosPendientes(nuevaLista);

      // Reload documents
      await loadUnprocessedDocuments();

      // Auto-navigate to next document or close
      if (nuevaLista.length > 0) {
        const siguienteDoc = indiceDocumentoActual < nuevaLista.length 
          ? nuevaLista[indiceDocumentoActual] 
          : nuevaLista[nuevaLista.length - 1];
        
        setDocumentoSeleccionado(siguienteDoc);
        
        // Reset form
        setFormularioAsiento({
          tipoDocumento: '',
          asiento: '',
          notas: '',
        });
      } else {
        toast('No hay más documentos pendientes');
        handleVolverAClientes();
        
        // Reset form
        setFormularioAsiento({
          tipoDocumento: '',
          asiento: '',
          notas: '',
        });
      }
    } catch (error: any) {
      console.error('Error creating incidencia:', error);
      const errorMessage = error.message || 'Error desconocido al crear la incidencia';
      toast.error(`Error: ${errorMessage}`);
    }
  };

  const handleEliminarDocumentoActual = async () => {
    if (!documentoSeleccionado) return;
    
    if (!confirm('¿Estás seguro de que deseas eliminar este documento?')) {
      return;
    }

    try {
      const response = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoId: documentoSeleccionado.id }),
      });

      if (!response.ok) {
        throw new Error('Error al eliminar el documento');
      }

      toast.success('Documento eliminado');
      
      // Remove from pending list
      const nuevaLista = documentosPendientes.filter(d => d.id !== documentoSeleccionado.id);
      setDocumentosPendientes(nuevaLista);
      
      // Reload all documents
      await loadUnprocessedDocuments();
      
      // Move to next document or close
      if (nuevaLista.length > 0) {
        if (indiceDocumentoActual < nuevaLista.length) {
          handleVerDocumento(nuevaLista[indiceDocumentoActual], indiceDocumentoActual);
        } else {
          handleVerDocumento(nuevaLista[nuevaLista.length - 1], nuevaLista.length - 1);
        }
      } else {
        toast('No hay más documentos pendientes');
        handleVolverAClientes();
      }
    } catch (error: any) {
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };


  const handleGuardarAsiento = async () => {
    try {
      if (!documentoSeleccionado) return;

      // Validate required fields
      if (!formularioAsiento.tipoDocumento) {
        toast.error('Por favor selecciona el tipo de documento');
        return;
      }
      if (!formularioAsiento.asiento) {
        toast.error('Por favor ingresa el número de asiento');
        return;
      }

      // Build datosIA object from form data for archiving
      const existingDatosIA = documentoSeleccionado.datos_ia || {};
      const datosIA = {
        ...existingDatosIA,
        tipoDocumento: formularioAsiento.tipoDocumento,
        notas: formularioAsiento.notas,
        nivelConfianza: 100, // Manual entry has 100% confidence
      };

      // Update document status via API endpoint
      let response: Response;
      try {
        response = await fetch('/api/documents/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentoId: documentoSeleccionado.id,
            updates: {
              estado: 'contabilizado',
              procesadoIA: true,
              nroAsientoERP: formularioAsiento.asiento,
              datosIA: datosIA,
            },
          }),
        });
      } catch (fetchError: any) {
        console.error('Network error:', fetchError);
        throw new Error(
          'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.'
        );
      }

      if (!response.ok) {
        let errorMessage = 'Error al actualizar el documento';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar el documento');
      }

      // Create incidencia if notes are provided
      if (formularioAsiento.notas && formularioAsiento.notas.trim()) {
        try {
          if (!user?.id) {
            throw new Error('No se pudo obtener el ID del usuario');
          }

          // Create the incidencia
          const incidenciaId = await createIncidencia({
            documentoId: documentoSeleccionado.id,
            clienteId: documentoSeleccionado.cliente_id,
            asesorId: user.id,
            estado: 'nueva',
            origen: 'asesor',
          });

          // Add the first message with the notes
          await addMensajeIncidencia(incidenciaId, {
            usuarioId: user.id,
            rol: 'asesor',
            mensaje: formularioAsiento.notas.trim(),
            esIA: false,
          });

          toast.success('Documento contabilizado y incidencia creada');
        } catch (incidenciaError: any) {
          console.error('Error creating incidencia:', incidenciaError);
          // Don't fail the whole operation if incidencia creation fails
          toast.error(`Documento contabilizado, pero error al crear incidencia: ${incidenciaError.message}`);
        }
      } else {
        toast.success('Documento contabilizado y enviado a ERP Cegid Diez');
      }
      
      // Calculate next asiento number
      const siguienteNumero = calcularSiguienteNumeroAsiento();
      
      // Remove from pending list
      const nuevaLista = documentosPendientes.filter(d => d.id !== documentoSeleccionado.id);
      setDocumentosPendientes(nuevaLista);
      
      // Reload documents
      await loadUnprocessedDocuments();
      
      // Auto-navigate to next document
      if (nuevaLista.length > 0) {
        const siguienteDoc = indiceDocumentoActual < nuevaLista.length 
          ? nuevaLista[indiceDocumentoActual] 
          : nuevaLista[nuevaLista.length - 1];
        
        setDocumentoSeleccionado(siguienteDoc);
        
        // Pre-fill form with incremented asiento
        setFormularioAsiento({
          tipoDocumento: formularioAsiento.tipoDocumento, // Keep same type
          asiento: siguienteNumero,
          notas: '',
        });
      } else {
        toast('No hay más documentos pendientes');
        handleVolverAClientes();
        
        // Reset form
        setFormularioAsiento({
          tipoDocumento: '',
          asiento: '',
          notas: '',
        });
      }
    } catch (error: any) {
      console.error('Error saving entry:', error);
      const errorMessage = error.message || 'Error desconocido al guardar el asiento contable';
      toast.error(`Error: ${errorMessage}`);
    }
  };

  const handleEliminarSeleccionados = async () => {
    if (seleccionados.size === 0) {
      toast.error('No hay documentos seleccionados');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar ${seleccionados.size} documento(s)?`)) {
      return;
    }

    setBulkActionLoading(true);
    toast.loading('Eliminando...');
    try {
      const ids = Array.from(seleccionados);
      let ok = 0;
      let err = 0;
      for (const docId of ids) {
        try {
          const res = await fetch('/api/documents/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentoId: docId }),
          });
          if (res.ok) ok++;
          else throw new Error();
        } catch {
          err++;
        }
      }
      toast.dismiss();
      if (err) toast.error(`Eliminados: ${ok}. Fallos: ${err}`);
      else toast.success(`${ok} documento(s) eliminado(s)`);
      setSeleccionados(new Set());
      await loadUnprocessedDocuments();
      if (clienteSeleccionado) {
        const docsCliente = getDocumentosDelCliente(clienteSeleccionado).filter(d => d.estado === 'pendiente');
        setDocumentosPendientes(docsCliente);
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error('Error al eliminar documentos');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDescargarZip = async () => {
    if (seleccionados.size === 0) {
      toast.error('No hay documentos seleccionados');
      return;
    }

    const ids = Array.from(seleccionados);
    setBulkActionLoading(true);
    toast.loading('Preparando ZIP...');
    try {
      const res = await fetch('/api/documents/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoIds: ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al descargar ZIP');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentos-contabilizacion-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success('ZIP descargado');
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Error al descargar ZIP');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleSeleccion = (docId: string) => {
    const newSeleccionados = new Set(seleccionados);
    if (newSeleccionados.has(docId)) {
      newSeleccionados.delete(docId);
    } else {
      newSeleccionados.add(docId);
    }
    setSeleccionados(newSeleccionados);
  };

  const handleContabilizarDocumento = async (doc: DocumentoDB, index: number) => {
    handleVerDocumento(doc, index);
  };

  const handleEliminarDocumento = async (docId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este documento?')) {
      return;
    }

    try {
      const response = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoId: docId }),
      });

      if (!response.ok) {
        throw new Error('Error al eliminar el documento');
      }

      toast.success('Documento eliminado');
      await loadUnprocessedDocuments();
      
      // Update pending documents list
      if (clienteSeleccionado) {
        const docsCliente = getDocumentosDelCliente(clienteSeleccionado).filter(d => d.estado === 'pendiente');
        setDocumentosPendientes(docsCliente);
      }
    } catch (error: any) {
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  const getClienteById = (id: string): Cliente | undefined => {
    return clientes.get(id);
  };

  // Calculate document stats per client
  interface ClienteStats {
    cliente: Cliente;
    totalDocumentos: number;
    pendientes: number;
    procesados: number;
    ultimoDocumento?: Date;
  }

  const getClienteStats = (): ClienteStats[] => {
    const statsMap = new Map<string, ClienteStats>();

    // Initialize stats for all clients
    clientes.forEach((cliente, clienteId) => {
      statsMap.set(clienteId, {
        cliente,
        totalDocumentos: 0,
        pendientes: 0,
        procesados: 0,
      });
    });

    // Count documents by client
    documentos.forEach((doc) => {
      const stats = statsMap.get(doc.cliente_id);
      if (stats) {
        stats.totalDocumentos++;
        if (doc.estado === 'contabilizado') {
          stats.procesados++;
        } else {
          stats.pendientes++;
        }
        const docDate = new Date(doc.fecha_subida);
        if (!stats.ultimoDocumento || docDate > stats.ultimoDocumento) {
          stats.ultimoDocumento = docDate;
        }
      }
    });

    // Convert to array and show all clients (even those without documents)
    return Array.from(statsMap.values())
      .sort((a, b) => {
        // Sort by pending documents first (descending), then by total documents
        if (b.pendientes !== a.pendientes) {
          return b.pendientes - a.pendientes;
        }
        return b.totalDocumentos - a.totalDocumentos;
      });
  };

  const handleClienteClick = (clienteId: string) => {
    setClienteSeleccionado(clienteId);
    const docsCliente = getDocumentosDelCliente(clienteId).filter(d => d.estado === 'pendiente');
    setDocumentosPendientes(docsCliente);
    setIndiceDocumentoActual(0);
    setSeleccionados(new Set());
    setVistaActual('documentos');
    // Update URL without reloading
    router.push(`/asesor/contabilizacion-manual?cliente=${clienteId}`, undefined, { shallow: true });
  };

  const handleVolverAClientes = () => {
    setClienteSeleccionado(null);
    setVistaActual('clientes');
    setMostrarFormulario(false);
    setDocumentoSeleccionado(null);
    setDocumentosPendientes([]);
    setIndiceDocumentoActual(0);
    setSeleccionados(new Set());
  };

  // Helper function to get document type display info
  const getTipoDocumentoInfo = (tipo: string) => {
    if (tipo === 'emitida_pdf') return 'Facturas emitidas (PDF)';
    if (tipo === 'recibida_pdf') return 'Factura recibidas (PDF)';
    if (tipo === 'emitida_excel') return 'Facturas emitidas (Excel)';
    if (tipo === 'recibida_excel') return 'Facturas recibidas (Excel)';
    return 'Otros';
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedDocumentos = (docs: DocumentoDB[]): DocumentoDB[] => {
    if (!sortColumn) return docs;

    return [...docs].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'documento':
          aValue = a.nombre.toLowerCase();
          bValue = b.nombre.toLowerCase();
          break;
        case 'empresa':
          aValue = getClienteById(a.cliente_id)?.razon_social?.toLowerCase() || '';
          bValue = getClienteById(b.cliente_id)?.razon_social?.toLowerCase() || '';
          break;
        case 'tipo':
          aValue = getTipoDocumentoInfo(a.tipo).toLowerCase();
          bValue = getTipoDocumentoInfo(b.tipo).toLowerCase();
          break;
        case 'subido':
          aValue = new Date(a.fecha_subida).getTime();
          bValue = new Date(b.fecha_subida).getTime();
          break;
        case 'estado':
          aValue = a.estado.toLowerCase();
          bValue = b.estado.toLowerCase();
          break;
        case 'asesor':
          aValue = user?.nombre?.toLowerCase() || '';
          bValue = user?.nombre?.toLowerCase() || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getDocumentosDelCliente = (clienteId: string): DocumentoDB[] => {
    const filtered = documentos.filter((doc) => doc.cliente_id === clienteId);
    return getSortedDocumentos(filtered);
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

  const clienteStats = getClienteStats();
  const totalPendientes = documentos.filter(d => d.estado !== 'contabilizado').length;
  const totalProcesados = documentos.filter(d => d.estado === 'contabilizado').length;

  return (
    <Layout rol="asesor">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contabilización Manual</h1>
          <p className="text-gray-600 mt-1">Registro manual de facturas e integración ERP</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Pendientes de Contabilizar</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{totalPendientes}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Sin Procesar IA</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{totalPendientes}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Integración ERP</div>
            <div className="text-sm font-medium text-success mt-1">✓ Cegid Diez</div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Contabilización Manual</h3>
              <p className="text-sm text-yellow-800">
                Estos documentos no fueron procesados automáticamente por la IA y requieren entrada manual.
                Asegúrate de verificar todos los datos antes de enviar a ERP.
              </p>
            </div>
          </div>
        </div>

        {vistaActual === 'clientes' ? (
          // Customer cards view
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clienteStats.map((stats) => {
              const iniciales = stats.cliente.razon_social
                .split(' ')
                .map((palabra) => palabra[0])
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
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-lg">
                      {iniciales}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {stats.cliente.razon_social}
                      </h3>
                      <p className="text-sm text-gray-600">{stats.cliente.nif}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Último documento</span>
                      <span className="text-sm text-gray-900">
                        {stats.ultimoDocumento
                          ? `hace ${Math.floor(
                              (Date.now() - stats.ultimoDocumento.getTime()) /
                                (1000 * 60 * 60 * 24)
                            )} días`
                          : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-orange-600">
                        {stats.pendientes}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">a contabilizar</div>
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-green-600">
                        {stats.procesados}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">procesados</div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClienteClick(stats.cliente.id);
                    }}
                    className="btn btn-sm btn-asesor w-full mt-4"
                  >
                    Trabajar
                  </button>
                </div>
              );
            })}

            {clienteStats.length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No tienes clientes asignados
                </h3>
                <p className="text-gray-600">
                  No hay clientes asignados a tu cuenta.
                </p>
              </div>
            )}
          </div>
        ) : (
          // Documents view for selected client
          <>
            {clienteSeleccionado && (
              <>
                <div className="card bg-white">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleVolverAClientes}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        ← Volver a Clientes
                      </button>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Gestor de Contabilizacion documental <span className="text-orange-500">Trabajar</span>
                        </h2>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {/* <button
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border-b-2 border-transparent"
                      >
                        Contabilizar
                      </button> */}
                      <button
                        className="px-4 py-2 text-sm text-orange-500 font-medium border-b-2 border-orange-500"
                      >
                        Trabajar
                      </button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-700">
                      <span 
                        className="font-semibold text-orange-500 cursor-pointer hover:text-orange-600 hover:underline"
                        onClick={() => handleClienteClick(clienteSeleccionado)}
                        title="Click para refrescar la vista de este cliente"
                      >
                        ASESOR {user?.nombre?.toUpperCase() || 'NATALIO'}
                      </span> EMPRESA O AUTÓNOMO <span 
                        className="font-semibold cursor-pointer hover:text-gray-900 hover:underline"
                        onClick={() => handleClienteClick(clienteSeleccionado)}
                        title="Click para refrescar la vista de este cliente"
                      >
                        {getClienteById(clienteSeleccionado)?.razon_social?.toUpperCase()}
                      </span> CON IDENTIFICACIÓN FISCAL <span 
                        className="font-semibold cursor-pointer hover:text-gray-900 hover:underline"
                        onClick={() => handleClienteClick(clienteSeleccionado)}
                        title="Click para refrescar la vista de este cliente"
                      >
                        {getClienteById(clienteSeleccionado)?.nif}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                    <h3 className="text-base font-semibold text-gray-900 uppercase">
                      Documentos Pendientes de Contabilizar
                    </h3>
                  </div>

                  {documentosPendientes.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                                <input
                                  type="checkbox"
                                  checked={seleccionados.size === documentosPendientes.length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSeleccionados(new Set(documentosPendientes.map(d => d.id)));
                                    } else {
                                      setSeleccionados(new Set());
                                    }
                                  }}
                                  className="rounded"
                                />
                              </th>
                              <th 
                                className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort('documento')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Documento</span>
                                  {sortColumn === 'documento' && (
                                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort('empresa')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Nombre Empresa</span>
                                  {sortColumn === 'empresa' && (
                                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort('tipo')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Tipo de Documento</span>
                                  {sortColumn === 'tipo' && (
                                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort('subido')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Subido</span>
                                  {sortColumn === 'subido' && (
                                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort('estado')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Estado</span>
                                  {sortColumn === 'estado' && (
                                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort('asesor')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Asesor</span>
                                  {sortColumn === 'asesor' && (
                                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSortedDocumentos(documentosPendientes).map((doc, index) => {
                              const cliente = getClienteById(doc.cliente_id);
                              return (
                                <tr
                                  key={doc.id}
                                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                  <td className="py-3 px-4">
                                    <input
                                      type="checkbox"
                                      checked={seleccionados.has(doc.id)}
                                      onChange={() => toggleSeleccion(doc.id)}
                                      className="rounded"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                  <td className="py-3 px-4">
                                    <button
                                      onClick={() => window.open(doc.url_archivo, '_blank')}
                                      className="text-blue-600 hover:text-blue-800 hover:underline text-left text-sm"
                                    >
                                      {doc.nombre}
                                    </button>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-900">
                                    <span 
                                      className="cursor-pointer hover:text-blue-600 hover:underline"
                                      onClick={() => handleClienteClick(doc.cliente_id)}
                                      title="Click para trabajar con este cliente"
                                    >
                                      {cliente?.razon_social || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-700">
                                    {getTipoDocumentoInfo(doc.tipo)}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600">
                                    {new Date(doc.fecha_subida).toLocaleString('es-ES', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                      En revisión
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-900">
                                    <span 
                                      className="cursor-pointer hover:text-blue-600 hover:underline"
                                      onClick={() => handleClienteClick(doc.cliente_id)}
                                      title="Click para trabajar con este cliente"
                                    >
                                      {user?.nombre || 'NATALIO'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center justify-end space-x-2">
                                      <button
                                        onClick={() => window.open(doc.url_archivo, '_blank')}
                                        className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50"
                                        title="Ver documento"
                                      >
                                        👁️
                                      </button>
                                      <button
                                        onClick={() => handleEliminarDocumento(doc.id)}
                                        className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50"
                                        title="Eliminar"
                                      >
                                        🗑️
                                      </button>
                                      <button
                                        onClick={() => handleContabilizarDocumento(doc, index)}
                                        className="text-green-600 hover:text-green-800 p-1.5 rounded hover:bg-green-50"
                                        title="Contabilizar"
                                      >
                                        ✍️
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Bottom action buttons */}
                      <div className="mt-4 flex justify-start">
                        {seleccionados.size > 0 && (
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">
                              {seleccionados.size} documento(s) seleccionado(s)
                            </span>
                            <button
                              onClick={handleDescargarZip}
                              disabled={bulkActionLoading}
                              className="btn btn-sm btn-asesor"
                            >
                              📦 Descargar ZIP
                            </button>
                            <button
                              onClick={handleEliminarSeleccionados}
                              disabled={bulkActionLoading}
                              className="btn btn-sm btn-danger"
                            >
                              Eliminar seleccionados
                            </button>
                            <button
                              onClick={() => setSeleccionados(new Set())}
                              disabled={bulkActionLoading}
                              className="btn btn-sm btn-secondary"
                            >
                              Deseleccionar
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">✅</div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No hay documentos pendientes
                      </h3>
                      <p className="text-gray-600">
                        Todos los documentos de este cliente han sido contabilizados.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <Dialog
          isOpen={mostrarFormulario && !!documentoSeleccionado}
          onClose={() => {
            setMostrarFormulario(false);
            setDocumentoSeleccionado(null);
          }}
          title={`Documento a contabilizar`}
          maxWidth="7xl"
        >
          {documentoSeleccionado && (
            <div className="grid grid-cols-12 gap-6 h-[70vh]">
              {/* Left Side - Form */}
              <div className="col-span-4 flex flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto">
                  <div className="card bg-gray-50 border-gray-200 p-3">
                    <h4 className="font-semibold text-gray-900 mb-1 text-sm">
                      Gestión de los documentos a contabilizar.
                    </h4>
                    <p className="text-gray-700 text-xs">
                      ¿Incidencia?
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo documento: <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="input w-full"
                      value={formularioAsiento.tipoDocumento}
                      onChange={(e) => setFormularioAsiento({ ...formularioAsiento, tipoDocumento: e.target.value })}
                    >
                      <option value="">Seleccionar tipo...</option>
                      <option value="emitida_pdf">Facturas emitidas (PDF)</option>
                      <option value="recibida_pdf">Factura recibidas (PDF)</option>
                      <option value="emitida_excel">Facturas emitidas (Excel)</option>
                      <option value="recibida_excel">Facturas recibidas (Excel)</option>
                      <option value="otro">Otros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Asiento: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="input w-full"
                      value={formularioAsiento.asiento}
                      onChange={(e) => setFormularioAsiento({ ...formularioAsiento, asiento: e.target.value })}
                      placeholder="Número de asiento"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas: <span className="text-red-500">*</span> (para crear incidencia)
                    </label>
                    <textarea
                      className="input w-full"
                      rows={4}
                      value={formularioAsiento.notas}
                      onChange={(e) => setFormularioAsiento({ ...formularioAsiento, notas: e.target.value })}
                      placeholder="El obligatorio explicar el motivo de la incidencia. El cliente recibirá esta nota."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si escribes notas y haces clic en "Crear Incidencia", el documento se marcará como incidencia sin contabilizar.
                    </p>
                  </div>
                </div>

                {/* Buttons at bottom of left panel */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <button
                      onClick={handleTerminar}
                      className="btn btn-sm flex-1"
                      style={{ 
                        backgroundColor: '#6b7280', 
                        color: 'white'
                      }}
                    >
                      Terminar
                    </button>
                    <button
                      onClick={handleSiguienteDocumento}
                      className="btn btn-sm flex-1"
                      style={{ 
                        backgroundColor: '#3b82f6', 
                        color: 'white'
                      }}
                      disabled={indiceDocumentoActual >= documentosPendientes.length - 1}
                    >
                      {indiceDocumentoActual >= documentosPendientes.length - 1 
                        ? 'Último documento' 
                        : formularioAsiento.asiento 
                          ? `Siguiente ${calcularSiguienteNumeroAsiento()}, quedan ${documentosPendientes.length - indiceDocumentoActual - 1}`
                          : `Siguiente, quedan ${documentosPendientes.length - indiceDocumentoActual - 1}`}
                    </button>
                  </div>
                  
                  {/* Create Incidencia Button - Only requires notes */}
                  <div className="mt-2">
                    <button
                      onClick={handleCrearIncidencia}
                      className="btn btn-sm w-full"
                      style={{ 
                        backgroundColor: '#f59e0b', 
                        color: 'white'
                      }}
                      disabled={!formularioAsiento.notas || !formularioAsiento.notas.trim()}
                    >
                      ⚠️ Crear Incidencia
                    </button>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Marca el documento como incidencia (no requiere contabilizar)
                    </p>
                  </div>

                  {/* Contabilizar Button - Requires tipoDocumento and asiento */}
                  <div className="mt-2">
                    <button
                      onClick={handleGuardarAsiento}
                      className="btn btn-sm w-full"
                      style={{ 
                        backgroundColor: '#10b981', 
                        color: 'white'
                      }}
                      disabled={!formularioAsiento.tipoDocumento || !formularioAsiento.asiento}
                    >
                      Contabilizar
                    </button>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      {formularioAsiento.notas && formularioAsiento.notas.trim() 
                        ? 'También creará una incidencia con las notas'
                        : 'Requiere tipo documento y asiento'}
                    </p>
                  </div>

                  <div className="mt-2">
                    <button
                      onClick={handleEliminarDocumentoActual}
                      className="btn btn-sm w-full"
                      style={{ 
                        backgroundColor: '#ef4444', 
                        color: 'white'
                      }}
                    >
                      🗑️ Eliminar Documento
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side - Document Viewer */}
              <div className="col-span-8 border border-gray-300 rounded-lg bg-white overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Documento a contabilizar</span>
                      <br />
                      <span className="text-xs">del cliente {getClienteById(documentoSeleccionado.cliente_id)?.razon_social || 'N/A'}</span>
                    </p>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {documentoSeleccionado.url_archivo && (
                      documentoSeleccionado.url_archivo.toLowerCase().endsWith('.pdf') ? (
                        <iframe
                          src={documentoSeleccionado.url_archivo}
                          className="w-full h-full"
                          title="Document Viewer"
                        />
                      ) : documentoSeleccionado.url_archivo.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <div className="h-full overflow-auto p-4 bg-gray-100 flex items-center justify-center">
                          <img
                            src={documentoSeleccionado.url_archivo}
                            alt="Document"
                            className="max-w-full h-auto"
                          />
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-6xl mb-4">📄</div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              {documentoSeleccionado.nombre}
                            </h3>
                            <p className="text-gray-600 mb-4">Vista previa no disponible</p>
                            <button
                              onClick={() => window.open(documentoSeleccionado.url_archivo, '_blank')}
                              className="btn btn-primary"
                            >
                              Abrir Documento
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </Layout>
  );
}
