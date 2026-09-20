import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { 
  getClienteById, 
  getClienteIdByUserId, 
  updateCliente,
  getUserPreferences,
  updateUserPreferences,
  getNotificationSettings,
  updateNotificationSettings,
  type UserPreferences,
  type NotificationSettings,
} from '@/lib/supabaseService';
import { useAuth } from '@/lib/authContext';
import type { Cliente, User } from '@/types';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

export default function ClientePerfil() {
  const { user } = useAuth();
  const [clienteData, setClienteData] = useState<Cliente | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [asesores, setAsesores] = useState<User[]>([]);

  // Fetch client data, preferences, and notification settings from Supabase
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      setLoadingData(true);
      try {
        // Fetch client data
        const cId = await getClienteIdByUserId(user.id);
        if (!cId) {
          console.error('No se encontró el cliente para este usuario');
          setLoadingData(false);
          return;
        }

        const cliente = await getClienteById(cId);
        setClienteData(cliente);

        // Set initial form values
        if (cliente) {
          setDatosEditados({
            personaContacto: cliente.personaContacto || '',
            telefono: cliente.telefono || '',
            email: cliente.email || '',
          });
        }

        // Fetch user preferences
        const prefs = await getUserPreferences(user.id);
        setPreferencias(prefs);

        // Fetch notification settings
        const notifs = await getNotificationSettings(user.id);
        setNotificaciones(notifs);

        // Fetch assigned asesores
        if (user.asesoresAsignados && user.asesoresAsignados.length > 0) {
          const { data: asesoresData } = await supabase
            .from('profiles')
            .select('id, nombre, email, telefono')
            .in('id', user.asesoresAsignados);
          
          if (asesoresData) {
            setAsesores(asesoresData as User[]);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error al cargar los datos');
      } finally {
        setLoadingData(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user?.id, user?.asesoresAsignados]);
  
  const [modoEdicion, setModoEdicion] = useState(false);
  const [vistaActiva, setVistaActiva] = useState<'info' | 'notificaciones' | 'seguridad' | 'preferencias' | 'soporte'>('info');
  
  const [datosEditados, setDatosEditados] = useState({
    personaContacto: '',
    telefono: '',
    email: '',
  });

  // Sync form state with clienteData whenever it changes or edit mode is entered
  useEffect(() => {
    if (clienteData && modoEdicion) {
      setDatosEditados({
        personaContacto: clienteData.personaContacto || '',
        telefono: clienteData.telefono || '',
        email: clienteData.email || '',
      });
    }
  }, [clienteData, modoEdicion]);

  // Configuración de notificaciones
  const [notificaciones, setNotificaciones] = useState<NotificationSettings>({
    documentosSubidos: true,
    documentosContabilizados: true,
    incidenciasNuevas: true,
    incidenciasResueltas: true,
    informesDisponibles: true,
    recordatoriosIA: true,
    vencimientosFiscales: true,
    actualizacionesPlataforma: false,
  });

  // Preferencias de la plataforma
  const [preferencias, setPreferencias] = useState<UserPreferences>({
    modoOscuro: false,
    idioma: 'es',
    tamanoPagina: 20,
    vistaDocumentosPorDefecto: 'tabla',
  });

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteData) {
      toast.error('No hay datos del cliente');
      return;
    }

    // Validate form data
    if (!datosEditados.personaContacto || !datosEditados.telefono || !datosEditados.email) {
      toast.error('Por favor, completa todos los campos');
      return;
    }

    try {
      console.log('Updating cliente with ID:', clienteData.id);
      console.log('New data:', datosEditados);

      await updateCliente(clienteData.id, {
        personaContacto: datosEditados.personaContacto,
        telefono: datosEditados.telefono,
        email: datosEditados.email,
      });

      console.log('Update successful!');

      // Update local state
      setClienteData({
        ...clienteData,
        personaContacto: datosEditados.personaContacto,
        telefono: datosEditados.telefono,
        email: datosEditados.email,
      });

      toast.success('✓ Perfil actualizado correctamente');
      setModoEdicion(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Error al actualizar el perfil');
    }
  };

  const handleGuardarNotificaciones = async () => {
    if (!user?.id) return;

    try {
      await updateNotificationSettings(user.id, notificaciones);
      toast.success('Preferencias de notificaciones guardadas correctamente');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Error al guardar las preferencias de notificaciones');
    }
  };

  const handleGuardarPreferencias = async () => {
    if (!user?.id) return;

    try {
      await updateUserPreferences(user.id, preferencias);
      toast.success('Preferencias guardadas correctamente');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Error al guardar las preferencias');
    }
  };

  const handleCambiarContrasena = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(passwordForm.newPassword);
    const hasLowerCase = /[a-z]/.test(passwordForm.newPassword);
    const hasNumbers = /\d/.test(passwordForm.newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      toast.error('La contraseña debe incluir mayúsculas, minúsculas y números');
      return;
    }

    try {
      // Update password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      toast.success('Contraseña cambiada correctamente');
      
      // Clear form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Error al cambiar la contraseña');
    }
  };

  const handleCerrarSesion = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Sesión cerrada correctamente');
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  if (loadingData) {
    return (
      <Layout rol="cliente">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cliente mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando perfil...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!clienteData) {
    return (
      <Layout rol="cliente">
        <div className="card">
          <p className="text-gray-600">No se encontraron datos del perfil.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="cliente">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-600 mt-1">Datos de tu empresa y configuración de la cuenta</p>
        </div>

        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && clienteData && (
          <div className="card bg-blue-50 border-blue-300">
            <div className="text-xs text-blue-800">
              <strong>🔧 Debug Info:</strong> Cliente ID: <code>{clienteData.id}</code>
              {user?.id && <> | User ID: <code>{user.id}</code></>}
            </div>
          </div>
        )}

        {/* Tarjeta de perfil */}
        <div className="card bg-gradient-to-br from-cliente/10 to-cliente/5 border-2 border-cliente/20">
          <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-full bg-cliente flex items-center justify-center text-white text-3xl font-bold">
              {clienteData.razonSocial.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{clienteData.razonSocial}</h2>
              <p className="text-gray-600">{clienteData.nif}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`badge ${
                clienteData.estado === 'activo' ? 'badge-success' : 'badge-secondary'
              }`}>
                {clienteData.estado === 'activo' ? '✓ Cuenta Activa' : '○ Cuenta Inactiva'}
              </span>
                  <span className="text-xs text-gray-500">
                    Cliente desde {new Date(clienteData.fechaAlta).toLocaleDateString('es-ES', {
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-5xl">👤</div>
          </div>
        </div>

        {/* Navegación de pestañas */}
        <div className="flex flex-wrap space-x-2 border-b border-gray-200">
          <button
            onClick={() => setVistaActiva('info')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              vistaActiva === 'info' 
                ? 'border-cliente text-cliente' 
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Información
          </button>
          <button
            onClick={() => setVistaActiva('notificaciones')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              vistaActiva === 'notificaciones' 
                ? 'border-cliente text-cliente' 
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🔔 Notificaciones
          </button>
          <button
            onClick={() => setVistaActiva('seguridad')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              vistaActiva === 'seguridad' 
                ? 'border-cliente text-cliente' 
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🔒 Seguridad
          </button>
          <button
            onClick={() => setVistaActiva('preferencias')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              vistaActiva === 'preferencias' 
                ? 'border-cliente text-cliente' 
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            ⚙️ Preferencias
          </button>
          <button
            onClick={() => setVistaActiva('soporte')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              vistaActiva === 'soporte' 
                ? 'border-cliente text-cliente' 
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            💬 Soporte
          </button>
        </div>

        {/* Vista de Información */}
        {vistaActiva === 'info' && (
          <div className="space-y-6">
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Información de la Empresa</h3>
            {!modoEdicion && (
              <button
                onClick={() => setModoEdicion(true)}
                className="btn btn-sm btn-cliente"
              >
                ✏️ Editar
              </button>
            )}
          </div>

          {!modoEdicion ? (
            <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                      <label className="text-sm text-gray-600 font-medium">NIF</label>
                      <p className="text-lg text-gray-900 mt-1">{clienteData.nif}</p>
                      <p className="text-xs text-gray-500 mt-1">Este campo no se puede modificar</p>
                </div>
                <div>
                      <label className="text-sm text-gray-600 font-medium">Razón Social</label>
                      <p className="text-lg text-gray-900 mt-1">{clienteData.razonSocial}</p>
                      <p className="text-xs text-gray-500 mt-1">Contacta con tu asesor para cambios</p>
                </div>
              </div>

              {clienteData.nombreComercial && (
                <div>
                      <label className="text-sm text-gray-600 font-medium">Nombre Comercial</label>
                      <p className="text-lg text-gray-900 mt-1">{clienteData.nombreComercial}</p>
                </div>
              )}

              <div>
                    <label className="text-sm text-gray-600 font-medium">Dirección Fiscal</label>
                    <p className="text-lg text-gray-900 mt-1">{clienteData.direccionFiscal}</p>
                    <p className="text-xs text-gray-500 mt-1">Contacta con tu asesor para cambios</p>
              </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                      <label className="text-sm text-gray-600 font-medium">Persona de Contacto</label>
                      <p className="text-lg text-gray-900 mt-1">{clienteData.personaContacto}</p>
                </div>
                <div>
                      <label className="text-sm text-gray-600 font-medium">Teléfono</label>
                      <p className="text-lg text-gray-900 mt-1">{clienteData.telefono}</p>
                </div>
              </div>

              <div>
                    <label className="text-sm text-gray-600 font-medium">Email</label>
                    <p className="text-lg text-gray-900 mt-1">{clienteData.email}</p>
              </div>

              <div>
                    <label className="text-sm text-gray-600 font-medium">Fecha de Alta</label>
                    <p className="text-lg text-gray-900 mt-1">
                  {new Date(clienteData.fechaAlta).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGuardar} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      ℹ️ Solo puedes editar datos de contacto. Para cambios en NIF, razón social o dirección fiscal, contacta con tu asesor.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    value={datosEditados.personaContacto}
                    onChange={(e) => setDatosEditados({ ...datosEditados, personaContacto: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    className="input w-full"
                    value={datosEditados.telefono}
                    onChange={(e) => setDatosEditados({ ...datosEditados, telefono: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  className="input w-full"
                  value={datosEditados.email}
                  onChange={(e) => setDatosEditados({ ...datosEditados, email: e.target.value })}
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button type="submit" className="btn btn-cliente flex-1">
                  ✓ Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => setModoEdicion(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

            {/* Asesor asignado */}
            {asesores.length > 0 && (
              <div className="card bg-blue-50 border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {asesores.length === 1 ? 'Asesor Asignado' : 'Asesores Asignados'}
                </h3>
                <div className="space-y-3">
                  {asesores.map((asesor) => (
                    <div key={asesor.id} className="flex items-center space-x-4 p-4 bg-white rounded-lg border border-blue-100">
                      <div className="w-12 h-12 rounded-full bg-asesor flex items-center justify-center text-white text-xl font-bold">
                        {asesor.nombre.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{asesor.nombre}</div>
                        <div className="text-sm text-gray-600">{asesor.email}</div>
                        {asesor.telefono && (
                          <div className="text-sm text-gray-600">📞 {asesor.telefono}</div>
                        )}
                      </div>
                      <button
                        onClick={() => window.location.href = '/cliente/incidencias'}
                        className="btn btn-sm btn-asesor"
                      >
                        💬 Contactar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Módulos activos */}
        <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Módulos Contratados</h3>
              <p className="text-sm text-gray-600 mb-4">
                Estos son los servicios que tienes activos en tu plan:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'subidaDocumentos', label: 'Subida de Documentos', icon: '📤', descripcion: 'Sube y gestiona tus facturas' },
                  { key: 'incidencias', label: 'Gestión de Incidencias', icon: '💬', descripcion: 'Chat con tu asesor' },
                  { key: 'panelFinanciero', label: 'Panel Financiero', icon: '💰', descripcion: 'Análisis financiero simplificado' },
                  { key: 'asistenteE2', label: 'Asistente E2', icon: '🤖', descripcion: 'IA para consultas rápidas' },
                  { key: 'facturacion', label: 'Facturación', icon: '🧾', descripcion: 'Crea y gestiona facturas' },
                ].map((modulo) => {
                  const activo = clienteData.modulosActivos?.[modulo.key as keyof typeof clienteData.modulosActivos];
                  return (
              <div
                key={modulo.key}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        activo
                          ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300'
                          : 'bg-gray-50 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                  <span className="text-3xl">{modulo.icon}</span>
                  <div className="flex-1">
                          <div className="font-semibold text-gray-900">{modulo.label}</div>
                          <div className="text-xs text-gray-600 mt-1">{modulo.descripcion}</div>
                          <div className={`text-xs font-medium mt-2 ${
                            activo ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {activo ? '✓ Activo' : '○ No contratado'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600">💡</span>
                  <div className="text-sm text-yellow-800">
                    <strong>¿Quieres ampliar tu plan?</strong><br/>
                    Si necesitas activar o desactivar módulos, contacta con tu asesor para conocer las opciones disponibles y precios.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vista de Notificaciones */}
        {vistaActiva === 'notificaciones' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferencias de Notificaciones</h3>
            <p className="text-sm text-gray-600 mb-6">
              Elige qué tipo de avisos quieres recibir. Las notificaciones te ayudan a estar al día con tu empresa.
            </p>

            <div className="space-y-6">
              {/* Documentos */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">📄</span>
                  Documentos
                </h4>
                <div className="space-y-3 ml-6">
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Documentos Subidos</div>
                      <div className="text-xs text-gray-600">Confirmación cuando subes nuevos documentos</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificaciones.documentosSubidos}
                      onChange={(e) => setNotificaciones({...notificaciones, documentosSubidos: e.target.checked})}
                      className="w-5 h-5 text-cliente rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Documentos Contabilizados</div>
                      <div className="text-xs text-gray-600">Aviso cuando tu asesor contabiliza tus documentos</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificaciones.documentosContabilizados}
                      onChange={(e) => setNotificaciones({...notificaciones, documentosContabilizados: e.target.checked})}
                      className="w-5 h-5 text-cliente rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Incidencias */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">⚠️</span>
                  Incidencias
                </h4>
                <div className="space-y-3 ml-6">
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Nuevas Incidencias</div>
                      <div className="text-xs text-gray-600">Cuando la IA o tu asesor crean una incidencia</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificaciones.incidenciasNuevas}
                      onChange={(e) => setNotificaciones({...notificaciones, incidenciasNuevas: e.target.checked})}
                      className="w-5 h-5 text-cliente rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Incidencias Resueltas</div>
                      <div className="text-xs text-gray-600">Cuando tu asesor marca una incidencia como resuelta</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificaciones.incidenciasResueltas}
                      onChange={(e) => setNotificaciones({...notificaciones, incidenciasResueltas: e.target.checked})}
                      className="w-5 h-5 text-cliente rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Informes */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">📊</span>
                  Informes y Finanzas
                </h4>
                <div className="space-y-3 ml-6">
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Informes Disponibles</div>
                      <div className="text-xs text-gray-600">Cuando tu asesor sube nuevos informes financieros</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificaciones.informesDisponibles}
                      onChange={(e) => setNotificaciones({...notificaciones, informesDisponibles: e.target.checked})}
                      className="w-5 h-5 text-cliente rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Recordatorios */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">⏰</span>
                  Recordatorios
                </h4>
                <div className="space-y-3 ml-6">
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Recordatorios de IA</div>
                      <div className="text-xs text-gray-600">Avisos inteligentes sobre tareas pendientes</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificaciones.recordatoriosIA}
                      onChange={(e) => setNotificaciones({...notificaciones, recordatoriosIA: e.target.checked})}
                      className="w-5 h-5 text-cliente rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Vencimientos Fiscales</div>
                      <div className="text-xs text-gray-600">Recordatorios de fechas de IVA, IRPF y otros impuestos</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificaciones.vencimientosFiscales}
                      onChange={(e) => setNotificaciones({...notificaciones, vencimientosFiscales: e.target.checked})}
                      className="w-5 h-5 text-cliente rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Otros */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">🔔</span>
                  Otros
                </h4>
                <div className="space-y-3 ml-6">
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Actualizaciones de la Plataforma</div>
                      <div className="text-xs text-gray-600">Novedades y mejoras de Externaliza2</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificaciones.actualizacionesPlataforma}
                      onChange={(e) => setNotificaciones({...notificaciones, actualizacionesPlataforma: e.target.checked})}
                      className="w-5 h-5 text-cliente rounded"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button onClick={handleGuardarNotificaciones} className="btn btn-cliente">
                ✓ Guardar Preferencias
              </button>
            </div>
          </div>
        )}

        {/* Vista de Seguridad */}
        {vistaActiva === 'seguridad' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Contraseña</h3>
              <form onSubmit={handleCambiarContrasena} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    className="input w-full"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Mínimo 8 caracteres, incluyendo mayúsculas, minúsculas y números
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    className="input w-full"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-cliente">
                  🔒 Cambiar Contraseña
                </button>
              </form>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sesiones Activas</h3>
              <p className="text-sm text-gray-600 mb-4">
                Gestiona los dispositivos donde has iniciado sesión
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">💻</span>
                    <div>
                      <div className="font-medium text-gray-900">Sesión Actual</div>
                      <div className="text-xs text-gray-600">
                        {user?.email} • {new Date().toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCerrarSesion}
                    className="btn btn-sm btn-secondary"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Si detectas actividad sospechosa, cambia tu contraseña inmediatamente y contacta con soporte.
          </p>
        </div>

            <div className="card bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">🔐</div>
                <div className="text-sm text-blue-800">
                  <strong>Autenticación de Dos Factores (2FA)</strong><br/>
                  Próximamente podrás activar la verificación en dos pasos para mayor seguridad en tu cuenta.
                  Esta función te permitirá usar tu móvil como segundo factor de autenticación.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vista de Preferencias */}
        {vistaActiva === 'preferencias' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferencias de la Plataforma</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modo de Visualización
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!preferencias.modoOscuro}
                      onChange={() => setPreferencias({...preferencias, modoOscuro: false})}
                      className="w-4 h-4 text-cliente"
                    />
                    <span className="text-sm text-gray-700">☀️ Modo Claro</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferencias.modoOscuro}
                      onChange={() => setPreferencias({...preferencias, modoOscuro: true})}
                      className="w-4 h-4 text-cliente"
                    />
                    <span className="text-sm text-gray-700">🌙 Modo Oscuro (Próximamente)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idioma
                </label>
                <select 
                  className="input w-full max-w-xs"
                  value={preferencias.idioma}
                  onChange={(e) => setPreferencias({...preferencias, idioma: e.target.value})}
                >
                  <option value="es">🇪🇸 Español</option>
                  <option value="ca">🇪🇸 Català (Próximamente)</option>
                  <option value="en">🇬🇧 English (Próximamente)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Elementos por Página
                </label>
                <select 
                  className="input w-full max-w-xs"
                  value={preferencias.tamanoPagina}
                  onChange={(e) => setPreferencias({...preferencias, tamanoPagina: parseInt(e.target.value)})}
                >
                  <option value={10}>10 elementos</option>
                  <option value={20}>20 elementos</option>
                  <option value={50}>50 elementos</option>
                  <option value={100}>100 elementos</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vista de Documentos por Defecto
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferencias.vistaDocumentosPorDefecto === 'tabla'}
                      onChange={() => setPreferencias({...preferencias, vistaDocumentosPorDefecto: 'tabla'})}
                      className="w-4 h-4 text-cliente"
                    />
                    <span className="text-sm text-gray-700">📋 Tabla</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferencias.vistaDocumentosPorDefecto === 'tarjetas'}
                      onChange={() => setPreferencias({...preferencias, vistaDocumentosPorDefecto: 'tarjetas'})}
                      className="w-4 h-4 text-cliente"
                    />
                    <span className="text-sm text-gray-700">🗂️ Tarjetas</span>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button onClick={handleGuardarPreferencias} className="btn btn-cliente">
                  ✓ Guardar Preferencias
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vista de Soporte */}
        {vistaActiva === 'soporte' && (
          <div className="space-y-6">
            <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <div className="flex items-start space-x-4">
                <div className="text-4xl">💬</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-yellow-900 mb-2">¿Necesitas Ayuda?</h3>
                  <p className="text-sm text-yellow-800 mb-4">
                    Estamos aquí para ayudarte. Contacta con tu asesor para consultas específicas 
                    o usa el Asistente E2 para respuestas rápidas.
                  </p>
                </div>
              </div>
            </div>

            {/* Opciones de contacto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contactar con Asesor */}
              <div className="card bg-blue-50 border-blue-200">
                <div className="text-center">
                  <div className="text-5xl mb-4">👤</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Contacta con tu Asesor</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Para consultas sobre tu contabilidad, dudas fiscales o cambios en tus datos.
                  </p>
                  <button 
                    onClick={() => window.location.href = '/cliente/incidencias'}
                    className="btn btn-asesor w-full"
                  >
                    💬 Abrir Chat con Asesor
                  </button>
                  {asesores.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <p className="text-xs text-gray-600 mb-2">Tu asesor asignado:</p>
                      {asesores.map((asesor) => (
                        <div key={asesor.id} className="text-sm font-medium text-gray-900">
                          {asesor.nombre}
                          {asesor.email && <div className="text-xs text-gray-600">{asesor.email}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Asistente E2 */}
              <div className="card bg-green-50 border-green-200">
                <div className="text-center">
                  <div className="text-5xl mb-4">🤖</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Asistente E2</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Obtén respuestas instantáneas sobre tu empresa, documentos y finanzas.
                  </p>
                  <button 
                    onClick={() => window.location.href = '/cliente/asistente'}
                    className="btn btn-cliente w-full"
                  >
                    🤖 Abrir Asistente E2
                  </button>
                  <p className="text-xs text-gray-500 mt-3">
                    Disponible 24/7 para consultas rápidas
                  </p>
                </div>
              </div>
            </div>

            {/* Guía rápida */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">📖</span>
                Guía Rápida de la Plataforma
              </h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cliente/20 flex items-center justify-center text-cliente font-semibold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Subir Documentos</h4>
                    <p className="text-sm text-gray-600">
                      Accede a &quot;Documentos&quot; y arrastra tus facturas. La IA las procesará automáticamente.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cliente/20 flex items-center justify-center text-cliente font-semibold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Revisar Incidencias</h4>
                    <p className="text-sm text-gray-600">
                      Si la IA detecta algún problema, lo verás en &quot;Incidencias&quot;. Responde para resolverlo.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cliente/20 flex items-center justify-center text-cliente font-semibold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Consultar Panel Financiero</h4>
                    <p className="text-sm text-gray-600">
                      Visualiza tus métricas financieras y obtén análisis simplificados de tu negocio.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cliente/20 flex items-center justify-center text-cliente font-semibold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Usar el Asistente E2</h4>
                    <p className="text-sm text-gray-600">
                      Pregunta cualquier cosa sobre tu empresa al asistente de IA disponible 24/7.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preguntas Frecuentes</h3>
              <div className="space-y-4">
                <details className="group">
                  <summary className="cursor-pointer font-medium text-gray-900 hover:text-cliente flex items-center justify-between">
                    <span>¿Cómo puedo cambiar mi NIF o dirección fiscal?</span>
                    <span className="group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-2 pl-4">
                    Estos datos son críticos y no se pueden cambiar directamente. Contacta con tu asesor 
                    quien verificará la información y actualizará tu perfil.
                  </p>
                </details>

                <details className="group">
                  <summary className="cursor-pointer font-medium text-gray-900 hover:text-cliente flex items-center justify-between">
                    <span>¿Qué hago si tengo un problema con un documento?</span>
                    <span className="group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-2 pl-4">
                    Si un documento tiene errores o la IA no lo procesó correctamente, aparecerá automáticamente 
                    una incidencia. También puedes crear una incidencia manualmente desde la sección de Incidencias.
                  </p>
                </details>

                <details className="group">
                  <summary className="cursor-pointer font-medium text-gray-900 hover:text-cliente flex items-center justify-between">
                    <span>¿Cómo activo más módulos?</span>
                    <span className="group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-2 pl-4">
                    Los módulos disponibles dependen de tu plan contratado. Contacta con tu asesor 
                    para conocer las opciones y precios de los módulos adicionales.
                  </p>
                </details>

                <details className="group">
                  <summary className="cursor-pointer font-medium text-gray-900 hover:text-cliente flex items-center justify-between">
                    <span>¿Es segura la plataforma?</span>
                    <span className="group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-2 pl-4">
                    Sí, utilizamos encriptación de extremo a extremo, almacenamiento seguro en Supabase, 
                    y cumplimos con todas las normativas de protección de datos (GDPR). Próximamente 
                    también podrás activar autenticación de dos factores (2FA).
                  </p>
                </details>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
