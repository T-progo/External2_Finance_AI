import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import { getNotificationSettings, updateNotificationSettings, NotificationSettings } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function AsesorConfiguracion() {
  const { user, updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Email form state
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
  });
  
  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    documentosSubidos: true,
    documentosContabilizados: true,
    incidenciasNuevas: true,
    incidenciasResueltas: true,
    informesDisponibles: true,
    recordatoriosIA: true,
    vencimientosFiscales: true,
    actualizacionesPlataforma: false,
  });

  // Load notification settings on mount
  useEffect(() => {
    if (user?.id) {
      loadNotificationSettings();
    }
  }, [user]);

  const loadNotificationSettings = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const settings = await getNotificationSettings(user.id);
      setNotificationSettings(settings);
    } catch (error: any) {
      console.error('Error loading notification settings:', error);
      toast.error('Error al cargar las preferencias de notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Por favor, completa todos los campos');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    
    try {
      setSavingPassword(true);
      
      // Check if new password is the same as current password
      if (passwordForm.currentPassword === passwordForm.newPassword) {
        toast.error('La nueva contraseña debe ser diferente a la contraseña actual');
        setSavingPassword(false);
        return;
      }
      
      // Verify current password by attempting to sign in
      if (user?.email && passwordForm.currentPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: passwordForm.currentPassword,
        });
        
        if (signInError) {
          toast.error('La contraseña actual es incorrecta');
          setSavingPassword(false);
          return;
        }
      }
      
      // Update password
      await updatePassword(passwordForm.newPassword);
      
      toast.success('Contraseña actualizada correctamente');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      
      // Handle specific Supabase error messages
      const errorMessage = error.message || '';
      if (errorMessage.includes('should be different from the old password')) {
        toast.error('La nueva contraseña debe ser diferente a tu contraseña actual');
      } else if (errorMessage.includes('Password should be at least')) {
        toast.error('La contraseña debe tener al menos 6 caracteres');
      } else {
        toast.error(errorMessage || 'Error al actualizar la contraseña');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailForm.newEmail) {
      toast.error('Por favor, ingresa un nuevo correo electrónico');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm.newEmail)) {
      toast.error('Por favor, ingresa un correo electrónico válido');
      return;
    }
    
    if (emailForm.newEmail === user?.email) {
      toast.error('El nuevo correo debe ser diferente al actual');
      return;
    }
    
    try {
      setSavingEmail(true);
      
      // Update email - Supabase will send a confirmation email
      const { error } = await supabase.auth.updateUser({
        email: emailForm.newEmail,
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('Se ha enviado un correo de confirmación a tu nueva dirección. Por favor, verifica tu correo para completar el cambio.');
      setEmailForm({ newEmail: '' });
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast.error(error.message || 'Error al actualizar el correo electrónico');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleNotificationChange = async (key: keyof NotificationSettings, value: boolean) => {
    if (!user?.id) return;
    
    const updatedSettings = {
      ...notificationSettings,
      [key]: value,
    };
    
    setNotificationSettings(updatedSettings);
    
    try {
      setSavingNotifications(true);
      await updateNotificationSettings(user.id, { [key]: value });
      toast.success('Preferencias de notificaciones actualizadas');
    } catch (error: any) {
      console.error('Error updating notification settings:', error);
      toast.error('Error al actualizar las preferencias de notificaciones');
      // Revert on error
      setNotificationSettings(notificationSettings);
    } finally {
      setSavingNotifications(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout rol="asesor">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuración Personal</h1>
          <p className="text-gray-600 mt-1">Perfil, plantillas y preferencias del asesor</p>
        </div>

        {/* Password Section */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cambiar Contraseña</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña Actual
              </label>
              <input
                type="password"
                id="currentPassword"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ingresa tu contraseña actual"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Nueva Contraseña
              </label>
              <input
                type="password"
                id="newPassword"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirma tu nueva contraseña"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="btn btn-asesor disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? 'Guardando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>

        {/* Email Section */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cambiar Correo Electrónico</h2>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Correo actual:</strong> {user.email}
            </p>
          </div>
          <form onSubmit={handleEmailChange} className="space-y-4">
            <div>
              <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Nuevo Correo Electrónico
              </label>
              <input
                type="email"
                id="newEmail"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ newEmail: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="nuevo@correo.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingEmail}
              className="btn btn-asesor disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingEmail ? 'Guardando...' : 'Actualizar Correo'}
            </button>
          </form>
          <p className="mt-3 text-sm text-gray-500">
            Se enviará un correo de confirmación a tu nueva dirección. Debes verificar el correo para completar el cambio.
          </p>
        </div>

        {/* Notification Preferences Section */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Preferencias de Notificaciones</h2>
          <p className="text-sm text-gray-600 mb-6">
            Configura qué notificaciones deseas recibir por correo electrónico.
          </p>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Documentos</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Documentos Subidos</span>
                      <p className="text-xs text-gray-500">Recibir notificación cuando se suban nuevos documentos</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.documentosSubidos}
                      onChange={(e) => handleNotificationChange('documentosSubidos', e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={savingNotifications}
                    />
                  </label>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
