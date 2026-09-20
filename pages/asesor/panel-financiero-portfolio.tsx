import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import type { DashboardFinancieroAsesor } from '@/types';
import FinancialChart from '@/components/FinancialChart';
import MetricCard from '@/components/MetricCard';
import toast from 'react-hot-toast';

/**
 * ADVISOR PORTFOLIO FINANCIAL DASHBOARD
 * 
 * Shows aggregated financial data for assigned clients only
 * with AI alerts, risk indicators, and quick access to client details
 */
export default function AsesorPanelFinancieroPortfolio() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [dashboardData, setDashboardData] = useState<DashboardFinancieroAsesor | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>(new Date().getFullYear().toString());
  const [clienteDetalle, setClienteDetalle] = useState<any>(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoadingData(true);

      // Get advisor's assigned clients
      const { data: assignedClients, error: clientsError } = await supabase
        .from('asesor_cliente')
        .select('cliente_id, clientes(*)')
        .eq('asesor_id', user?.id);

      if (clientsError) throw clientsError;

      const clientIds = assignedClients?.map(ac => ac.cliente_id) || [];

      if (clientIds.length === 0) {
        setDashboardData({
          clientesAsignados: 0,
          totalIngresos: 0,
          totalGastos: 0,
          resultadoNeto: 0,
          documentosPendientes: 0,
          incidenciasAbiertas: 0,
          clientesConAlertas: []
        });
        return;
      }

      // Get financial models for assigned clients
      const { data: modelos, error: modelosError } = await supabase
        .from('modelos_financieros_cliente')
        .select('*, clientes(razon_social, nombre_comercial, nif)')
        .in('cliente_id', clientIds)
        .eq('ejercicio_fiscal', periodoSeleccionado);

      if (modelosError) throw modelosError;

      // Get pending documents
      const { data: pendingDocs } = await supabase
        .from('documentos')
        .select('id')
        .in('cliente_id', clientIds)
        .in('estado', ['pendiente', 'procesado_ia']);

      // Get open incidents
      const { data: openIncidents } = await supabase
        .from('incidencias')
        .select('id')
        .in('cliente_id', clientIds)
        .in('estado', ['nueva', 'en_revision']);

      // Calculate aggregates
      const totalIngresos = (modelos || []).reduce((sum, m) => sum + (parseFloat(m.ingresos_operacionales) || 0), 0);
      const totalGastos = (modelos || []).reduce((sum, m) => sum + (parseFloat(m.gastos_operacionales) || 0), 0);
      const resultadoNeto = totalIngresos - totalGastos;

      // Identify clients with alerts
      const clientesConAlertas = (modelos || [])
        .filter(m => m.alertas_financieras && m.alertas_financieras.length > 0)
        .map(m => ({
          clienteId: m.cliente_id,
          nombreCliente: m.clientes?.nombre_comercial || m.clientes?.razon_social || 'Cliente',
          alertas: m.alertas_financieras,
          resultado: parseFloat(m.resultado_neto) || 0
        }));

      setDashboardData({
        clientesAsignados: clientIds.length,
        totalIngresos,
        totalGastos,
        resultadoNeto,
        documentosPendientes: pendingDocs?.length || 0,
        incidenciasAbiertas: openIncidents?.length || 0,
        clientesConAlertas
      });

    } catch (error: any) {
      console.error('Error loading advisor dashboard:', error);
      toast.error('Error al cargar datos del portfolio');
    } finally {
      setLoadingData(false);
    }
  }, [user, periodoSeleccionado]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'asesor')) {
      router.push('/');
    }
    if (user && user.rol === 'asesor') {
      loadDashboardData();
    }
  }, [user, loading, router, loadDashboardData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getAlertBadge = (tipo: string) => {
    const badges = {
      danger: 'badge-danger',
      warning: 'badge-warning',
      info: 'badge-info',
    };
    return badges[tipo as keyof typeof badges] || 'badge-secondary';
  };

  const handleVerCliente = async (clienteId: string) => {
    try {
      // Get detailed client financial data
      const { data: modelo, error: modeloError } = await supabase
        .from('modelos_financieros_cliente')
        .select('*, clientes(razon_social, nombre_comercial, nif)')
        .eq('cliente_id', clienteId)
        .eq('ejercicio_fiscal', periodoSeleccionado)
        .single();

      if (modeloError) throw modeloError;

      setClienteDetalle(modelo);
      setMostrarDetalle(true);
    } catch (error) {
      console.error('Error loading client detail:', error);
      toast.error('Error al cargar detalle del cliente');
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-asesor mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando portfolio financiero...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Portfolio Financiero - Asesor - Externaliza2</title>
      </Head>
      <Layout rol="asesor">
        <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">💼 Portfolio Financiero</h1>
              <p className="text-gray-600 mt-1">
                Vista consolidada de tus {dashboardData?.clientesAsignados || 0} clientes asignados
              </p>
            </div>
            <div className="flex space-x-2">
              <select
                value={periodoSeleccionado}
                onChange={(e) => setPeriodoSeleccionado(e.target.value)}
                className="input"
              >
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
              </select>
              <button onClick={loadDashboardData} className="btn btn-asesor">
                🔄 Actualizar
              </button>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <MetricCard
              titulo="Clientes Asignados"
              valor={dashboardData?.clientesAsignados || 0}
              descripcion="En tu portfolio"
              icono="👥"
              href="/asesor/clientes"
            />
            <MetricCard
              titulo="Ingresos Totales"
              valor={formatCurrency(dashboardData?.totalIngresos || 0)}
              descripcion="Todos tus clientes"
              icono="📈"
            />
            <MetricCard
              titulo="Resultado Neto"
              valor={formatCurrency(dashboardData?.resultadoNeto || 0)}
              descripcion={
                dashboardData && dashboardData.resultadoNeto >= 0
                  ? 'Positivo'
                  : 'Requiere atención'
              }
              icono={dashboardData && dashboardData.resultadoNeto >= 0 ? '✅' : '⚠️'}
            />
            <MetricCard
              titulo="Docs Pendientes"
              valor={dashboardData?.documentosPendientes || 0}
              descripcion="Requieren revisión"
              icono="📄"
              href="/asesor/documentos-pendientes"
            />
            <MetricCard
              titulo="Incidencias"
              valor={dashboardData?.incidenciasAbiertas || 0}
              descripcion="Sin resolver"
              icono="⚠️"
              href="/asesor/incidencias"
            />
          </div>

          {/* Portfolio Health Summary */}
          <div className="card bg-gradient-to-br from-asesor/10 to-asesor/5">
            <div className="flex items-start space-x-3">
              <div className="text-3xl">📊</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Resumen del Portfolio</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Ingresos Promedio</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatCurrency(
                        dashboardData && dashboardData.clientesAsignados > 0
                          ? dashboardData.totalIngresos / dashboardData.clientesAsignados
                          : 0
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Margen Promedio</div>
                    <div className="text-xl font-bold text-gray-900">
                      {dashboardData && dashboardData.totalIngresos > 0
                        ? ((dashboardData.resultadoNeto / dashboardData.totalIngresos) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Clientes con Alertas</div>
                    <div className="text-xl font-bold text-yellow-600">
                      {dashboardData?.clientesConAlertas.length || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clients with Alerts */}
          {dashboardData && dashboardData.clientesConAlertas.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">🚨 Clientes con Alertas Financieras</h2>
                <span className="badge badge-warning">
                  {dashboardData.clientesConAlertas.length}
                </span>
              </div>

              <div className="space-y-3">
                {dashboardData.clientesConAlertas.map((cliente, idx) => (
                  <div
                    key={idx}
                    className="p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleVerCliente(cliente.clienteId)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-bold text-gray-900">{cliente.nombreCliente}</h3>
                          <span
                            className={`badge ${
                              cliente.resultado >= 0 ? 'badge-success' : 'badge-danger'
                            }`}
                          >
                            {formatCurrency(cliente.resultado)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {cliente.alertas.map((alerta: any, aIdx: number) => (
                            <div key={aIdx} className="flex items-start space-x-2">
                              <span className={`badge ${getAlertBadge(alerta.tipo)} text-xs`}>
                                {alerta.tipo.toUpperCase()}
                              </span>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{alerta.titulo}</div>
                                <div className="text-xs text-gray-600">{alerta.descripcion}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVerCliente(cliente.clienteId);
                        }}
                        className="btn btn-sm btn-asesor ml-4"
                      >
                        Ver Detalle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/asesor/documentos-pendientes')}
              className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="text-4xl">📄</div>
                <div>
                  <div className="font-bold text-gray-900">Revisar Documentos</div>
                  <div className="text-sm text-gray-600">
                    {dashboardData?.documentosPendientes || 0} pendientes
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push('/asesor/contabilizacion-ia')}
              className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="text-4xl">📊</div>
                <div>
                  <div className="font-bold text-gray-900">Generar Libros</div>
                  <div className="text-sm text-gray-600">Libro Registro</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push('/asesor/clientes-detailed')}
              className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="text-4xl">👥</div>
                <div>
                  <div className="font-bold text-gray-900">Gestionar Clientes</div>
                  <div className="text-sm text-gray-600">
                    {dashboardData?.clientesAsignados || 0} asignados
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Client Detail Modal */}
          {mostrarDetalle && clienteDetalle && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {clienteDetalle.clientes?.nombre_comercial || clienteDetalle.clientes?.razon_social}
                    </h2>
                    <p className="text-gray-600">
                      {clienteDetalle.clientes?.nif} • Periodo: {clienteDetalle.periodo}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setMostrarDetalle(false);
                      setClienteDetalle(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Financial Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card bg-green-50">
                      <div className="text-xs text-green-700">Ingresos</div>
                      <div className="text-lg font-bold text-green-900">
                        {formatCurrency(parseFloat(clienteDetalle.ingresos_operacionales) || 0)}
                      </div>
                    </div>
                    <div className="card bg-red-50">
                      <div className="text-xs text-red-700">Gastos</div>
                      <div className="text-lg font-bold text-red-900">
                        {formatCurrency(parseFloat(clienteDetalle.gastos_operacionales) || 0)}
                      </div>
                    </div>
                    <div className="card bg-blue-50">
                      <div className="text-xs text-blue-700">Resultado</div>
                      <div
                        className={`text-lg font-bold ${
                          parseFloat(clienteDetalle.resultado_neto) >= 0 ? 'text-green-900' : 'text-red-900'
                        }`}
                      >
                        {formatCurrency(parseFloat(clienteDetalle.resultado_neto) || 0)}
                      </div>
                    </div>
                    <div className="card bg-purple-50">
                      <div className="text-xs text-purple-700">Margen</div>
                      <div className="text-lg font-bold text-purple-900">
                        {parseFloat(clienteDetalle.margen_neto)?.toFixed(1) || 0}%
                      </div>
                    </div>
                  </div>

                  {/* Financial Ratios */}
                  {clienteDetalle.ratio_liquidez && (
                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Ratios Financieros</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-gray-600">Liquidez</div>
                          <div className="text-xl font-bold text-gray-900">
                            {parseFloat(clienteDetalle.ratio_liquidez)?.toFixed(2) || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Solvencia</div>
                          <div className="text-xl font-bold text-gray-900">
                            {parseFloat(clienteDetalle.ratio_solvencia)?.toFixed(2) || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">ROI</div>
                          <div className="text-xl font-bold text-gray-900">
                            {parseFloat(clienteDetalle.roi)?.toFixed(1) || '-'}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">ROE</div>
                          <div className="text-xl font-bold text-gray-900">
                            {parseFloat(clienteDetalle.roe)?.toFixed(1) || '-'}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Commentary */}
                  {clienteDetalle.comentario_ia && (
                    <div className="card bg-purple-50 border-purple-200">
                      <div className="flex items-start space-x-3">
                        <div className="text-2xl">🤖</div>
                        <div>
                          <h3 className="font-semibold text-purple-900 mb-2">Análisis IA</h3>
                          <p className="text-sm text-purple-800">{clienteDetalle.comentario_ia}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alerts */}
                  {clienteDetalle.alertas_financieras && clienteDetalle.alertas_financieras.length > 0 && (
                    <div className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Alertas</h3>
                      <div className="space-y-2">
                        {clienteDetalle.alertas_financieras.map((alerta: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg ${
                              alerta.tipo === 'danger'
                                ? 'bg-red-50'
                                : alerta.tipo === 'warning'
                                ? 'bg-yellow-50'
                                : 'bg-blue-50'
                            }`}
                          >
                            <div className="flex items-start space-x-2">
                              <span className={`badge ${getAlertBadge(alerta.tipo)}`}>
                                {alerta.tipo.toUpperCase()}
                              </span>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{alerta.titulo}</div>
                                <div className="text-sm text-gray-600">{alerta.descripcion}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {clienteDetalle.recomendaciones_ia && clienteDetalle.recomendaciones_ia.length > 0 && (
                    <div className="card bg-green-50 border-green-200">
                      <h3 className="text-lg font-semibold text-green-900 mb-3">💡 Recomendaciones IA</h3>
                      <ul className="space-y-2">
                        {clienteDetalle.recomendaciones_ia.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-green-600">•</span>
                            <span className="text-sm text-green-800">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => router.push(`/asesor/documentos-pendientes?cliente=${clienteDetalle.cliente_id}`)}
                      className="btn btn-asesor flex-1"
                    >
                      📄 Ver Documentos
                    </button>
                    <button
                      onClick={() => router.push(`/asesor/incidencias?cliente=${clienteDetalle.cliente_id}`)}
                      className="btn btn-secondary flex-1"
                    >
                      ⚠️ Ver Incidencias
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}

