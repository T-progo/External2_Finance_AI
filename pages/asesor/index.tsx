import type { NextPage } from 'next';
import Head from 'next/head';
import Layout from '@/components/Layout';
import MetricCard from '@/components/MetricCard';
import ClientUploadFrequencyWidget from '@/components/ClientUploadFrequencyWidget';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getActividadReciente } from '@/lib/supabaseService';
import { ActividadReciente } from '@/types';
import Link from 'next/link';

interface DashboardMetrics {
  documentosPendientes: number;
  iaProcesamientosMes: number;
  incidenciasAbiertas: number;
  clientesActivos: number;
  respuestasPendientes: number;
  tiempoPromedioRevision: string;
  incidenciasCerradas: number;
  precisionIATendencia: string;
}


const AsesorDashboard: NextPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    documentosPendientes: 0,
    iaProcesamientosMes: 0,
    incidenciasAbiertas: 0,
    clientesActivos: 0,
    respuestasPendientes: 0,
    tiempoPromedioRevision: '0h',
    incidenciasCerradas: 0,
    precisionIATendencia: '0%'
  });
  const [activityTimeline, setActivityTimeline] = useState<ActividadReciente[]>([]);
  const [assignedClientsData, setAssignedClientsData] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      if (!user?.id) {
        console.error('No user ID available');
        return;
      }

      // Get advisor's assigned clients
      const { data: assignedClients, error: clientError } = await supabaseAdmin
        .from('asesor_cliente')
        .select('cliente_id, clientes(*)')
        .eq('asesor_id', user.id);

      if (clientError) {
        console.error('Error loading assigned clients:', clientError);
      }

      const clientIds = assignedClients?.map(ac => ac.cliente_id) || [];
      console.log('Assigned client IDs:', clientIds);

      // Initialize metrics with defaults
      let documentosPendientes = 0;
      let iaProcesamientosMes = 0;
      let incidenciasAbiertas = 0;
      let respuestasPendientes = 0;

      // Only query if we have client IDs
      if (clientIds.length > 0) {
        // Get documents pending review
        const { data: pendingDocs, error: docsError } = await supabaseAdmin
          .from('documentos')
          .select('id')
          .in('cliente_id', clientIds)
          .in('estado', ['pendiente', 'procesado_ia']);

        if (docsError) {
          console.error('Error loading pending documents:', docsError);
        } else {
          documentosPendientes = pendingDocs?.length || 0;
          console.log('Pending documents count:', documentosPendientes);
        }

        // Get AI processed documents this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { data: iaDocsMonth, error: iaError } = await supabaseAdmin
          .from('documentos')
          .select('id')
          .in('cliente_id', clientIds)
          .eq('procesado_ia', true)
          .gte('created_at', startOfMonth.toISOString());

        if (iaError) {
          console.error('Error loading IA documents:', iaError);
        } else {
          iaProcesamientosMes = iaDocsMonth?.length || 0;
        }

        // Get open incidents
        const { data: openIncidents, error: incidentsError } = await supabaseAdmin
          .from('incidencias')
          .select('*')
          .in('cliente_id', clientIds)
          .in('estado', ['nueva', 'en_revision']);

        if (incidentsError) {
          console.error('Error loading open incidents:', incidentsError);
        } else {
          incidenciasAbiertas = openIncidents?.length || 0;
          respuestasPendientes = openIncidents?.filter((i: any) => 
            i.estado === 'nueva' || !i.fecha_ultima_respuesta
          ).length || 0;
          console.log('Open incidents count:', incidenciasAbiertas);
          console.log('Pending responses count:', respuestasPendientes);
        }
      } else {
        console.log('No assigned clients found for advisor');
      }

      setMetrics({
        documentosPendientes,
        iaProcesamientosMes,
        incidenciasAbiertas,
        clientesActivos: assignedClients?.length || 0,
        respuestasPendientes,
        tiempoPromedioRevision: '0h',
        incidenciasCerradas: 0,
        precisionIATendencia: '0%'
      });

      // Store assigned clients data for quick access
      setAssignedClientsData(assignedClients?.map(ac => ac.clientes).filter(Boolean) || []);

      // Load activity timeline from database
      try {
        const actividad = await getActividadReciente(10);
        setActivityTimeline(actividad);
      } catch (error) {
        console.error('Error loading activity timeline:', error);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'asesor')) {
      router.push('/');
    }
    if (user && user.rol === 'asesor') {
      loadDashboardData();
    }
  }, [user, loading, router, loadDashboardData]);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else {
      return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    }
  };

  const getActivityIcon = (tipo: string) => {
    switch(tipo) {
      case 'documento': return '📄';
      case 'incidencia': return '⚠️';
      case 'contabilizacion': return '📊';
      case 'usuario': return '👤';
      default: return '📋';
    }
  };

  // Mostrar loader mientras carga o mientras se redirige
  if (loading || !user || user.rol !== 'asesor') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-asesor mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }


  return (
    <>
      <Head>
        <title>Inicio Asesor - Externaliza2</title>
        <link rel="icon" href="/logo.png" />
      </Head>
      <Layout rol="asesor">
        <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-8 p-4 md:p-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido, {user.nombre}</h1>
            <p className="text-gray-600">Panel de trabajo del asesor</p>
          </div>

          {/* Métricas Principales - 5 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <MetricCard
              titulo="Docs Pendientes"
              valor={metrics.documentosPendientes}
              descripcion="Requieren revisión"
              icono="📄"
              href="/asesor/documentos-pendientes"
            />
            {/* <MetricCard
              titulo="IA Procesados"
              valor={metrics.iaProcesamientosMes}
              descripcion="Este mes"
              icono="🤖"
            /> */}
            <MetricCard
              titulo="Incidencias Abiertas"
              valor={metrics.incidenciasAbiertas}
              descripcion={metrics.incidenciasAbiertas > 0 ? `${metrics.incidenciasAbiertas} ${metrics.incidenciasAbiertas === 1 ? 'pendiente' : 'pendientes'}` : "0 pendientes"}
              icono="⚠️"
              href="/asesor/incidencias"
            />
            <MetricCard
              titulo="Clientes Activos"
              valor={metrics.clientesActivos}
              descripcion="Asignados a ti"
              icono="👥"
              href="/asesor/clientes"
            />
            <MetricCard
              titulo="Respuestas Pendientes"
              valor={metrics.respuestasPendientes}
              descripcion="Requieren atención"
              icono="💬"
              href="/asesor/incidencias"
            />
          </div>

          {/* Timeline de Actividad */}
          {/* <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">📋 Timeline de Actividad</h2>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activityTimeline.length > 0 ? (
                  activityTimeline.map((activity) => (
                    <div
                      key={activity.id}
                      className="p-3 border border-gray-200 rounded-lg transition-all hover:shadow-md bg-gray-50"
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{getActivityIcon(activity.tipo)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{activity.descripcion}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-600">{activity.usuario}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">{formatTimeAgo(activity.fecha)}</span>
                          </div>
                        </div>
                        {activity.enlace && (
                          <Link href={activity.enlace} className="text-xs text-asesor hover:underline">
                            Ver →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay actividad reciente</p>
                  </div>
                )}
              </div>
          </div> */}

          {/* Financial Panel Link */}
          {/* <div className="card bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">💰 Panel Financiero</h2>
                <p className="text-sm text-gray-600">Accede al panel financiero completo para ver métricas detalladas de tus clientes</p>
              </div>
              <Link href="/asesor/panel-financiero-portfolio" className="btn btn-asesor">
                Ver Panel Completo →
              </Link>
            </div>
          </div> */}

          {/* Client Upload Frequency KPI */}
          <ClientUploadFrequencyWidget asesorId={user?.id || ''} />

          {/* Quick Access to Clients */}
          {assignedClientsData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">👥 Acceso Rápido a Clientes</h2>
                <Link href="/asesor/clientes" className="btn btn-sm btn-asesor">
                  Ver todos ({metrics.clientesActivos})
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedClientsData.slice(0, 6).map((cliente: any) => (
                  <Link 
                    key={cliente.id} 
                    href={`/asesor/clientes-detailed?cliente=${cliente.id}`}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow block"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{cliente.nombre_comercial || cliente.razon_social}</h3>
                        <p className="text-sm text-gray-600">{cliente.nif}</p>
                      </div>
                      <span className="badge badge-success">Activo</span>
                    </div>
                    <div className="text-sm text-asesor font-medium mt-2">
                      Ver detalles →
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </Layout>
    </>
  );
};

export default AsesorDashboard;
