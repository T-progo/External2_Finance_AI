'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { supabase } from './supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const ROLE_STORAGE_KEY = 'selectedRole';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string, rol: UserRole) => Promise<void>;
  signup: (email: string, password: string, nombre: string, rol?: UserRole) => Promise<string | null>;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  impersonate: (userId: string) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getStoredRole = (): UserRole | null => {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem(ROLE_STORAGE_KEY) as UserRole) || null;
  };

  const persistSelectedRole = (rol?: UserRole) => {
    if (typeof window === 'undefined') return;
    if (rol) {
      localStorage.setItem(ROLE_STORAGE_KEY, rol);
    } else {
      localStorage.removeItem(ROLE_STORAGE_KEY);
    }
  };

  // Fetch user profile from database
  interface FetchUserProfileOptions {
    strictRole?: boolean;
  }

  const fetchUserProfile = async (
    authUser: SupabaseUser,
    preferredRole?: UserRole,
    options?: FetchUserProfileOptions
  ): Promise<User | null> => {
    try {
      const { strictRole = false } = options || {};

      // Fetch basic profile data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      if (!profile) return null;

      const { data: roleRows, error: rolesError } = await supabase
        .from('user_roles')
        .select('rol')
        .eq('user_id', authUser.id);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
      }

      let availableRoles: UserRole[] = roleRows?.map(r => r.rol as UserRole) || [];

      if (profile.rol && !availableRoles.includes(profile.rol as UserRole)) {
        availableRoles.push(profile.rol as UserRole);
      }

      availableRoles = Array.from(new Set(availableRoles));

      let activeRole = preferredRole;
      if (activeRole && !availableRoles.includes(activeRole)) {
        if (strictRole) {
          throw new Error('ROL_NO_AUTORIZADO');
        }
        activeRole = undefined;
      }

      if (!activeRole) {
        activeRole = availableRoles[0];
      }

      if (!activeRole) {
        throw new Error('SIN_ROLES_ASIGNADOS');
      }

      // Fetch cliente modules configuration if user is a cliente
      let clienteModules = null;
      if (activeRole === 'cliente') {
        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select("id,modulo_subida_documentos,modulo_incidencias,modulo_asistente_e2,modulo_panel_financiero,modulo_facturacion")
          .eq('user_id', authUser.id)
          .single();

        if (!clienteError && clienteData) {
          clienteModules = clienteData;
        }
      }

      // Get assigned clients for asesores
      let clientesAsignados: string[] = [];
      if (activeRole === 'asesor') {
        const { data: asignaciones } = await supabase
          .from('asesor_cliente')
          .select('cliente_id')
          .eq('asesor_id', profile.id);
        
        clientesAsignados = asignaciones?.map(a => a.cliente_id) || [];
      }

      // Get assigned asesores for clientes
      let asesoresAsignados: string[] = [];
      if (activeRole === 'cliente' && clienteModules) {
        const { data: asignaciones } = await supabase
          .from('asesor_cliente')
          .select('asesor_id')
          .eq('cliente_id', clienteModules.id);
        
        asesoresAsignados = asignaciones?.map(a => a.asesor_id) || [];
      }

      // Build user object
      const userObj: User = {
        id: profile.id,
        nombre: profile.nombre,
        email: profile.email,
        rol: activeRole,
        roles: availableRoles,
        estado: profile.estado as 'activo' | 'inactivo',
        telefono: profile.telefono,
        fechaAlta: new Date(profile.fecha_alta),
        ultimoAcceso: profile.ultimo_acceso ? new Date(profile.ultimo_acceso) : undefined,
        notasInternas: profile.notas_internas,
        ...(activeRole === 'asesor' && { clientesAsignados }),
        ...(activeRole === 'cliente' && {
          asesoresAsignados,
          modulosActivos: clienteModules ? {
            subidaDocumentos: clienteModules.modulo_subida_documentos ?? false,
            incidencias: clienteModules.modulo_incidencias ?? false,
            asistenteE2: clienteModules.modulo_asistente_e2 ?? false,
            panelFinanciero: clienteModules.modulo_panel_financiero ?? false,
            facturacion: clienteModules.modulo_facturacion ?? false,
          } : undefined
        }),
      };

      return userObj;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const storedRole = getStoredRole();

        const loadProfile = async (roleOverride?: UserRole) => {
          try {
            const profile = await fetchUserProfile(session.user, roleOverride, { strictRole: false });
            setUser(profile);

            if (profile) {
              persistSelectedRole(profile.rol);
            }
          } catch (error: any) {
            if (roleOverride && error?.message === 'ROL_NO_AUTORIZADO') {
              persistSelectedRole(undefined);
              return loadProfile(undefined);
            }
            console.error('Error loading advisor data:', error);
            setUser(null);
            persistSelectedRole(undefined);
          } finally {
            setLoading(false);
          }
        };

        loadProfile(storedRole || undefined);
      } else {
        setLoading(false);
      }
    });
    
  }, []);

  const login = async (email: string, password: string, rol: UserRole) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message || 'Error al iniciar sesión');
    }

    if (data.user) {
      try {
        const baseProfile = await fetchUserProfile(data.user);

        if (!baseProfile) {
          await supabase.auth.signOut();
          throw new Error('No se pudo cargar tu perfil.');
        }

        if (!baseProfile.roles?.includes(rol)) {
          await supabase.auth.signOut();
          throw new Error('No tienes asignado el rol seleccionado.');
        }

        const profile =
          baseProfile.rol === rol
            ? baseProfile
            : await fetchUserProfile(data.user, rol);

        setUser(profile);
        persistSelectedRole(profile?.rol);
      } catch (err: any) {
        await supabase.auth.signOut();
        throw err;
      }
    }
  };

  /**
   * Internal signup function - Only for admin and advisor use to create users
   * NOT for public self-registration
   * @returns The created user's ID
   */
  const signup = async (email: string, password: string, nombre: string, rol: UserRole = 'cliente'): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          rol,
        },
      },
    });

    if (error) {
      throw new Error(error.message || 'Error al registrarse');
    }

    // The profile is automatically created via database trigger
    // Return the user ID so the caller can create related records (e.g., cliente)
    const userId = data.user?.id || null;

    if (userId) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, rol });

      if (roleError) {
        console.error('Error assigning initial role:', roleError);
      }
    }

    return userId;
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      persistSelectedRole(undefined);
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Error al cerrar sesión');
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message || 'Error al enviar correo de recuperación');
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message || 'Error al actualizar contraseña');
    }
  };

  const impersonate = async (userId: string) => {
    // Only admins can impersonate
    if (user?.rol !== 'admin') {
      throw new Error('No tiene permisos para esta acción');
    }

    try {
      const { data: targetProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !targetProfile) {
        throw new Error('Usuario no encontrado');
      }

      // Note: In production, you would need a more sophisticated impersonation system
      // This is a simplified version for demo purposes
      console.log('Impersonation feature requires additional backend setup');
      toast.error('La funcionalidad de impersonación requiere configuración adicional en el backend');
    } catch (error) {
      console.error('Error impersonating user:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        setUser, 
        login, 
        signup, 
        logout, 
        resetPassword, 
        updatePassword, 
        impersonate, 
        loading 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
