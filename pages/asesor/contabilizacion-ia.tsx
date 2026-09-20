import { useState } from 'react';
import Layout from '@/components/Layout';
import { Documento } from '@/types';
import { mockDocumentos, mockClientes, getClienteById } from '@/lib/mockData';
import { useAuth } from '@/lib/authContext';
import FilterBar, { Filter } from '@/components/FilterBar';
import DocumentViewer from '@/components/DocumentViewer';
import toast from 'react-hot-toast';

export default function AsesorContabilizacionIA() {
  const { user } = useAuth();
  const clientesAsignados = mockClientes.filter(c => c.asesoresAsignados?.includes(user?.id || ''));
  const clientesIds = clientesAsignados.map(c => c.id);
  const documentosConIA = mockDocumentos.filter(d => 
    clientesIds.includes(d.clienteId) && 
    d.procesadoIA &&
    (d.estado === 'procesado_ia' || d.estado === 'validado')
  );
  
  const [documentos] = useState<Documento[]>(documentosConIA);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<Documento | null>(null);
  const [mostrarVisor, setMostrarVisor] = useState(false);

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
      options: clientesAsignados.map(c => ({ value: c.id, label: c.razonSocial })),
    },
    {
      key: 'confianza',
      label: 'Confianza IA',
      type: 'select',
      options: [
        { value: 'alta', label: 'Alta (≥95%)' },
        { value: 'media', label: 'Media (80-94%)' },
        { value: 'baja', label: 'Baja (<80%)' },
      ],
    },
  ];

  const documentosFiltrados = documentos.filter(doc => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      const cliente = getClienteById(doc.clienteId);
      if (!doc.nombre.toLowerCase().includes(busqueda) && 
          !cliente?.razonSocial.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.cliente && doc.clienteId !== filtros.cliente) return false;
    if (filtros.confianza && doc.datosIA) {
      const confianza = doc.datosIA.nivelConfianza;
      if (filtros.confianza === 'alta' && confianza < 95) return false;
      if (filtros.confianza === 'media' && (confianza < 80 || confianza >= 95)) return false;
      if (filtros.confianza === 'baja' && confianza >= 80) return false;
    }
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

  const handleValidar = (doc: Documento) => {
    toast.success(`Asiento contable validado y listo para enviar a ERP: ${doc.nombre}`);
  };

  const handleGenerarLibroRegistro = () => {
    toast.success('Generando Libro Registro automático para documentos validados...');
  };

  const estadisticas = {
    total: documentos.length,
    altaConfianza: documentos.filter(d => d.datosIA && d.datosIA.nivelConfianza >= 95).length,
    mediaConfianza: documentos.filter(d => d.datosIA && d.datosIA.nivelConfianza >= 80 && d.datosIA.nivelConfianza < 95).length,
    bajaConfianza: documentos.filter(d => d.datosIA && d.datosIA.nivelConfianza < 80).length,
    validados: documentos.filter(d => d.estado === 'validado').length,
  };

  return (
    <Layout rol="asesor">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contabilización IA</h1>
            <p className="text-gray-600 mt-1">Banco de trabajo y generación de libros registro</p>
          </div>
          <button
            onClick={handleGenerarLibroRegistro}
            className="btn btn-success"
          >
            📘 Generar Libro Registro
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{estadisticas.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Alta Confianza</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{estadisticas.altaConfianza}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Media Confianza</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{estadisticas.mediaConfianza}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Baja Confianza</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{estadisticas.bajaConfianza}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Validados</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticas.validados}</div>
          </div>
        </div>

        <FilterBar
          filters={filterConfig}
          values={filtros}
          onChange={handleFiltroChange}
          onClear={handleLimpiarFiltros}
        />

        <div className="grid grid-cols-1 gap-4">
          {documentosFiltrados.map(doc => {
            const cliente = getClienteById(doc.clienteId);
            const confianza = doc.datosIA?.nivelConfianza || 0;
            return (
              <div key={doc.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 text-4xl">📄</div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{doc.nombre}</h3>
                        <p className="text-sm text-gray-600">{cliente?.razonSocial}</p>
                      </div>
                      <span className={`badge ${
                        confianza >= 95 ? 'badge-success' :
                        confianza >= 80 ? 'badge-warning' :
                        'badge-danger'
                      }`}>
                        {confianza.toFixed(0)}% Confianza
                      </span>
                    </div>

                    {doc.datosIA && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-3 rounded-lg">
                        <div>
                          <div className="text-xs text-gray-600">Número Factura</div>
                          <div className="font-medium text-gray-900">{doc.datosIA.numeroFactura || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Proveedor/Cliente</div>
                          <div className="font-medium text-gray-900">{doc.datosIA.proveedor || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Importe Total</div>
                          <div className="font-medium text-gray-900">
                            {doc.datosIA.importeTotal 
                              ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(doc.datosIA.importeTotal)
                              : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Fecha</div>
                          <div className="font-medium text-gray-900">
                            {doc.datosIA.fecha 
                              ? new Date(doc.datosIA.fecha).toLocaleDateString('es-ES')
                              : '-'}
                          </div>
                        </div>
                      </div>
                    )}

                    {doc.datosIA?.asientoContable && (
                      <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                        <div className="text-xs text-blue-700 font-medium mb-2">Asiento Contable Propuesto (IA)</div>
                        <div className="space-y-1">
                          {doc.datosIA.asientoContable.apuntes.map((apunte, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                {apunte.cuenta} - {apunte.concepto}
                              </span>
                              <span className={apunte.debe > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {apunte.debe > 0 ? `+${apunte.debe.toFixed(2)}€` : `-${apunte.haber.toFixed(2)}€`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex flex-col space-y-2">
                    <button
                      onClick={() => handleVerDocumento(doc)}
                      className="btn btn-sm btn-asesor"
                    >
                      👁️ Ver
                    </button>
                    {doc.estado === 'procesado_ia' && (
                      <button
                        onClick={() => handleValidar(doc)}
                        className="btn btn-sm btn-success"
                      >
                        ✓ Validar
                      </button>
                    )}
                    {doc.estado === 'validado' && (
                      <span className="text-xs text-green-600 font-medium text-center">✓ Validado</span>
                    )}
                  </div>
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
                    {getClienteById(documentoSeleccionado.clienteId)?.razonSocial}
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
                <div className="grid grid-cols-2 gap-6">
                  <DocumentViewer documento={documentoSeleccionado} />
                  
                  <div className="space-y-4">
                    <div className="card bg-blue-50">
                      <h3 className="font-semibold text-blue-900 mb-3">Datos Extraídos (IA)</h3>
                      {documentoSeleccionado.datosIA && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-blue-700">Confianza:</span>
                            <span className="font-bold text-blue-900">
                              {documentoSeleccionado.datosIA.nivelConfianza.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Número Factura:</span>
                            <span className="font-medium text-blue-900">
                              {documentoSeleccionado.datosIA.numeroFactura || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Proveedor:</span>
                            <span className="font-medium text-blue-900">
                              {documentoSeleccionado.datosIA.proveedor || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Importe Total:</span>
                            <span className="font-medium text-blue-900">
                              {documentoSeleccionado.datosIA.importeTotal 
                                ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(documentoSeleccionado.datosIA.importeTotal)
                                : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Fecha:</span>
                            <span className="font-medium text-blue-900">
                              {documentoSeleccionado.datosIA.fecha 
                                ? new Date(documentoSeleccionado.datosIA.fecha).toLocaleDateString('es-ES')
                                : '-'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {documentoSeleccionado.datosIA?.asientoContable && (
                      <div className="card bg-green-50">
                        <h3 className="font-semibold text-green-900 mb-3">Asiento Contable Propuesto</h3>
                        <div className="space-y-2">
                          {documentoSeleccionado.datosIA.asientoContable.apuntes.map((apunte, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border border-green-200">
                              <div className="flex justify-between mb-1">
                                <span className="font-medium text-gray-900">{apunte.cuenta}</span>
                                <span className={`font-bold ${apunte.debe > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {apunte.debe > 0 ? `+${apunte.debe.toFixed(2)}€` : `-${apunte.haber.toFixed(2)}€`}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600">{apunte.concepto}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex space-x-3">
                  {documentoSeleccionado.estado === 'procesado_ia' && (
                    <button
                      onClick={() => handleValidar(documentoSeleccionado)}
                      className="btn btn-success"
                    >
                      ✓ Validar y Enviar a ERP
                    </button>
                  )}
                  <button className="btn btn-warning">
                    ✏️ Editar Asiento
                  </button>
                  <button className="btn btn-danger">
                    ⚠️ Crear Incidencia
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
