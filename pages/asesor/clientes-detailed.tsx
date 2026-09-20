import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { Cliente } from '@/types';
import { mockClientes, mockDocumentos, mockDatosFinancieros } from '@/lib/mockData';
import DataTable from '@/components/DataTable';
import FilterBar, { Filter } from '@/components/FilterBar';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import Dialog from '@/components/Dialog';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface ClienteDetailed extends Cliente {
  docsPendientes: number;
  docsIAProcesados: number;
  incidenciasAbiertas: number;
  resultadoActual: number;
  margenActual: number;
  ultimaActividad: Date;
  estadoVisual: 'green' | 'amber' | 'red';
  asientoERPUltimo?: string;
}

interface AIContext {
  resumenGeneral: string;
  alertasActivas: string[];
  recomendaciones: string[];
  tendencias: {
    label: string;
    value: string;
    tendencia: 'up' | 'down' | 'stable';
  }[];
}

export default function AsesorClientesDetailed() {
  const { user, signup } = useAuth();
  const router = useRouter();
  const clientesAsignados = mockClientes.filter(c => c.asesoresAsignados?.includes(user?.id || ''));
  const [clientes, setClientes] = useState<ClienteDetailed[]>([]);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteDetailed | null>(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [showAIContext, setShowAIContext] = useState(false);
  const [aiContext, setAIContext] = useState<AIContext | null>(null);

  const loadClientesData = useCallback(async () => {
    const enrichedClientes: ClienteDetailed[] = clientesAsignados.map(cliente => {
      const docs = getDocumentosCliente(cliente.id);
      const pendientes = docs.filter(d => d.estado === 'pendiente' || d.estado === 'procesado_ia').length;
      const iaProcesados = docs.filter(d => d.procesadoIA).length;
      const incidencias = 0; // TODO: fetch from DB
      const finanzas = getDatosFinancierosCliente(cliente.id);
      
      // Calculate status
      let estadoVisual: 'green' | 'amber' | 'red' = 'green';
      if (pendientes > 10 || incidencias > 2) estadoVisual = 'red';
      else if (pendientes > 5 || incidencias > 0) estadoVisual = 'amber';

      return {
        ...cliente,
        docsPendientes: pendientes,
        docsIAProcesados: iaProcesados,
        incidenciasAbiertas: incidencias,
        resultadoActual: finanzas?.resultado || 0,
        margenActual: finanzas?.margen || 0,
        ultimaActividad: new Date(),
        estadoVisual,
        asientoERPUltimo: docs.find(d => d.nroAsientoERP)?.nroAsientoERP
      };
    });
    setClientes(enrichedClientes);
  }, [clientesAsignados]);

  useEffect(() => {
    loadClientesData();
  }, [loadClientesData]);

  const getDocumentosCliente = (clienteId: string) => {
    return mockDocumentos.filter(d => d.clienteId === clienteId);
  };

  const getDatosFinancierosCliente = (clienteId: string) => {
    return mockDatosFinancieros.find(d => d.clienteId === clienteId);
  };

  const filterConfig: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar (Nombre/NIF)',
      type: 'text',
      placeholder: 'Razón social, NIF...',
    },
    {
      key: 'activo',
      label: 'Estado',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        { value: 'activo', label: 'Activo' },
        { value: 'inactivo', label: 'Inactivo' },
      ],
    },
    {
      key: 'estadoVisual',
      label: 'Estado Visual',
      type: 'select',
      options: [
        { value: '', label: 'Todos' },
        { value: 'green', label: '🟢 Verde (OK)' },
        { value: 'amber', label: '🟡 Ámbar (Atención)' },
        { value: 'red', label: '🔴 Rojo (Urgente)' },
      ],
    },
  ];

  const clientesFiltrados = clientes.filter(c => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      if (!c.razonSocial.toLowerCase().includes(busqueda) && 
          !c.nif.toLowerCase().includes(busqueda) &&
          !c.nombreComercial?.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.activo && c.estado !== filtros.activo) return false;
    if (filtros.estadoVisual && c.estadoVisual !== filtros.estadoVisual) return false;
    return true;
  });

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros({ ...filtros, [key]: value });
  };

  const handleLimpiarFiltros = () => {
    setFiltros({});
  };

  const handleVerDetalle = (cliente: ClienteDetailed) => {
    setClienteSeleccionado(cliente);
    setMostrarDetalle(true);
    loadAIContext(cliente.id);
  };

  const loadAIContext = (clienteId: string) => {
    // Mock AI context
    setAIContext({
      resumenGeneral: "Cliente activo con flujo de documentos regular. Se detecta ligero incremento en gastos operativos este trimestre.",
      alertasActivas: [
        "2 facturas con importes superiores a €5000 pendientes de validación",
        "Margen operativo ha descendido 2.1% respecto al mes anterior",
      ],
      recomendaciones: [
        "Revisar facturas pendientes antes del cierre mensual (3 días)",
        "Analizar categoría de gastos 'Servicios externos' - aumento del 15%",
        "Considerar validación en lote para mejorar eficiencia",
      ],
      tendencias: [
        { label: "Ingresos", value: "+12.5%", tendencia: "up" },
        { label: "Gastos", value: "+8.2%", tendencia: "up" },
        { label: "Precisión IA", value: "97.4%", tendencia: "stable" },
        { label: "Tiempo medio revisión", value: "-15%", tendencia: "down" },
      ]
    });
  };

  const columns = [
    {
      key: 'razonSocial',
      header: 'Cliente',
      sortable: true,
      render: (cliente: ClienteDetailed) => (
        <div className="flex items-center space-x-2">
          <span className={`w-3 h-3 rounded-full ${
            cliente.estadoVisual === 'green' ? 'bg-green-500' :
            cliente.estadoVisual === 'amber' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <div>
            <div className="font-medium text-gray-900">{cliente.razonSocial}</div>
            <div className="text-xs text-gray-500">{cliente.nif}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'docsPendientes',
      header: 'Docs Pendientes',
      sortable: true,
      render: (cliente: ClienteDetailed) => (
        <div className="text-sm">
          <div className={`font-medium ${
            cliente.docsPendientes > 10 ? 'text-red-600' :
            cliente.docsPendientes > 5 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {cliente.docsPendientes}
          </div>
          <div className="text-xs text-gray-500">{cliente.docsIAProcesados} IA proc.</div>
        </div>
      ),
    },
    {
      key: 'incidenciasAbiertas',
      header: 'Incidencias',
      sortable: true,
      render: (cliente: ClienteDetailed) => (
        <span className={`badge ${
          cliente.incidenciasAbiertas > 2 ? 'badge-danger' :
          cliente.incidenciasAbiertas > 0 ? 'badge-warning' : 'badge-success'
        }`}>
          {cliente.incidenciasAbiertas}
        </span>
      ),
    },
    {
      key: 'resultado',
      header: 'Resultado/Margen',
      render: (cliente: ClienteDetailed) => (
        <div className="text-sm">
          <div className={`font-medium ${
            cliente.resultadoActual >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(cliente.resultadoActual)}
          </div>
          <div className="text-xs text-gray-500">{cliente.margenActual.toFixed(1)}% margen</div>
        </div>
      ),
    },
    {
      key: 'ultimaActividad',
      header: 'Última Actividad',
      sortable: true,
      render: (cliente: ClienteDetailed) => (
        <div className="text-xs text-gray-600">
          {new Date(cliente.ultimaActividad).toLocaleDateString('es-ES')}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (cliente: ClienteDetailed) => (
        <span className={`badge ${cliente.estado === 'activo' ? 'badge-success' : 'badge-secondary'}`}>
          {cliente.estado === 'activo' ? '✓ Activo' : '○ Inactivo'}
        </span>
      ),
    },
  ];

  const estadisticas = {
    total: clientes.length,
    activos: clientes.filter(c => c.estado === 'activo').length,
    verde: clientes.filter(c => c.estadoVisual === 'green').length,
    ambar: clientes.filter(c => c.estadoVisual === 'amber').length,
    rojo: clientes.filter(c => c.estadoVisual === 'red').length,
    totalDocumentos: clientes.reduce((sum, c) => sum + c.docsPendientes, 0),
  };

  return (
    <Layout rol="asesor">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">👥 Clientes Asignados</h1>
            <p className="text-gray-600 mt-1">Gestión y supervisión detallada de tus clientes</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total Clientes</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{estadisticas.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Activos</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticas.activos}</div>
          </div>
          <div className="card bg-green-50">
            <div className="text-sm text-green-700">🟢 Verde</div>
            <div className="text-2xl font-bold text-green-900 mt-1">{estadisticas.verde}</div>
          </div>
          <div className="card bg-yellow-50">
            <div className="text-sm text-yellow-700">🟡 Ámbar</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">{estadisticas.ambar}</div>
          </div>
          <div className="card bg-red-50">
            <div className="text-sm text-red-700">🔴 Rojo</div>
            <div className="text-2xl font-bold text-red-900 mt-1">{estadisticas.rojo}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Docs Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{estadisticas.totalDocumentos}</div>
          </div>
        </div>

        <FilterBar
          filters={filterConfig}
          values={filtros}
          onChange={handleFiltroChange}
          onClear={handleLimpiarFiltros}
        />

        <div className="card">
          <DataTable
            data={clientesFiltrados}
            columns={columns}
            onRowClick={handleVerDetalle}
            actions={(cliente: ClienteDetailed) => (
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/asesor/documentos?cliente=${cliente.id}`);
                  }}
                  className="text-blue-600 hover:text-blue-900"
                  title="Ver documentos"
                >
                  📄
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/asesor/incidencias?cliente=${cliente.id}`);
                  }}
                  className="text-yellow-600 hover:text-yellow-900"
                  title="Ver incidencias"
                >
                  ⚠️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/asesor/panel-financiero?cliente=${cliente.id}`);
                  }}
                  className="text-green-600 hover:text-green-900"
                  title="Panel financiero"
                >
                  💰
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVerDetalle(cliente);
                  }}
                  className="text-asesor hover:text-blue-900"
                  title="Ver detalle completo"
                >
                  👁️
                </button>
              </div>
            )}
          />
        </div>

        {/* Detail Modal with AI Context Sidebar */}
        {mostrarDetalle && clienteSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex">
              {/* Main Detail Panel */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className={`w-4 h-4 rounded-full ${
                        clienteSeleccionado.estadoVisual === 'green' ? 'bg-green-500' :
                        clienteSeleccionado.estadoVisual === 'amber' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <h2 className="text-2xl font-bold text-gray-900">{clienteSeleccionado.razonSocial}</h2>
                    </div>
                    <p className="text-gray-600 ml-7">{clienteSeleccionado.nif}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowAIContext(!showAIContext)}
                      className="btn btn-sm btn-asesor"
                    >
                      🤖 {showAIContext ? 'Ocultar' : 'Mostrar'} Contexto IA
                    </button>
                    <button
                      onClick={() => {
                        setMostrarDetalle(false);
                        setClienteSeleccionado(null);
                        setShowAIContext(false);
                      }}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Fiscal Data & Advisors */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">📋 Datos Fiscales</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">NIF:</span>
                          <span className="font-medium text-gray-900">{clienteSeleccionado.nif}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Razón Social:</span>
                          <span className="font-medium text-gray-900">{clienteSeleccionado.razonSocial}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Dirección Fiscal:</span>
                          <span className="font-medium text-gray-900 text-right">{clienteSeleccionado.direccionFiscal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-medium text-gray-900">{clienteSeleccionado.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Teléfono:</span>
                          <span className="font-medium text-gray-900">{clienteSeleccionado.telefono}</span>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">👤 Asesores</h3>
                      <div className="space-y-2">
                        {clienteSeleccionado.asesoresAsignados.map((asesorId, idx) => (
                          <div key={asesorId} className="flex items-center space-x-2 p-2 bg-blue-50 rounded">
                            <span className="text-2xl">👨‍💼</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">Asesor {idx + 1}</div>
                              <div className="text-xs text-gray-600">ID: {asesorId.substring(0, 8)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Doc & AI Status */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="card bg-blue-50">
                      <div className="text-xs text-blue-700">Docs Pendientes</div>
                      <div className="text-3xl font-bold text-blue-900 mt-1">{clienteSeleccionado.docsPendientes}</div>
                    </div>
                    <div className="card bg-purple-50">
                      <div className="text-xs text-purple-700">IA Procesados</div>
                      <div className="text-3xl font-bold text-purple-900 mt-1">{clienteSeleccionado.docsIAProcesados}</div>
                    </div>
                    <div className="card bg-yellow-50">
                      <div className="text-xs text-yellow-700">Incidencias</div>
                      <div className="text-3xl font-bold text-yellow-900 mt-1">{clienteSeleccionado.incidenciasAbiertas}</div>
                    </div>
                    <div className="card bg-green-50">
                      <div className="text-xs text-green-700">Último Asiento ERP</div>
                      <div className="text-lg font-bold text-green-900 mt-1">{clienteSeleccionado.asientoERPUltimo || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Mini Finance */}
                  <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">💰 Mini Finanzas</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-xs text-green-700">Resultado</div>
                        <div className={`text-2xl font-bold mt-1 ${
                          clienteSeleccionado.resultadoActual >= 0 ? 'text-green-900' : 'text-red-900'
                        }`}>
                          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(clienteSeleccionado.resultadoActual)}
                        </div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-xs text-blue-700">Margen</div>
                        <div className="text-2xl font-bold text-blue-900 mt-1">{clienteSeleccionado.margenActual.toFixed(1)}%</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-xs text-purple-700">Estado</div>
                        <div className="text-2xl font-bold text-purple-900 mt-1">
                          {clienteSeleccionado.estadoVisual === 'green' ? '🟢 OK' : 
                           clienteSeleccionado.estadoVisual === 'amber' ? '🟡 Atención' : '🔴 Urgente'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="card bg-gradient-to-r from-blue-50 to-indigo-50">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">⚡ Acciones Rápidas</h3>
                    <div className="grid grid-cols-4 gap-3">
                      <button
                        onClick={() => router.push(`/asesor/documentos?cliente=${clienteSeleccionado.id}`)}
                        className="btn btn-asesor"
                      >
                        📄 Documentos
                      </button>
                      <button
                        onClick={() => router.push(`/asesor/incidencias?cliente=${clienteSeleccionado.id}`)}
                        className="btn btn-warning"
                      >
                        ⚠️ Incidencias
                      </button>
                      <button
                        onClick={() => router.push(`/asesor/panel-financiero?cliente=${clienteSeleccionado.id}`)}
                        className="btn btn-success"
                      >
                        💰 Finanzas
                      </button>
                      <button
                        onClick={() => router.push(`/asesor/asistente?cliente=${clienteSeleccionado.id}`)}
                        className="btn btn-secondary"
                      >
                        🤖 Asistente
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Context Sidebar */}
              {showAIContext && aiContext && (
                <div className="w-96 bg-gradient-to-br from-purple-50 to-indigo-50 border-l border-gray-200 overflow-y-auto p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🤖 Contexto IA</h3>
                  
                  {/* General Summary */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Resumen General</h4>
                    <p className="text-sm text-gray-600 bg-white p-3 rounded-lg">
                      {aiContext.resumenGeneral}
                    </p>
                  </div>

                  {/* Active Alerts */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">⚠️ Alertas Activas</h4>
                    <div className="space-y-2">
                      {aiContext.alertasActivas.map((alerta, idx) => (
                        <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                          <p className="text-xs text-gray-700">{alerta}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 Recomendaciones</h4>
                    <div className="space-y-2">
                      {aiContext.recomendaciones.map((rec, idx) => (
                        <div key={idx} className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                          <p className="text-xs text-gray-700">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trends */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">📈 Tendencias</h4>
                    <div className="space-y-2">
                      {aiContext.tendencias.map((trend, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg flex items-center justify-between">
                          <span className="text-xs text-gray-600">{trend.label}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-gray-900">{trend.value}</span>
                            <span className="text-lg">
                              {trend.tendencia === 'up' ? '📈' : trend.tendencia === 'down' ? '📉' : '➡️'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
