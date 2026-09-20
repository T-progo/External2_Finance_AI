import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '@/components/Layout';
import MetricCard from '@/components/MetricCard';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import { getDocumentos, getIncidencias, getDatosFinancieros, getClienteIdByUserId } from '@/lib/supabaseService';
import type { Documento, Incidencia, DatosFinancieros } from '@/types';

interface Notificacion {
  id: string;
  tipo: 'cierre' | 'contabilizacion' | 'incidencia' | 'recordatorio';
  titulo: string;
  mensaje: string;
  fecha: Date;
  leida: boolean;
}

const ClienteDashboard: NextPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);

  // Real data from Supabase
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [datosFinancieros, setDatosFinancieros] = useState<DatosFinancieros | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'cliente')) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Fetch client data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      
      setLoadingData(true);
      try {
        // Get cliente ID
        const cId = await getClienteIdByUserId(user.id);
        if (!cId) {
          console.error('No se encontró el cliente para este usuario');
          setLoadingData(false);
          return;
        }
        setClienteId(cId);

        // Fetch all data in parallel
        const [docsData, incData, finData] = await Promise.all([
          getDocumentos(cId),
          getIncidencias(cId),
          getDatosFinancieros(cId),
        ]);

        setDocumentos(docsData);
        setIncidencias(incData);
        setDatosFinancieros(finData);
      } catch (error) {
        console.error('Error fetching client data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  // Datos calculados
  const estadisticas = useMemo(() => ({
    pendientes: documentos.filter(d => d.estado === 'pendiente' || d.estado === 'procesado_ia').length,
    contabilizados: documentos.filter(d => d.estado === 'contabilizado').length,
    incidenciasActivas: incidencias.filter(i => i.estado === 'nueva' || i.estado === 'en_revision').length,
    resultado: datosFinancieros?.resultado || 0,
  }), [documentos, incidencias, datosFinancieros]);

  // Notificaciones mock (esto se puede mejorar con datos reales más adelante)
  const [notificaciones] = useState<Notificacion[]>([
    {
      id: 'n1',
      tipo: 'contabilizacion',
      titulo: 'Documentos Contabilizados',
      mensaje: 'Tu asesor ha contabilizado 8 documentos nuevos',
      fecha: new Date('2025-10-09T14:30:00'),
      leida: false,
    },
    {
      id: 'n2',
      tipo: 'incidencia',
      titulo: 'Nueva Incidencia',
      mensaje: 'La IA ha detectado un problema en un documento',
      fecha: new Date('2025-10-08T22:15:00'),
      leida: false,
    },
    {
      id: 'n3',
      tipo: 'recordatorio',
      titulo: 'Próximo Vencimiento',
      mensaje: 'Modelo 303 - IVA Trimestral vence el 20 de Octubre',
      fecha: new Date('2025-10-07T09:00:00'),
      leida: true,
    },
  ]);

  const notificacionesNoLeidas = notificaciones.filter(n => !n.leida).length;

  // Actividad reciente mejorada
  const actividadReciente = useMemo(() => {
    const actividades: Array<{
      id: string;
      tipo: string;
      icono: string;
      titulo: string;
      fecha: Date;
      estado?: string;
    }> = [];
    
    // Documentos subidos recientemente
    const docsRecientes = [...documentos]
      .sort((a, b) => new Date(b.fechaSubida).getTime() - new Date(a.fechaSubida).getTime())
      .slice(0, 2);
    
    docsRecientes.forEach(doc => {
      actividades.push({
        id: `doc-${doc.id}`,
        tipo: 'documento',
        icono: '📄',
        titulo: `Subiste ${doc.nombre}`,
        fecha: doc.fechaSubida,
        estado: doc.estado,
      });
    });

    // Incidencias recientes
    const incidenciasRecientes = [...incidencias]
      .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
      .slice(0, 1);
    
    incidenciasRecientes.forEach(inc => {
      actividades.push({
        id: `inc-${inc.id}`,
        tipo: 'incidencia',
        icono: '⚠️',
        titulo: inc.origen === 'ia' ? 'La IA marcó una incidencia' : 'Nueva incidencia de tu asesor',
        fecha: inc.fechaCreacion,
        estado: inc.estado,
      });
    });

    return actividades.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [documentos, incidencias]);

  // Mostrar loader mientras carga o mientras se redirige
  if (loading || !user || user.rol !== 'cliente') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cliente mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <Layout rol="cliente">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cliente mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando tus datos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>Mi Dashboard - Externaliza2</title>
        <link rel="icon" href="/logo.png" />
      </Head>
      <Layout rol="cliente">
        <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-8 p-4 md:p-8">
          {/* Cabecera con notificaciones */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Hola, {user.nombre}</h1>
              <p className="text-gray-600">Este es el resumen de tu empresa</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)}
                className="relative p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
              >
                <span className="text-2xl">🔔</span>
                {notificacionesNoLeidas > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {notificacionesNoLeidas}
                  </span>
                )}
              </button>

              {mostrarNotificaciones && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Notificaciones</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {notificaciones.map(notif => (
                      <div
                        key={notif.id}
                        className={`p-4 hover:bg-gray-50 transition-colors ${!notif.leida ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-start space-x-3">
                          <span className="text-2xl">
                            {notif.tipo === 'cierre' && '📅'}
                            {notif.tipo === 'contabilizacion' && '✅'}
                            {notif.tipo === 'incidencia' && '⚠️'}
                            {notif.tipo === 'recordatorio' && '⏰'}
                          </span>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{notif.titulo}</h4>
                            <p className="text-sm text-gray-600 mt-1">{notif.mensaje}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(notif.fecha).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          {!notif.leida && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {notificaciones.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <span className="text-4xl block mb-2">🔕</span>
                      No tienes notificaciones
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Métricas del Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              titulo="Documentos Pendientes"
              valor={estadisticas.pendientes}
              descripcion="Sin contabilizar"
              icono="📄"
              href="/cliente/documentos"
            />
            <MetricCard
              titulo="Documentos Contabilizados"
              valor={estadisticas.contabilizados}
              descripcion="Este periodo"
              icono="✅"
              href="/cliente/documentos"
            />
            <MetricCard
              titulo="Incidencias Activas"
              valor={estadisticas.incidenciasActivas}
              descripcion="Requieren tu atención"
              icono="⚠️"
              href="/cliente/incidencias"
            />
            <MetricCard
              titulo="Resultado Trimestre"
              valor={datosFinancieros ? `${estadisticas.resultado >= 0 ? '+' : ''}${(estadisticas.resultado / 1000).toFixed(1)}k€` : 'N/D'}
              descripcion={datosFinancieros ? (estadisticas.resultado >= 0 ? 'Beneficio' : 'Pérdida') : 'Pendiente cálculo'}
              icono="💶"
              href="/cliente/panel-financiero"
            />
          </div>

          {/* Actividad Reciente */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Actividad Reciente</h2>
            <div className="space-y-4">
              {actividadReciente.length > 0 ? (
                actividadReciente.map((actividad: any) => (
                  <div key={actividad.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <span className="text-2xl">{actividad.icono}</span>
                    <div className="flex-1">
                      <p className="text-gray-900">{actividad.titulo}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-sm text-gray-500">
                          {new Date(actividad.fecha).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })} • {new Date(actividad.fecha).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {actividad.estado && (
                          <span className={`badge text-xs ${
                            actividad.estado === 'contabilizado' ? 'badge-success' :
                            actividad.estado === 'validado' ? 'badge-success' :
                            actividad.estado === 'procesado_ia' ? 'badge-info' :
                            actividad.estado === 'incidencia' ? 'badge-danger' :
                            actividad.estado === 'resuelta' ? 'badge-success' :
                            'badge-warning'
                          }`}>
                            {actividad.estado === 'pendiente' ? 'Pendiente' :
                             actividad.estado === 'procesado_ia' ? 'En Proceso' :
                             actividad.estado === 'validado' ? 'Validado' :
                             actividad.estado === 'contabilizado' ? 'Contabilizado' :
                             actividad.estado === 'incidencia' ? 'Incidencia' :
                             actividad.estado === 'resuelta' ? 'Resuelta' :
                             actividad.estado}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl block mb-2">📋</span>
                  <p>No hay actividad reciente</p>
                </div>
              )}
            </div>
          </div>

          {/* Accesos Rápidos */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Link href="/cliente/documentos" className="card hover:shadow-lg transition-shadow text-center">
              <div className="text-4xl mb-3">📤</div>
              <p className="font-semibold text-gray-900">Subir Documento</p>
              <p className="text-xs text-gray-600 mt-1">Facturas y recibos</p>
            </Link>
            <Link href="/cliente/incidencias" className="card hover:shadow-lg transition-shadow text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="font-semibold text-gray-900">Hablar con Asesor</p>
              <p className="text-xs text-gray-600 mt-1">Resolver dudas</p>
            </Link>
          </div>
        </div>
      </Layout>
    </>
  );
};

export default ClienteDashboard;
