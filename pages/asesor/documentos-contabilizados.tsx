import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import FilterBar, { Filter } from '@/components/FilterBar';
import DocumentViewer from '@/components/DocumentViewer';
import toast from 'react-hot-toast';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { Download, Trash } from 'lucide-react';

export default function DocumentosContabilizados() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [mostrarVisor, setMostrarVisor] = useState(false);
  const [documentoActual, setDocumentoActual] = useState<any>(null);
  const [mostrarFinanzas, setMostrarFinanzas] = useState(false);
  const [documentoFinanzas, setDocumentoFinanzas] = useState<any>(null);
  const [formFinanzas, setFormFinanzas] = useState({
    numeroFactura: '',
    fecha: '',
    importeTotal: '',
    proveedor: '',
    tipo: 'emitida_pdf',
  });
  const [loadingData, setLoadingData] = useState(true);
  const [mostrarModalIncidencia, setMostrarModalIncidencia] = useState(false);
  const [documentoIncidencia, setDocumentoIncidencia] = useState<any>(null);
  const [mensajeIncidencia, setMensajeIncidencia] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const loadPostedDocuments = useCallback(async () => {
    try {
      setLoadingData(true);
      
      const { data: assignedClients } = await supabaseAdmin
        .from('asesor_cliente')
        .select('cliente_id, clientes(*)')
        .eq('asesor_id', user?.id);

      const clientIds = assignedClients?.map(ac => ac.cliente_id) || [];
      setClientes(assignedClients?.map(ac => ac.clientes) || []);

      const { data: docs } = await supabaseAdmin
        .from('documentos')
        .select('*, clientes(*)')
        .in('cliente_id', clientIds)
        .eq('estado', 'contabilizado')
        .order('created_at', { ascending: false });

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
      loadPostedDocuments();
    }
  }, [user, loading, router, loadPostedDocuments]);

  const filterConfig: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'Nombre, número de asiento...',
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
        { value: 'emitida_pdf', label: 'Facturas emitidas (PDF)' },
        { value: 'recibida_pdf', label: 'Factura recibidas (PDF)' },
        { value: 'emitida_excel', label: 'Facturas emitidas (Excel)' },
        { value: 'recibida_excel', label: 'Facturas recibidas (Excel)' },
        { value: 'otro', label: 'Otros' },
      ],
    },
  ];

  // Helper function to get document type display info
  const getTipoDocumentoInfo = (tipo: string) => {
    if (tipo === 'emitida_pdf') return 'Facturas emitidas (PDF)';
    if (tipo === 'recibida_pdf') return 'Factura recibidas (PDF)';
    if (tipo === 'emitida_excel') return 'Facturas emitidas (Excel)';
    if (tipo === 'recibida_excel') return 'Facturas recibidas (Excel)';
    return tipo || 'Otros';
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedDocumentos = (docs: any[]): any[] => {
    if (!sortColumn) return docs;

    return [...docs].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'documento':
          aValue = a.nombre.toLowerCase();
          bValue = b.nombre.toLowerCase();
          break;
        case 'cliente':
          aValue = (a.clientes?.razon_social || '').toLowerCase();
          bValue = (b.clientes?.razon_social || '').toLowerCase();
          break;
        case 'tipo':
          aValue = getTipoDocumentoInfo(a.tipo).toLowerCase();
          bValue = getTipoDocumentoInfo(b.tipo).toLowerCase();
          break;
        case 'asiento':
          aValue = (a.nro_asiento_erp || '').toLowerCase();
          bValue = (b.nro_asiento_erp || '').toLowerCase();
          break;
        case 'fecha':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const documentosFiltrados = documentos.filter(doc => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      if (!doc.nombre.toLowerCase().includes(busqueda) && 
          !doc.nro_asiento_erp?.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.cliente && doc.cliente_id !== filtros.cliente) return false;
    if (filtros.tipo && doc.tipo !== filtros.tipo) return false;
    return true;
  });

  const handleOpenIncidentModal = (doc: any) => {
    setDocumentoIncidencia(doc);
    setMensajeIncidencia('');
    setMostrarModalIncidencia(true);
  };

  const handleCloseIncidentModal = () => {
    setMostrarModalIncidencia(false);
    setDocumentoIncidencia(null);
    setMensajeIncidencia('');
  };

  const handleSubmitIncident = async () => {
    if (!mensajeIncidencia.trim()) {
      toast.error('Por favor describe el problema');
      return;
    }

    try {
      const { error: incidentError } = await supabase
        .from('incidencias')
        .insert({
          documento_id: documentoIncidencia.id,
          cliente_id: documentoIncidencia.cliente_id,
          asesor_id: user?.id,
          estado: 'nueva',
          origen: 'asesor'
        });

      if (incidentError) throw incidentError;

      const { data: incidencia } = await supabase
        .from('incidencias')
        .select('id')
        .eq('documento_id', documentoIncidencia.id)
        .single();

      if (incidencia) {
        await supabase
          .from('mensajes_incidencia')
          .insert({
            incidencia_id: incidencia.id,
            usuario_id: user?.id,
            mensaje: mensajeIncidencia
          });
      }

      toast.success('Incidencia creada correctamente');
      handleCloseIncidentModal();
      router.push('/asesor/incidencias');
    } catch (error) {
      console.error('Error creating incident:', error);
      toast.error('Error al crear incidencia');
    }
  };

  const openFinanzasModal = (doc: any) => {
    const datos = doc.datos_ia || {};
    setDocumentoFinanzas(doc);
    setFormFinanzas({
      numeroFactura: datos.numeroFactura || '',
      fecha: datos.fecha || datos.fechaFactura || doc.fecha_subida?.slice(0, 10) || '',
      importeTotal: (datos.importeTotal || datos.totalFactura || '').toString(),
      proveedor: datos.proveedor || datos.razonSocialEmisor || '',
      tipo: doc.tipo || 'emitida_pdf',
    });
    setMostrarFinanzas(true);
  };

  const handleGuardarFinanzas = async () => {
    if (!documentoFinanzas) return;
    try {
      const importe = parseFloat(formFinanzas.importeTotal || '0');
      if (!importe || importe <= 0) {
        toast.error('Indica un importe total mayor a 0');
        return;
      }

      const datosIA = {
        ...(documentoFinanzas.datos_ia || {}),
        numeroFactura: formFinanzas.numeroFactura,
        fecha: formFinanzas.fecha,
        fechaFactura: formFinanzas.fecha,
        importeTotal: importe,
        totalFactura: importe,
        proveedor: formFinanzas.proveedor,
        razonSocialEmisor: formFinanzas.proveedor,
      };

      const response = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentoId: documentoFinanzas.id,
          updates: {
            estado: 'contabilizado',
            procesadoIA: true,
            tipo: formFinanzas.tipo,
            datosIA,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'No se pudo guardar los datos financieros');
      }

      toast.success('Datos financieros actualizados');
      setMostrarFinanzas(false);
      setDocumentoFinanzas(null);
      await loadPostedDocuments();
    } catch (error: any) {
      console.error('Error updating financial data:', error);
      toast.error(error.message || 'Error al actualizar los datos');
    }
  };

  const handleEliminarDocumento = async (doc: any) => {
    if (!confirm('¿Eliminar este documento contabilizado? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoId: doc.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      toast.success('Documento eliminado');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
      await loadPostedDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error(error.message || 'No se pudo eliminar el documento');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const all = documentosFiltrados.map((d) => d.id);
    const allSelected = all.length > 0 && all.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(all));
  };

  const handleDownloadZip = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
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
      a.download = `documentos-contabilizados-${new Date().toISOString().slice(0, 10)}.zip`;
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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} documento(s) seleccionado(s)? Esta acción no se puede deshacer.`)) return;
    setBulkActionLoading(true);
    toast.loading('Eliminando...');
    let ok = 0;
    let err = 0;
    for (const id of ids) {
      try {
        const res = await fetch('/api/documents/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentoId: id }),
        });
        const data = await res.json();
        if (res.ok) ok++;
        else throw new Error(data.error);
      } catch {
        err++;
      }
    }
    toast.dismiss();
    if (err) toast.error(`Eliminados: ${ok}. Fallos: ${err}`);
    else toast.success(`${ok} documento(s) eliminado(s)`);
    setSelectedIds(new Set());
    await loadPostedDocuments();
    setBulkActionLoading(false);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-asesor"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Documentos Contabilizados - Externaliza2</title>
      </Head>
      <Layout rol="asesor">
        <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Documentos Contabilizados</h1>
              <p className="text-gray-600 mt-1">{documentosFiltrados.length} documento(s)</p>
            </div>
            <button
              onClick={() => router.push('/asesor/documentos-pendientes')}
              className="btn btn-asesor"
            >
              Ver Pendientes
            </button>
          </div>

          <FilterBar
            filters={filterConfig}
            values={filtros}
            onChange={(key, value) => setFiltros({ ...filtros, [key]: value })}
            onClear={() => setFiltros({})}
          />

          {selectedIds.size > 0 && (
            <div className="card bg-asesor/5 border border-asesor/20">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {selectedIds.size} documento(s) seleccionado(s)
                </span>
                <button
                  onClick={handleDownloadZip}
                  disabled={bulkActionLoading}
                  className="btn btn-sm btn-asesor inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar ZIP
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="btn btn-sm btn-danger inline-flex items-center gap-2"
                >
                  <Trash className="w-4 h-4" />
                  Eliminar seleccionados
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="btn btn-sm btn-secondary"
                >
                  Deseleccionar
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="overflow-x-auto">
              <table className="">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 w-10">
                      <input
                        type="checkbox"
                        checked={documentosFiltrados.length > 0 && documentosFiltrados.every((d) => selectedIds.has(d.id))}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-asesor focus:ring-asesor"
                      />
                    </th>
                    <th 
                      className="text-left p-3 cursor-pointer hover:bg-gray-100 select-none"
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
                      className="text-left p-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('cliente')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Cliente</span>
                        {sortColumn === 'cliente' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('tipo')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Tipo</span>
                        {sortColumn === 'tipo' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('asiento')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Nº Asiento</span>
                        {sortColumn === 'asiento' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('fecha')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Fecha</span>
                        {sortColumn === 'fecha' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="text-right p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedDocumentos(documentosFiltrados).map(doc => (
                    <tr key={doc.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelection(doc.id)}
                          className="rounded border-gray-300 text-asesor focus:ring-asesor"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <span>📄</span>
                          <span className="font-medium">{doc.nombre}</span>
                        </div>
                      </td>
                      <td className="p-3">{doc.clientes?.razon_social}</td>
                      <td className="p-3">{getTipoDocumentoInfo(doc.tipo)}</td>
                      <td className="p-3">{doc.nro_asiento_erp || '-'}</td>
                      <td className="p-3">
                        {new Date(doc.created_at).toLocaleDateString('es-ES')}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setDocumentoActual(doc);
                              setMostrarVisor(true);
                            }}
                            title="Ver documento"
                            className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => openFinanzasModal(doc)}
                            title="Finanzas"
                            className="text-green-600 hover:text-green-800 p-1.5 rounded hover:bg-green-50"
                          >
                            💰
                          </button>
                          <button
                            onClick={() => handleOpenIncidentModal(doc)}
                            title="Incidencia"
                            className="text-amber-600 hover:text-amber-800 p-1.5 rounded hover:bg-amber-50"
                          >
                            ⚠️
                          </button>
                          <button
                            onClick={() => handleEliminarDocumento(doc)}
                            title="Eliminar"
                            className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {mostrarVisor && documentoActual && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-2xl font-bold">{documentoActual.nombre}</h2>
                <button
                  onClick={() => {
                    setMostrarVisor(false);
                    setDocumentoActual(null);
                  }}
                  className="text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <DocumentViewer
                  documento={{
                    ...documentoActual,
                    id: documentoActual.id,
                    urlArchivo: documentoActual.url_archivo,
                    fechaSubida: documentoActual.created_at,
                    nroAsientoERP: documentoActual.nro_asiento_erp,
                    datosIA: documentoActual.datos_ia,
                    tamaño: documentoActual.tamanio,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {mostrarFinanzas && documentoFinanzas && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-2xl font-bold">Datos financieros</h2>
                <button
                  onClick={() => {
                    setMostrarFinanzas(false);
                    setDocumentoFinanzas(null);
                  }}
                  className="text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      className="input w-full"
                      value={formFinanzas.tipo}
                      onChange={(e) => setFormFinanzas({ ...formFinanzas, tipo: e.target.value })}
                    >
                      <option value="emitida">Emitida (ingreso)</option>
                      <option value="recibida">Recibida (gasto)</option>
                      <option value="gasto">Gasto</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número factura</label>
                    <input
                      className="input w-full"
                      value={formFinanzas.numeroFactura}
                      onChange={(e) => setFormFinanzas({ ...formFinanzas, numeroFactura: e.target.value })}
                      placeholder="F-2025-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      className="input w-full"
                      value={formFinanzas.fecha}
                      onChange={(e) => setFormFinanzas({ ...formFinanzas, fecha: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Importe total (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-full"
                      value={formFinanzas.importeTotal}
                      onChange={(e) => setFormFinanzas({ ...formFinanzas, importeTotal: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor/Cliente</label>
                  <input
                    className="input w-full"
                    value={formFinanzas.proveedor}
                    onChange={(e) => setFormFinanzas({ ...formFinanzas, proveedor: e.target.value })}
                    placeholder="Proveedor o cliente"
                  />
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h4 className="font-semibold text-gray-800 mb-2">Resumen</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                    <div>
                      <span className="text-gray-500 block">Importe</span>
                      <span className="font-semibold">
                        €{(parseFloat(formFinanzas.importeTotal) || 0).toLocaleString('es-ES')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Tipo</span>
                      <span className="font-semibold">{formFinanzas.tipo}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Proveedor/Cliente</span>
                      <span className="font-semibold">{formFinanzas.proveedor || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Fecha</span>
                      <span className="font-semibold">{formFinanzas.fecha || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setMostrarFinanzas(false);
                    setDocumentoFinanzas(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarFinanzas}
                  className="btn btn-success"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {mostrarModalIncidencia && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Crear Incidencia</h2>
                <p className="text-gray-600 mb-4">
                  Describe el problema encontrado en este documento:
                </p>
                <textarea
                  value={mensajeIncidencia}
                  onChange={(e) => setMensajeIncidencia(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 mb-6 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-asesor focus:border-transparent"
                  placeholder="Escribe aquí el detalle del problema..."
                  autoFocus
                />
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleCloseIncidentModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmitIncident}
                    className="px-6 py-2 bg-asesor text-white rounded-lg hover:bg-asesor-dark transition-colors"
                  >
                    Crear
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}
