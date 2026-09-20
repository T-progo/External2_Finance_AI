import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function NotificarCliente() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [cliente, setCliente] = useState<any>(null);
  const [mensaje, setMensaje] = useState('');
  const [asunto, setAsunto] = useState('Recordatorio: Subida de Documentos');
  const [sending, setSending] = useState(false);
  const [templateType, setTemplateType] = useState<'reminder' | 'urgent' | 'custom'>('reminder');

  const loadCliente = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*, profiles(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setCliente(data);
      
      // Load last upload date
      const { data: lastDoc } = await supabase
        .from('documentos')
        .select('fecha_subida')
        .eq('cliente_id', id)
        .order('fecha_subida', { ascending: false })
        .limit(1)
        .single();

      if (lastDoc) {
        const daysSince = Math.floor(
          (Date.now() - new Date(lastDoc.fecha_subida).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (templateType === 'reminder') {
          setMensaje(
            `Estimado/a ${data.persona_contacto},\n\n` +
            `Hemos notado que hace ${daysSince} días que no sube documentos al sistema. ` +
            `Le recordamos la importancia de mantener la documentación actualizada para ` +
            `garantizar el correcto procesamiento de su contabilidad.\n\n` +
            `Si tiene alguna duda o necesita asistencia, no dude en contactarnos.\n\n` +
            `Saludos cordiales,\n${user?.nombre}`
          );
        }
      }
    } catch (error) {
      console.error('Error loading cliente:', error);
      toast.error('Error al cargar cliente');
    }
  }, [id, templateType, user]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'asesor')) {
      router.push('/');
    }
    if (id && user) {
      loadCliente();
    }
  }, [id, user, loading, router, loadCliente]);

  const handleTemplateChange = (type: 'reminder' | 'urgent' | 'custom') => {
    setTemplateType(type);
    
    if (!cliente) return;

    if (type === 'reminder') {
      setAsunto('Recordatorio: Subida de Documentos');
      setMensaje(
        `Estimado/a ${cliente.persona_contacto},\n\n` +
        `Le recordamos que es importante mantener sus documentos actualizados en el sistema. ` +
        `Esto nos permite ofrecerle un mejor servicio y mantener su contabilidad al día.\n\n` +
        `Por favor, suba los documentos pendientes cuando le sea posible.\n\n` +
        `Saludos,\n${user?.nombre}`
      );
    } else if (type === 'urgent') {
      setAsunto('URGENTE: Documentos Pendientes - Acción Requerida');
      setMensaje(
        `Estimado/a ${cliente.persona_contacto},\n\n` +
        `Le contactamos con carácter URGENTE. Hemos detectado que lleva un tiempo considerable ` +
        `sin subir documentos al sistema, lo que está afectando el procesamiento de su contabilidad.\n\n` +
        `Es imprescindible que suba los documentos pendientes lo antes posible para evitar retrasos ` +
        `en sus obligaciones fiscales.\n\n` +
        `Por favor, contacte con nosotros si necesita ayuda.\n\n` +
        `Urgentemente,\n${user?.nombre}`
      );
    } else {
      setMensaje('');
    }
  };

  const handleSend = async () => {
    if (!mensaje.trim()) {
      toast.error('Por favor, escribe un mensaje');
      return;
    }

    setSending(true);

    try {
      // Send notification via API
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: id,
          asunto,
          mensaje,
          asesorId: user?.id,
          type: 'upload_reminder'
        })
      });

      if (!response.ok) throw new Error('Error sending notification');

      toast.success('Notificación enviada correctamente');
      
      // Log activity
      await supabase.from('actividad_reciente').insert({
        tipo: 'notificacion_cliente',
        descripcion: `Notificación enviada a ${cliente.razon_social}`,
        usuario_id: user?.id,
        usuario_nombre: user?.nombre || 'Asesor',
        enlace: `/asesor/clientes`
      });

      router.push('/asesor/index');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar notificación');
    } finally {
      setSending(false);
    }
  };

  const handleScheduleAutomatic = async () => {
    try {
      const response = await fetch('/api/notifications/schedule-automatic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: id,
          threshold: 15, // days without upload
          enabled: true
        })
      });

      if (!response.ok) throw new Error('Error scheduling');

      toast.success('Notificaciones automáticas configuradas');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al configurar notificaciones automáticas');
    }
  };

  if (loading || !cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-asesor"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Notificar Cliente - Externaliza2</title>
      </Head>
      <Layout rol="asesor">
        <div className="h-[calc(100vh-72px)] overflow-y-auto max-w-4xl mx-auto space-y-6 p-4 md:p-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notificar Cliente</h1>
            <p className="text-gray-600 mt-1">
              Enviar recordatorio a {cliente.razon_social}
            </p>
          </div>

          {/* Client Info Card */}
          <div className="card bg-blue-50 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">
                  {cliente.nombre_comercial || cliente.razon_social}
                </h3>
                <p className="text-sm text-gray-600">{cliente.nif}</p>
                <p className="text-sm text-gray-600">Contacto: {cliente.persona_contacto}</p>
                <p className="text-sm text-gray-600">Email: {cliente.email}</p>
              </div>
              <button
                onClick={handleScheduleAutomatic}
                className="btn btn-secondary"
              >
                ⚙️ Configurar Automático
              </button>
            </div>
          </div>

          {/* Template Selection */}
          <div className="card">
            <h3 className="font-bold text-lg mb-4">Plantilla de Mensaje</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleTemplateChange('reminder')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  templateType === 'reminder'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">📝</div>
                <div className="font-semibold">Recordatorio</div>
                <div className="text-xs text-gray-600 mt-1">Mensaje amigable</div>
              </button>
              <button
                onClick={() => handleTemplateChange('urgent')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  templateType === 'urgent'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">⚠️</div>
                <div className="font-semibold">Urgente</div>
                <div className="text-xs text-gray-600 mt-1">Requiere acción</div>
              </button>
              <button
                onClick={() => handleTemplateChange('custom')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  templateType === 'custom'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">✏️</div>
                <div className="font-semibold">Personalizado</div>
                <div className="text-xs text-gray-600 mt-1">Escribe tu mensaje</div>
              </button>
            </div>
          </div>

          {/* Message Form */}
          <div className="card">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asunto
                </label>
                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje
                </label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={10}
                  className="input w-full"
                  placeholder="Escribe tu mensaje aquí..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4">
            <button
              onClick={handleSend}
              disabled={sending || !mensaje.trim()}
              className="btn btn-asesor flex-1"
            >
              {sending ? 'Enviando...' : '📧 Enviar Notificación'}
            </button>
            <button
              onClick={() => router.push('/asesor/index')}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Layout>
    </>
  );
}
