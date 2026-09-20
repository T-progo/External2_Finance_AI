import type { NextPage } from 'next';
import Head from 'next/head';
import Layout from '@/components/Layout';
import MetricCard from '@/components/MetricCard';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { 
  getMetricasDashboard, 
  getActividadReciente,
  getAIAccountantStats,
  getAdvisorPerformance,
  getDashboardAlerts,
  type AIAccountantStats,
  type AdvisorPerformance,
  type DashboardAlert,
} from '@/lib/supabaseService';

const AdminDashboard: NextPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [metricas, setMetricas] = useState({
    documentosPendientes: 0,
    facturasIA: 0,
    incidenciasAbiertas: 0,
    clientesActivos: 0,
    asesoresActivos: 0,
  });
  const [actividadReciente, setActividadReciente] = useState<any[]>([]);
  const [aiStats, setAiStats] = useState<AIAccountantStats>({
    procesadasCorrectamente: 0,
    conErroresIA: 0,
    pendientesAnalisis: 0,
    docsEsteMes: 0,
    tiempoMedio: '0s',
  });
  const [advisorPerformance, setAdvisorPerformance] = useState<AdvisorPerformance[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loadingDatos, setLoadingDatos] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'admin')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const cargarDatos = async () => {
      if (!user || user.rol !== 'admin') return;

      try {
        const [metricasDb, actividadDb, aiStatsDb, advisorPerfDb, alertsDb] = await Promise.all([
          getMetricasDashboard(user?.id, user?.rol),
          getActividadReciente(10),
          getAIAccountantStats(),
          getAdvisorPerformance(3),
          getDashboardAlerts(),
        ]);
        setMetricas(metricasDb);
        setActividadReciente(actividadDb);
        setAiStats(aiStatsDb);
        setAdvisorPerformance(advisorPerfDb);
        setAlerts(alertsDb);
      } catch (error) {
        console.error('Error cargando métricas o actividad:', error);
      } finally {
        setLoadingDatos(false);
      }
    };

    cargarDatos();
  }, [user]);

  // Mostrar loader mientras carga o mientras se redirige
  if (loading || !user || user.rol !== 'admin' || loadingDatos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard Admin - Externaliza2</title>
        <link rel="icon" href="/logo.png" />
      </Head>
      <Layout rol="admin">
        <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-8 p-4 md:p-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de Control Global</h1>
            <p className="text-gray-600">Vista general de toda la asesoría</p>
          </div>

          {/* Métricas Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              titulo="Documentos Pendientes"
              valor={metricas.documentosPendientes}
              descripcion="Sin contabilizar"
              icono="📄"
              href="/admin/documentos"
            />
            {/* <MetricCard
              titulo="Facturas IA Este Mes"
              valor={metricas.facturasIA}
              descripcion="Procesadas correctamente"
              icono="🤖"
              href="/admin/contabilizador-ia"
            /> */}
            <MetricCard
              titulo="Incidencias Abiertas"
              valor={metricas.incidenciasAbiertas}
              descripcion="Requieren atención"
              icono="⚠️"
              href="/admin/incidencias"
            />
            <MetricCard
              titulo="Clientes Activos"
              valor={metricas.clientesActivos}
              descripcion="Con actividad reciente"
              icono="👥"
              href="/admin/clientes-asesores"
            />
            <MetricCard
              titulo="Asesores Activos"
              valor={metricas.asesoresActivos}
              descripcion="Trabajando este mes"
              icono="💼"
              href="/admin/clientes-asesores?vista=asesores"
            />
          </div>

          {/* Actividad Reciente y Alertas - Solo mostrar si hay datos */}
          {(actividadReciente.length > 0 || alerts.length > 0) && (
            <div className="grid grid-cols-1 gap-6">
              {actividadReciente.length > 0 && (
                <div className="card">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Actividad Reciente</h2>
                  <div className="space-y-3">
                    {actividadReciente.slice(0, 5).map((actividad) => (
                      <div key={actividad.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="text-xl">
                          {actividad.tipo === 'documento' && '📄'}
                          {actividad.tipo === 'incidencia' && '⚠️'}
                          {actividad.tipo === 'contabilizacion' && '✅'}
                          {actividad.tipo === 'usuario' && '👤'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{actividad.descripcion}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {actividad.usuario} • {new Date(actividad.fecha).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alerts.length > 0 && (
                <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">🔔 Alertas y Notificaciones</h2>
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 bg-white rounded-lg border-l-4 ${
                          alert.tipo === 'error'
                            ? 'border-red-500'
                            : alert.tipo === 'warning'
                            ? 'border-yellow-500'
                            : 'border-blue-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{alert.titulo}</p>
                            <p className="text-xs text-gray-600 mt-1">{alert.mensaje}</p>
                          </div>
                          {alert.accion && (
                            <a
                              href={alert.href || '#'}
                              className={`btn btn-sm ${
                                alert.tipo === 'error'
                                  ? 'btn-danger'
                                  : alert.tipo === 'warning'
                                  ? 'btn-warning'
                                  : 'btn-secondary'
                              }`}
                            >
                              {alert.accion}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Estado Contabilizador IA y Rendimiento por Asesor - Solo mostrar si hay datos */}
          {(aiStats.docsEsteMes > 0 || advisorPerformance.length > 0) && (
            <div className={`grid grid-cols-1 gap-6`}>
              {advisorPerformance.length > 0 && (
                <div className="card">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Rendimiento por Asesor</h2>
                  <div className="space-y-3">
                    {advisorPerformance.map((advisor, index) => {
                      const colors = [
                        { bg: 'from-admin/10 to-admin/5', text: 'text-admin', bar: 'bg-admin' },
                        { bg: 'from-asesor/10 to-asesor/5', text: 'text-asesor', bar: 'bg-asesor' },
                        { bg: 'from-cliente/10 to-cliente/5', text: 'text-cliente', bar: 'bg-cliente' },
                      ];
                      const color = colors[index % colors.length];
                      
                      return (
                        <div key={advisor.id} className={`p-3 bg-gradient-to-r ${color.bg} rounded-lg`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-gray-900">{advisor.nombre}</p>
                              <p className="text-xs text-gray-600">{advisor.clientesCount} clientes</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${color.text}`}>{advisor.documentosEsteMes}</p>
                              <p className="text-xs text-gray-600">documentos</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
};

export default AdminDashboard;
