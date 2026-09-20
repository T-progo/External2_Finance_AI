import { supabase } from './supabase';
import { supabaseAdmin } from './supabaseAdmin'
import type {
  User,
  Cliente,
  Documento,
  Incidencia,
  MensajeIncidencia,
  MetricasDashboard,
  ActividadReciente,
  DatosFinancieros,
} from '@/types';

// =============================================
// USER/PROFILE OPERATIONS
// =============================================

export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      console.warn('No profile found for user:', userId);
      return null;
    }

    return {
      id: profile.id,
      nombre: profile.nombre,
      email: profile.email,
      rol: profile.rol,
      estado: profile.estado,
      telefono: profile.telefono,
      fechaAlta: new Date(profile.fecha_alta),
      ultimoAcceso: profile.ultimo_acceso ? new Date(profile.ultimo_acceso) : undefined,
      notasInternas: profile.notas_internas,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<User>) => {
  console.log('[updateUserProfile] Starting update for user:', userId);
  console.log('[updateUserProfile] Updates to apply:', updates);

  try {
    // Call the API route instead of using supabaseAdmin directly
    // This avoids CORS issues by running the admin operations server-side
    const response = await fetch('/api/users/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        updates,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al actualizar el usuario');
    }

    console.log('[updateUserProfile] Update successful!');
  } catch (error: any) {
    console.error('[updateUserProfile] Error updating user:', error);
    
    // Check for network/CORS errors
    const errorMessage = error.message || '';
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('CORS') || 
        errorMessage.includes('ERR_FAILED')) {
      throw new Error(
        'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.'
      );
    }
    
    throw error;
  }
};

export const createUser = async (userData: {
  email: string;
  password: string;
  nombre: string;
  rol: 'admin' | 'asesor' | 'cliente';
  telefono?: string;
  estado?: 'activo' | 'inactivo';
  modulosActivos?: any;
  codigo?: string;
  tipoEmpresa?: string;
  provincia?: string;
  nombreFiscal?: string;
  cif?: string;
}): Promise<string> => {
  console.log('[createUser] Starting user creation:', userData.email);

  try {
    const response = await fetch('/api/users/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al crear el usuario');
    }

    if (!result.userId) {
      throw new Error('No se recibió el ID del usuario creado');
    }

    console.log('[createUser] User created successfully:', result.userId);
    return result.userId;
  } catch (error: any) {
    console.error('[createUser] Error creating user:', error);
    
    // Check for network/CORS errors
    const errorMessage = error.message || '';
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('CORS') || 
        errorMessage.includes('ERR_FAILED')) {
      throw new Error(
        'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.'
      );
    }
    
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  console.log('[deleteUser] Starting user deletion:', userId);

  try {
    const response = await fetch('/api/users/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al eliminar el usuario');
    }

    console.log('[deleteUser] User deleted successfully');
  } catch (error: any) {
    console.error('[deleteUser] Error deleting user:', error);
    
    // Check for network/CORS errors
    const errorMessage = error.message || '';
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('CORS') || 
        errorMessage.includes('ERR_FAILED')) {
      throw new Error(
        'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.'
      );
    }
    
    throw error;
  }
};

// =============================================
// USER PREFERENCES OPERATIONS
// =============================================

export interface UserPreferences {
  modoOscuro: boolean;
  idioma: string;
  tamanoPagina: number;
  vistaDocumentosPorDefecto: string;
}

export const getUserPreferences = async (userId: string): Promise<UserPreferences> => {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  // Return defaults if no preferences found
  if (!data) {
    return {
      modoOscuro: false,
      idioma: 'es',
      tamanoPagina: 20,
      vistaDocumentosPorDefecto: 'tabla',
    };
  }

  return {
    modoOscuro: data.modo_oscuro,
    idioma: data.idioma,
    tamanoPagina: data.tamano_pagina,
    vistaDocumentosPorDefecto: data.vista_documentos_por_defecto,
  };
};

export const updateUserPreferences = async (userId: string, preferences: Partial<UserPreferences>) => {
  const updates: any = {};
  if (preferences.modoOscuro !== undefined) updates.modo_oscuro = preferences.modoOscuro;
  if (preferences.idioma !== undefined) updates.idioma = preferences.idioma;
  if (preferences.tamanoPagina !== undefined) updates.tamano_pagina = preferences.tamanoPagina;
  if (preferences.vistaDocumentosPorDefecto !== undefined) updates.vista_documentos_por_defecto = preferences.vistaDocumentosPorDefecto;

  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      ...updates,
    }, { onConflict: 'user_id' });

  if (error) throw error;
};

// =============================================
// NOTIFICATION SETTINGS OPERATIONS
// =============================================

export interface NotificationSettings {
  documentosSubidos: boolean;
  documentosContabilizados: boolean;
  incidenciasNuevas: boolean;
  incidenciasResueltas: boolean;
  informesDisponibles: boolean;
  recordatoriosIA: boolean;
  vencimientosFiscales: boolean;
  actualizacionesPlataforma: boolean;
}

export const getNotificationSettings = async (userId: string): Promise<NotificationSettings> => {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  // Return defaults if no settings found
  if (!data) {
    return {
      documentosSubidos: true,
      documentosContabilizados: true,
      incidenciasNuevas: true,
      incidenciasResueltas: true,
      informesDisponibles: true,
      recordatoriosIA: true,
      vencimientosFiscales: true,
      actualizacionesPlataforma: false,
    };
  }

  return {
    documentosSubidos: data.documentos_subidos,
    documentosContabilizados: data.documentos_contabilizados,
    incidenciasNuevas: data.incidencias_nuevas,
    incidenciasResueltas: data.incidencias_resueltas,
    informesDisponibles: data.informes_disponibles,
    recordatoriosIA: data.recordatorios_ia,
    vencimientosFiscales: data.vencimientos_fiscales,
    actualizacionesPlataforma: data.actualizaciones_plataforma,
  };
};

export const updateNotificationSettings = async (userId: string, settings: Partial<NotificationSettings>) => {
  const updates: any = {};
  if (settings.documentosSubidos !== undefined) updates.documentos_subidos = settings.documentosSubidos;
  if (settings.documentosContabilizados !== undefined) updates.documentos_contabilizados = settings.documentosContabilizados;
  if (settings.incidenciasNuevas !== undefined) updates.incidencias_nuevas = settings.incidenciasNuevas;
  if (settings.incidenciasResueltas !== undefined) updates.incidencias_resueltas = settings.incidenciasResueltas;
  if (settings.informesDisponibles !== undefined) updates.informes_disponibles = settings.informesDisponibles;
  if (settings.recordatoriosIA !== undefined) updates.recordatorios_ia = settings.recordatoriosIA;
  if (settings.vencimientosFiscales !== undefined) updates.vencimientos_fiscales = settings.vencimientosFiscales;
  if (settings.actualizacionesPlataforma !== undefined) updates.actualizaciones_plataforma = settings.actualizacionesPlataforma;

  const { error } = await supabase
    .from('notification_settings')
    .upsert({
      user_id: userId,
      ...updates,
    }, { onConflict: 'user_id' });

  if (error) throw error;
};

export const getAllUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('fecha_alta', { ascending: false });

  if (error) throw error;

  // Get all users with their additional data (modulosActivos for clientes, clientesAsignados for asesores)
  const usersWithDetails = await Promise.all(
    data.map(async (profile) => {
      const user: User = {
        id: profile.id,
        nombre: profile.nombre,
        email: profile.email,
        rol: profile.rol,
        estado: profile.estado,
        telefono: profile.telefono,
        fechaAlta: new Date(profile.fecha_alta),
        ultimoAcceso: profile.ultimo_acceso ? new Date(profile.ultimo_acceso) : undefined,
        notasInternas: profile.notas_internas,
      };

      // Fetch modulosActivos for cliente users
      if (profile.rol === 'cliente') {
        const { data: clienteData } = await supabaseAdmin
          .from('clientes')
          .select('modulo_subida_documentos,modulo_incidencias,modulo_asistente_e2,modulo_panel_financiero,modulo_facturacion')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (clienteData) {
          user.modulosActivos = {
            subidaDocumentos: clienteData.modulo_subida_documentos ?? false,
            incidencias: clienteData.modulo_incidencias ?? false,
            asistenteE2: clienteData.modulo_asistente_e2 ?? false,
            panelFinanciero: clienteData.modulo_panel_financiero ?? false,
            facturacion: clienteData.modulo_facturacion ?? false,
          };
        }
      }

      // Fetch clientesAsignados for asesor users
      if (profile.rol === 'asesor') {
        const { data: asignaciones } = await supabase
          .from('asesor_cliente')
          .select('cliente_id')
          .eq('asesor_id', profile.id);
        
        user.clientesAsignados = asignaciones?.map(a => a.cliente_id) || [];
      }

      return user;
    })
  );

  return usersWithDetails;
};

// =============================================
// CLIENTE OPERATIONS
// =============================================

export const getClientes = async (asesorId?: string): Promise<Cliente[]> => {
  let query = supabaseAdmin
    .from('clientes')
    .select('*')
    .order('fecha_alta', { ascending: false });

  // If asesorId provided, filter by assigned asesor
  if (asesorId) {
    const { data: asignaciones } = await supabaseAdmin
      .from('asesor_cliente')
      .select('cliente_id')
      .eq('asesor_id', asesorId);

      const clienteIds = asignaciones?.map(a => a.cliente_id) || [];
    query = query.in('id', clienteIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Get asesores for each cliente
  const clientesConAsesores = await Promise.all(
    data.map(async (cliente) => {
      const { data: asignaciones } = await supabaseAdmin
        .from('asesor_cliente')
        .select('asesor_id')
        .eq('cliente_id', cliente.id);

      return {
        id: cliente.id,
        nif: cliente.nif,
        razonSocial: cliente.razon_social,
        nombreComercial: cliente.nombre_comercial,
        personaContacto: cliente.persona_contacto,
        telefono: cliente.telefono,
        email: cliente.email,
        direccionFiscal: cliente.direccion_fiscal,
        asesoresAsignados: asignaciones?.map(a => a.asesor_id) || [],
        modulosActivos: {
          subidaDocumentos: cliente.modulo_subida_documentos ?? false,
          incidencias: cliente.modulo_incidencias ?? false,
          asistenteE2: cliente.modulo_asistente_e2 ?? false,
          panelFinanciero: cliente.modulo_panel_financiero ?? false,
          facturacion: cliente.modulo_facturacion ?? false,
        },
        estado: cliente.estado,
        fechaAlta: new Date(cliente.fecha_alta),
        tipoCliente: cliente.tipo_cliente,
      };
    })
  );

  return clientesConAsesores;
};

export const getClienteById = async (clienteId: string): Promise<Cliente | null> => {
  const { data: cliente, error } = await supabaseAdmin
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .maybeSingle();

  if (error || !cliente) {
    console.warn('No cliente found with id:', clienteId);
    return null;
  }

  const { data: asignaciones } = await supabaseAdmin
    .from('asesor_cliente')
    .select('asesor_id')
    .eq('cliente_id', cliente.id);

  return {
    id: cliente.id,
    nif: cliente.nif,
    razonSocial: cliente.razon_social,
    nombreComercial: cliente.nombre_comercial,
    personaContacto: cliente.persona_contacto,
    telefono: cliente.telefono,
    email: cliente.email,
    direccionFiscal: cliente.direccion_fiscal,
    asesoresAsignados: asignaciones?.map(a => a.asesor_id) || [],
    modulosActivos: {
      subidaDocumentos: cliente.modulo_subida_documentos ?? false,
      incidencias: cliente.modulo_incidencias ?? false,
      asistenteE2: cliente.modulo_asistente_e2 ?? false,
      panelFinanciero: cliente.modulo_panel_financiero ?? false,
      facturacion: cliente.modulo_facturacion ?? false,
    },
    estado: cliente.estado,
    fechaAlta: new Date(cliente.fecha_alta),
  };
};

export const createCliente = async (cliente: Omit<Cliente, 'id' | 'fechaAlta'>): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from('clientes')
    .insert({
      nif: cliente.nif,
      razon_social: cliente.razonSocial,
      nombre_comercial: cliente.nombreComercial,
      persona_contacto: cliente.personaContacto,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion_fiscal: cliente.direccionFiscal,
      estado: cliente.estado,
      modulo_subida_documentos: cliente.modulosActivos.subidaDocumentos,
      modulo_incidencias: cliente.modulosActivos.incidencias,
      modulo_asistente_e2: cliente.modulosActivos.asistenteE2,
      modulo_panel_financiero: cliente.modulosActivos.panelFinanciero,
      modulo_facturacion: cliente.modulosActivos.facturacion,
    })
    .select('id')
    .single();

  if (error) throw error;

  // Assign asesores
  if (cliente.asesoresAsignados.length > 0) {
    await Promise.all(
      cliente.asesoresAsignados.map(asesorId =>
        supabaseAdmin.from('asesor_cliente').insert({
          asesor_id: asesorId,
          cliente_id: data.id,
        })
      )
    );
  }

  return data.id;
};

/**
 * Create a cliente record linked to a user account
 * Used when creating a new client via the asesor interface
 */
export const createClienteWithUser = async (
  userId: string,
  cliente: Omit<Cliente, 'id' | 'fechaAlta'>,
  asesorId: string
): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from('clientes')
    .insert({
      user_id: userId,
      nif: cliente.nif,
      razon_social: cliente.razonSocial,
      nombre_comercial: cliente.nombreComercial || null,
      persona_contacto: cliente.personaContacto,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion_fiscal: cliente.direccionFiscal || '',
      estado: cliente.estado,
      modulo_subida_documentos: cliente.modulosActivos.subidaDocumentos,
      modulo_incidencias: cliente.modulosActivos.incidencias,
      modulo_asistente_e2: cliente.modulosActivos.asistenteE2,
      modulo_panel_financiero: cliente.modulosActivos.panelFinanciero,
      modulo_facturacion: cliente.modulosActivos.facturacion,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating cliente:', error);
    throw new Error(`Error al crear el cliente: ${error.message}`);
  }

  // Assign asesor to cliente
  const { error: assignError } = await supabaseAdmin.from('asesor_cliente').insert({
    asesor_id: asesorId,
    cliente_id: data.id,
  });

  if (assignError) {
    console.error('Error assigning asesor:', assignError);
    // Don't throw here - cliente was created successfully
  }

  return data.id;
};

export const updateCliente = async (clienteId: string, updates: Partial<Cliente>) => {
  console.log('[updateCliente] Starting update for cliente:', clienteId);
  console.log('[updateCliente] Updates to apply:', updates);

  try {
    // Call the API route instead of using supabaseAdmin directly
    // This avoids CORS issues by running the admin operations server-side
    const response = await fetch('/api/clientes/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clienteId,
        updates,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al actualizar el cliente');
    }

    console.log('[updateCliente] Update successful! Returned data:', result.data);
    return result.data;
  } catch (error: any) {
    console.error('[updateCliente] Error updating cliente:', error);
    
    // Check for network/CORS errors
    const errorMessage = error.message || '';
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('CORS') || 
        errorMessage.includes('ERR_FAILED')) {
      throw new Error(
        'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.'
      );
    }
    
    throw error;
  }
};

export const setAdvisorClients = async (asesorId: string, clienteIds: string[]) => {
  try {
    // Call the API route instead of using supabaseAdmin directly
    // This avoids CORS issues by running the admin operations server-side
    const response = await fetch('/api/asesores/set-clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        asesorId,
        clienteIds,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al actualizar las relaciones');
    }

    console.log('[setAdvisorClients] Successfully updated advisor-client relationships');
  } catch (error: any) {
    console.error('[setAdvisorClients] Error updating advisor-client relationships:', error);
    
    // Check for network/CORS errors
    const errorMessage = error.message || '';
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('CORS') || 
        errorMessage.includes('ERR_FAILED')) {
      throw new Error(
        'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.'
      );
    }
    
    throw error;
  }
};

// =============================================
// DOCUMENTO OPERATIONS
// =============================================

export const getDocumentos = async (clienteId?: string, asesorId?: string): Promise<Documento[]> => {
  let query = supabaseAdmin
    .from('documentos')
    .select('*')
    .order('fecha_subida', { ascending: false });

  if (clienteId) {
    query = query.eq('cliente_id', clienteId);
  }

  if (asesorId) {
    query = query.eq('asesor_id', asesorId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data.map(doc => ({
    id: doc.id,
    nombre: doc.nombre,
    clienteId: doc.cliente_id,
    asesorId: doc.asesor_id || null,
    tipo: doc.tipo,
    estado: doc.estado,
    fechaSubida: new Date(doc.fecha_subida),
    procesadoIA: doc.procesado_ia,
    tamaño: doc.tamanio,
    urlArchivo: doc.url_archivo,
    nroAsientoERP: doc.nro_asiento_erp,
    datosIA: doc.datos_ia,
  }));
};

export const getDocumentoById = async (documentoId: string): Promise<Documento | null> => {
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('id', documentoId)
    .maybeSingle();

  if (error || !data) {
    console.warn('No documento found with id:', documentoId);
    return null;
  }

  return {
    id: data.id,
    nombre: data.nombre,
    clienteId: data.cliente_id,
    asesorId: data.asesor_id || null,
    tipo: data.tipo,
    estado: data.estado,
    fechaSubida: new Date(data.fecha_subida),
    procesadoIA: data.procesado_ia,
    tamaño: data.tamanio,
    urlArchivo: data.url_archivo,
    nroAsientoERP: data.nro_asiento_erp,
    datosIA: data.datos_ia,
  };
};

export const createDocumento = async (documento: Omit<Documento, 'id' | 'fechaSubida'>): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from('documentos')
    .insert({
      nombre: documento.nombre,
      cliente_id: documento.clienteId,
      asesor_id: documento.asesorId || null,
      tipo: documento.tipo,
      estado: documento.estado,
      procesado_ia: documento.procesadoIA,
      tamanio: documento.tamaño,
      url_archivo: documento.urlArchivo,
      nro_asiento_erp: documento.nroAsientoERP,
      datos_ia: documento.datosIA,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Database insert error:', error);
    throw new Error(`Error al crear el registro del documento: ${error.message}`);
  }
  return data.id;
};

export const updateDocumento = async (documentoId: string, updates: Partial<Documento>) => {
  const { error } = await supabaseAdmin
    .from('documentos')
    .update({
      nombre: updates.nombre,
      tipo: updates.tipo,
      estado: updates.estado,
      procesado_ia: updates.procesadoIA,
      nro_asiento_erp: updates.nroAsientoERP,
      datos_ia: updates.datosIA,
    })
    .eq('id', documentoId);

  if (error) throw error;
};

export const deleteDocumento = async (documentoId: string): Promise<void> => {
  try {
    // Call the API route instead of using supabase directly
    // This avoids CORS issues by running the admin operations server-side
    // and also handles deletion of the storage file
    const response = await fetch('/api/documents/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentoId,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al eliminar el documento');
    }
  } catch (error: any) {
    console.error('Error in deleteDocumento:', error);
    
    // Check for network/CORS errors
    const errorMessage = error?.message || error?.toString() || '';
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('CORS') || 
        errorMessage.includes('ERR_FAILED') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed')) {
      throw new Error(
        'Error de conexión al eliminar el documento. Por favor, verifica tu conexión a internet e intenta nuevamente.'
      );
    }
    
    throw error;
  }
};

export const replaceDocumentoFile = async (documentoId: string, file: File): Promise<void> => {
  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('documentos')
      .select('id, cliente_id')
      .eq('id', documentoId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing documento for replace:', fetchError);
      throw new Error(`Error al cargar el documento a reemplazar: ${fetchError.message}`);
    }

    if (!existing) {
      throw new Error('Documento no encontrado para reemplazar');
    }

    const clienteId = existing.cliente_id as string;

    // Create a unique file path similar to uploadDocumento
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${clienteId}/${timestamp}_${sanitizedFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('documentos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error (replaceDocumentoFile):', uploadError);
      throw new Error(`Error al subir el nuevo archivo: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('documentos')
      .getPublicUrl(filePath);

    // Call the API route instead of using supabaseAdmin directly
    // This avoids CORS issues by running the admin operations server-side
    const response = await fetch('/api/documents/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentoId,
        updates: {
          nombre: file.name,
          tamanio: file.size,
          urlArchivo: publicUrl,
          estado: 'pendiente',
          procesadoIA: false,
          datosIA: null,
          nroAsientoERP: null,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al actualizar el documento con el nuevo archivo');
    }
  } catch (error: any) {
    console.error('Error in replaceDocumentoFile:', error);
    
    // Check for network/CORS errors
    const errorMessage = error?.message || error?.toString() || '';
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('CORS') || 
        errorMessage.includes('ERR_FAILED') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed')) {
      throw new Error(
        'Error de conexión al actualizar el documento. Por favor, verifica tu conexión a internet e intenta nuevamente.'
      );
    }
    
    throw error;
  }
};

// =============================================
// INCIDENCIA OPERATIONS
// =============================================

export const getIncidencias = async (clienteId?: string, asesorId?: string): Promise<Incidencia[]> => {
  let query = supabaseAdmin
    .from('incidencias')
    .select(`
      *,
      mensajes_incidencia (*)
    `)
    .order('fecha_creacion', { ascending: false });

  if (clienteId) {
    query = query.eq('cliente_id', clienteId);
  }

  if (asesorId) {
    query = query.eq('asesor_id', asesorId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data.map(inc => ({
    id: inc.id,
    documentoId: inc.documento_id,
    clienteId: inc.cliente_id,
    asesorId: inc.asesor_id || null,
    estado: inc.estado,
    origen: inc.origen,
    fechaCreacion: new Date(inc.fecha_creacion),
    fechaUltimaRespuesta: inc.fecha_ultima_respuesta ? new Date(inc.fecha_ultima_respuesta) : undefined,
    mensajes: (inc.mensajes_incidencia || []).map((msg: any) => ({
      id: msg.id,
      usuarioId: msg.usuario_id,
      rol: msg.rol || 'cliente',
      mensaje: msg.mensaje,
      fecha: new Date(msg.fecha),
      archivosAdjuntos: msg.archivos_adjuntos || [],
      esIA: msg.es_ia || false,
    })),
  }));
};

export const getIncidenciaById = async (incidenciaId: string): Promise<Incidencia | null> => {
  const { data: inc, error } = await supabase
    .from('incidencias')
    .select(`
      *,
      mensajes_incidencia (*)
    `)
    .eq('id', incidenciaId)
    .maybeSingle();

  if (error || !inc) {
    console.warn('No incidencia found with id:', incidenciaId);
    return null;
  }

  return {
    id: inc.id,
    documentoId: inc.documento_id,
    clienteId: inc.cliente_id,
    asesorId: inc.asesor_id || null,
    estado: inc.estado,
    origen: inc.origen,
    fechaCreacion: new Date(inc.fecha_creacion),
    fechaUltimaRespuesta: inc.fecha_ultima_respuesta ? new Date(inc.fecha_ultima_respuesta) : undefined,
    mensajes: (inc.mensajes_incidencia || []).map((msg: any) => ({
      id: msg.id,
      usuarioId: msg.usuario_id,
      rol: msg.rol || 'cliente',
      mensaje: msg.mensaje,
      fecha: new Date(msg.fecha),
      archivosAdjuntos: msg.archivos_adjuntos || [],
      esIA: msg.es_ia || false,
    })),
  };
};

export const createIncidencia = async (
  incidencia: Omit<Incidencia, 'id' | 'fechaCreacion' | 'mensajes'>
): Promise<string> => {
  const { data, error } = await supabase
    .from('incidencias')
    .insert({
      documento_id: incidencia.documentoId,
      cliente_id: incidencia.clienteId,
      asesor_id: incidencia.asesorId || null,
      estado: incidencia.estado,
      origen: incidencia.origen,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

export const updateIncidencia = async (incidenciaId: string, updates: Partial<Incidencia>) => {
  const { error } = await supabase
    .from('incidencias')
    .update({
      estado: updates.estado,
      fecha_ultima_respuesta: updates.fechaUltimaRespuesta?.toISOString(),
    })
    .eq('id', incidenciaId);

  if (error) throw error;
};

export const addMensajeIncidencia = async (
  incidenciaId: string,
  mensaje: Omit<MensajeIncidencia, 'id' | 'fecha'>
) => {
  const { data, error } = await supabase.from('mensajes_incidencia').insert({
    incidencia_id: incidenciaId,
    usuario_id: mensaje.usuarioId,
    mensaje: mensaje.mensaje,
    es_ia: mensaje.esIA || false,
    rol: mensaje.rol,
    archivos_adjuntos: mensaje.archivosAdjuntos || [],
  }).select('id').single();

  if (error) throw error;

  // Update incidencia last response date
  await supabase
    .from('incidencias')
    .update({ fecha_ultima_respuesta: new Date().toISOString() })
    .eq('id', incidenciaId);

  return data.id;
};

export const uploadArchivoAdjunto = async (
  file: File,
  incidenciaId: string,
  mensajeId: string
): Promise<string> => {
  try {
    // Create a unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `incidencias/${incidenciaId}/${mensajeId}/${timestamp}_${sanitizedFileName}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('incidencias')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Error al subir el archivo: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('incidencias')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadArchivoAdjunto:', error);
    throw error;
  }
};

// =============================================
// DASHBOARD METRICS
// =============================================

export const getMetricasDashboard = async (userId?: string, userRole?: string): Promise<MetricasDashboard> => {
  // Helper function to build base documentos query with role-based filters
  const buildDocumentosQuery = () => {
    let query = supabase.from('documentos').select('id', { count: 'exact' });
    
    if (userRole === 'asesor' && userId) {
      // This will be handled separately after getting clienteIds
      return query;
    } else if (userRole === 'cliente' && userId) {
      // This will be handled separately after getting cliente
      return query;
    }
    return query;
  };

  // Helper function to build base incidencias query with role-based filters
  const buildIncidenciasQuery = () => {
    return supabase.from('incidencias').select('id', { count: 'exact' });
  };

  // Helper function to build base clientes query
  const buildClientesQuery = () => {
    return supabase.from('clientes').select('id', { count: 'exact' }).eq('estado', 'activo');
  };

  let clienteIds: string[] = [];
  let clienteId: string | null = null;

  if (userRole === 'asesor' && userId) {
    // Filter by assigned clients for asesores
    const { data: asignaciones } = await supabase
      .from('asesor_cliente')
      .select('cliente_id')
      .eq('asesor_id', userId);

    clienteIds = asignaciones?.map(a => a.cliente_id) || [];
  } else if (userRole === 'cliente' && userId) {
    // Filter by user's client for clientes
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (cliente) {
      clienteId = cliente.id;
    }
  }

  // Build separate queries for each metric
  const documentosPendientesQuery = buildDocumentosQuery();
  const facturasIAQuery = buildDocumentosQuery();
  const incidenciasQuery = buildIncidenciasQuery();
  const clientesQuery = buildClientesQuery();

  // Apply role-based filters
  if (clienteIds.length > 0) {
    documentosPendientesQuery.in('cliente_id', clienteIds);
    facturasIAQuery.in('cliente_id', clienteIds);
    incidenciasQuery.in('cliente_id', clienteIds);
    clientesQuery.in('id', clienteIds);
  } else if (clienteId) {
    documentosPendientesQuery.eq('cliente_id', clienteId);
    facturasIAQuery.eq('cliente_id', clienteId);
    incidenciasQuery.eq('cliente_id', clienteId);
  }

  const [
    { count: documentosPendientes },
    { count: facturasIA },
    { count: incidenciasAbiertas },
    { count: clientesActivos },
    { count: asesoresActivos },
  ] = await Promise.all([
    documentosPendientesQuery.in('estado', ['pendiente', 'procesado_ia']),
    facturasIAQuery.eq('procesado_ia', true),
    incidenciasQuery.in('estado', ['nueva', 'en_revision']),
    clientesQuery,
    supabase.from('profiles').select('id', { count: 'exact' }).eq('rol', 'asesor').eq('estado', 'activo'),
  ]);

  return {
    documentosPendientes: documentosPendientes || 0,
    facturasIA: facturasIA || 0,
    incidenciasAbiertas: incidenciasAbiertas || 0,
    clientesActivos: clientesActivos || 0,
    asesoresActivos: asesoresActivos || 0,
  };
};

// =============================================
// ACTIVIDAD RECIENTE
// =============================================

export const getActividadReciente = async (limit: number = 10): Promise<ActividadReciente[]> => {
  const { data, error } = await supabase
    .from('actividad_reciente')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data.map(act => ({
    id: act.id,
    tipo: act.tipo,
    descripcion: act.descripcion,
    usuario: act.usuario_nombre,
    fecha: new Date(act.fecha),
    enlace: act.enlace,
  }));
};

export const createActividad = async (actividad: Omit<ActividadReciente, 'id' | 'fecha'>) => {
  const { error } = await supabase.from('actividad_reciente').insert({
    tipo: actividad.tipo,
    descripcion: actividad.descripcion,
    usuario_nombre: actividad.usuario,
    enlace: actividad.enlace,
  });

  if (error) throw error;
};

// =============================================
// AI ACCOUNTANT STATISTICS
// =============================================

export interface AIAccountantStats {
  procesadasCorrectamente: number; // percentage
  conErroresIA: number; // percentage
  pendientesAnalisis: number; // percentage
  docsEsteMes: number;
  tiempoMedio: string; // in seconds
}

export const getAIAccountantStats = async (): Promise<AIAccountantStats> => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Get all documents processed by AI this month
  const { data: docsThisMonth, error: docsError } = await supabaseAdmin
    .from('documentos')
    .select('id, estado, procesado_ia, created_at')
    .eq('procesado_ia', true)
    .gte('created_at', startOfMonth.toISOString());

  if (docsError) {
    console.error('Error fetching AI accountant stats:', docsError);
    return {
      procesadasCorrectamente: 0,
      conErroresIA: 0,
      pendientesAnalisis: 0,
      docsEsteMes: 0,
      tiempoMedio: '0s',
    };
  }

  const totalDocs = docsThisMonth?.length || 0;
  
  if (totalDocs === 0) {
    return {
      procesadasCorrectamente: 0,
      conErroresIA: 0,
      pendientesAnalisis: 0,
      docsEsteMes: 0,
      tiempoMedio: '0s',
    };
  }

  // Count by status
  const procesadasCorrectamente = docsThisMonth?.filter(
    (d: any) => d.estado === 'contabilizado' || d.estado === 'validado'
  ).length || 0;
  
  const conErroresIA = docsThisMonth?.filter(
    (d: any) => d.estado === 'incidencia' || d.estado === 'rechazado'
  ).length || 0;
  
  const pendientesAnalisis = docsThisMonth?.filter(
    (d: any) => d.estado === 'pendiente' || d.estado === 'procesado_ia'
  ).length || 0;

  // Calculate percentages
  const porcentajeProcesadas = totalDocs > 0 ? (procesadasCorrectamente / totalDocs) * 100 : 0;
  const porcentajeErrores = totalDocs > 0 ? (conErroresIA / totalDocs) * 100 : 0;
  const porcentajePendientes = totalDocs > 0 ? (pendientesAnalisis / totalDocs) * 100 : 0;

  // For average time, we'll use a default since we don't track processing time
  // In a real implementation, this would come from a processing log
  const tiempoMedio = '2.1s'; // Default value, would be calculated from actual processing times

  return {
    procesadasCorrectamente: Math.round(porcentajeProcesadas * 100) / 100,
    conErroresIA: Math.round(porcentajeErrores * 100) / 100,
    pendientesAnalisis: Math.round(porcentajePendientes * 100) / 100,
    docsEsteMes: totalDocs,
    tiempoMedio,
  };
};

// =============================================
// ADVISOR PERFORMANCE
// =============================================

export interface AdvisorPerformance {
  id: string;
  nombre: string;
  clientesCount: number;
  documentosEsteMes: number;
  porcentaje: number; // percentage for progress bar
}

export const getAdvisorPerformance = async (limit: number = 5): Promise<AdvisorPerformance[]> => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Get all advisors
  const { data: advisors, error: advisorsError } = await supabaseAdmin
    .from('profiles')
    .select('id, nombre')
    .eq('rol', 'asesor')
    .eq('estado', 'activo');

  if (advisorsError || !advisors) {
    console.error('Error fetching advisors:', advisorsError);
    return [];
  }

  // Get client assignments for each advisor
  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('asesor_cliente')
    .select('asesor_id, cliente_id');

  if (assignmentsError) {
    console.error('Error fetching assignments:', assignmentsError);
    return [];
  }

  // Get document counts for this month
  const { data: docsThisMonth, error: docsError } = await supabaseAdmin
    .from('documentos')
    .select('id, asesor_id, created_at')
    .gte('created_at', startOfMonth.toISOString());

  if (docsError) {
    console.error('Error fetching documents:', docsError);
  }

  // Calculate performance for each advisor
  const performance = advisors.map((advisor: any) => {
    const clientIds = assignments
      ?.filter((a: any) => a.asesor_id === advisor.id)
      .map((a: any) => a.cliente_id) || [];
    
    const clientesCount = clientIds.length;
    
    const documentosEsteMes = docsThisMonth?.filter(
      (d: any) => d.asesor_id === advisor.id
    ).length || 0;

    return {
      id: advisor.id,
      nombre: advisor.nombre,
      clientesCount,
      documentosEsteMes,
      porcentaje: 0, // Will calculate below
    };
  });

  // Calculate percentages (relative to max)
  const maxDocs = Math.max(...performance.map(p => p.documentosEsteMes), 1);
  performance.forEach(p => {
    p.porcentaje = maxDocs > 0 ? Math.round((p.documentosEsteMes / maxDocs) * 100) : 0;
  });

  // Sort by documents count and limit
  return performance
    .sort((a, b) => b.documentosEsteMes - a.documentosEsteMes)
    .slice(0, limit);
};

// =============================================
// DASHBOARD ALERTS
// =============================================

export interface DashboardAlert {
  id: string;
  tipo: 'error' | 'warning' | 'info';
  titulo: string;
  mensaje: string;
  accion?: string;
  href?: string;
}

export const getDashboardAlerts = async (): Promise<DashboardAlert[]> => {
  const alerts: DashboardAlert[] = [];

  // Check for unassigned documents
  const { data: unassignedDocs, error: unassignedError } = await supabaseAdmin
    .from('documentos')
    .select('id')
    .is('asesor_id', null)
    .in('estado', ['pendiente', 'procesado_ia']);

  if (!unassignedError && unassignedDocs && unassignedDocs.length > 0) {
    alerts.push({
      id: 'unassigned-docs',
      tipo: 'error',
      titulo: `${unassignedDocs.length} documentos sin asignar`,
      mensaje: 'Requieren asignación urgente',
      accion: 'Ver',
      href: '/admin/documentos?filter=sin_asesor',
    });
  }

  // Check for advisors over capacity (more than 20 clients)
  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('asesor_cliente')
    .select('asesor_id');

  if (!assignmentsError && assignments) {
    // Get advisor names separately
    const advisorIds = [...new Set(assignments.map((a: any) => a.asesor_id))];
    const { data: advisorsData } = await supabaseAdmin
      .from('profiles')
      .select('id, nombre')
      .in('id', advisorIds);

    const advisorMap = new Map(
      advisorsData?.map((a: any) => [a.id, a.nombre]) || []
    );

    const advisorCounts: { [key: string]: { count: number; nombre: string } } = {};
    
    assignments.forEach((a: any) => {
      const asesorId = a.asesor_id;
      if (!advisorCounts[asesorId]) {
        advisorCounts[asesorId] = {
          count: 0,
          nombre: advisorMap.get(asesorId) || 'Asesor desconocido',
        };
      }
      advisorCounts[asesorId].count++;
    });

    const overCapacity = Object.entries(advisorCounts)
      .filter(([_, data]: [string, any]) => data.count > 20)
      .map(([_, data]: [string, any]) => data.nombre);

    if (overCapacity.length > 0) {
      alerts.push({
        id: 'over-capacity',
        tipo: 'warning',
        titulo: `${overCapacity.length} asesores superan capacidad`,
        mensaje: 'Redistribuir clientes',
        accion: 'Revisar',
        href: '/admin/clientes-asesores',
      });
    }
  }

  return alerts;
};

// =============================================
// DATOS FINANCIEROS
// =============================================

export const getClienteIdByUserId = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    console.warn('No cliente found for user:', userId);
    return null;
  }
  return data.id;
};

export const getDatosFinancieros = async (clienteId: string): Promise<DatosFinancieros | null> => {
  const { data, error } = await supabaseAdmin
    .from('datos_financieros')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('ultimo_cierre', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.warn('No financial data found for cliente:', clienteId);
    return null;
  }

  return {
    clienteId: data.cliente_id,
    periodo: data.periodo,
    ingresos: parseFloat(data.ingresos),
    gastos: parseFloat(data.gastos),
    resultado: parseFloat(data.resultado),
    margen: parseFloat(data.margen),
    riesgoIA: data.riesgo_ia,
    ultimoCierre: data.ultimo_cierre ? new Date(data.ultimo_cierre) : undefined,
  };
};

export const upsertDatosFinancieros = async (datos: DatosFinancieros) => {
  const { error } = await supabaseAdmin.from('datos_financieros').upsert({
    cliente_id: datos.clienteId,
    periodo: datos.periodo,
    ingresos: datos.ingresos,
    gastos: datos.gastos,
    resultado: datos.resultado,
    margen: datos.margen,
    riesgo_ia: datos.riesgoIA,
    ultimo_cierre: datos.ultimoCierre?.toISOString(),
  });

  if (error) throw error;
};

/**
 * Archives financial data from an invoice document to datos_financieros
 * Aggregates invoice amounts by period (month/quarter/year)
 */
export const archiveFinancialDataFromInvoice = async (
  clienteId: string,
  documento: { tipo: string; datos_ia?: any; fecha_subida?: string }
) => {
  try {
    // Extract financial data from invoice
    const datosIA = documento.datos_ia;
    if (!datosIA) {
      console.log('[archiveFinancialDataFromInvoice] No financial data to archive');
      return;
    }

    // Try to get total from totalFactura or importeTotal
    const totalFactura = parseFloat(datosIA.totalFactura || datosIA.importeTotal || '0') || 0;
    if (totalFactura === 0) {
      console.log('[archiveFinancialDataFromInvoice] Invoice total is 0, skipping');
      return;
    }

    // Determine period from invoice date or submission date
    let fechaFactura: Date;
    if (datosIA.fechaFactura || datosIA.fecha) {
      fechaFactura = new Date(datosIA.fechaFactura || datosIA.fecha);
    } else if (documento.fecha_subida) {
      fechaFactura = new Date(documento.fecha_subida);
    } else {
      fechaFactura = new Date();
    }

    // Format period as "YYYY-MM" (month) or "YYYY-QX" (quarter) or "YYYY" (year)
    const year = fechaFactura.getFullYear();
    const month = fechaFactura.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    // Use month format for more granular tracking
    const periodo = `${year}-${String(month).padStart(2, '0')}`;

    // Get existing financial data for this period
    const { data: existingData, error: fetchError } = await supabaseAdmin
      .from('datos_financieros')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('periodo', periodo)
      .maybeSingle();

    let ingresos = 0;
    let gastos = 0;

    // Determine if this is income (emitida) or expense (recibida)
    if (documento.tipo === 'emitida_pdf' || documento.tipo === 'emitida_excel') {
      ingresos = totalFactura;
    } else if (documento.tipo === 'recibida_pdf' || documento.tipo === 'recibida_excel') {
      gastos = totalFactura;
    } else {
      // For other types, try to determine from the data
      // If it's a received invoice, it's an expense
      if (datosIA.nifReceptor || datosIA.razonSocialReceptor) {
        gastos = totalFactura;
      } else {
        ingresos = totalFactura;
      }
    }

    // Aggregate with existing data
    const newIngresos = (existingData ? parseFloat(existingData.ingresos) : 0) + ingresos;
    const newGastos = (existingData ? parseFloat(existingData.gastos) : 0) + gastos;
    const newResultado = newIngresos - newGastos;
    const newMargen = newIngresos > 0 ? (newResultado / newIngresos) * 100 : 0;

    // Determine risk level
    let riesgoIA: 'bajo' | 'medio' | 'alto' = 'bajo';
    if (newMargen < 0) {
      riesgoIA = 'alto';
    } else if (newMargen < 5) {
      riesgoIA = 'medio';
    }

    // Upsert financial data
    const { error: upsertError } = await supabaseAdmin
      .from('datos_financieros')
      .upsert({
        cliente_id: clienteId,
        periodo: periodo,
        ingresos: newIngresos,
        gastos: newGastos,
        resultado: newResultado,
        margen: newMargen,
        riesgo_ia: riesgoIA,
        ultimo_cierre: new Date().toISOString(),
      }, {
        onConflict: 'cliente_id,periodo',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error('[archiveFinancialDataFromInvoice] Error upserting financial data:', upsertError);
      throw upsertError;
    }

    console.log(`[archiveFinancialDataFromInvoice] Archived ${documento.tipo} invoice: ${totalFactura}€ to period ${periodo}`);
  } catch (error) {
    console.error('[archiveFinancialDataFromInvoice] Error archiving financial data:', error);
    // Don't throw - this is a background operation that shouldn't fail the main operation
  }
};

// =============================================
// DOCUMENTOS FINANCIEROS (Panel Financiero)
// =============================================

export const getDocumentosFinancieros = async (clienteId: string) => {
  const { data, error } = await supabase
    .from('documentos_financieros')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha_subida', { ascending: false });

  if (error) throw error;

  return data.map((doc: any) => ({
    id: doc.id,
    clienteId: doc.cliente_id,
    asesorId: doc.asesor_id,
    nombre: doc.nombre,
    tipo: doc.tipo,
    periodo: doc.periodo,
    fechaSubida: new Date(doc.fecha_subida),
    urlArchivo: doc.url_archivo,
    tamaño: doc.tamanio,
    procesadoIA: doc.procesado_ia,
    datosExtraidos: doc.datos_extraidos,
    analisisIA: doc.analisis_ia,
  }));
};

export const uploadDocumentoFinanciero = async (
  file: File,
  clienteId: string,
  asesorId: string,
  tipo: string,
  periodo: string
): Promise<string> => {
  try {
    // Create a unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `financiero/${clienteId}/${timestamp}_${sanitizedFileName}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Error al subir el archivo: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documentos')
      .getPublicUrl(filePath);

    // Create document record in database via API route (bypasses RLS)
    const response = await fetch('/api/financial/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clienteId,
        asesorId,
        tipo,
        periodo,
        urlArchivo: publicUrl,
        nombre: file.name,
        tamanio: file.size,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error al crear el registro');
    }

    return result.id;
  } catch (error: any) {
    console.error('Error in uploadDocumentoFinanciero:', error);
    throw error;
  }
};

export const deleteDocumentoFinanciero = async (documentoId: string) => {
  const { error } = await supabase
    .from('documentos_financieros')
    .delete()
    .eq('id', documentoId);

  if (error) throw error;
};

export const getConsultasFinancieras = async (clienteId: string, limit: number = 10) => {
  const { data, error } = await supabase
    .from('consultas_financieras')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data.map((consulta: any) => ({
    id: consulta.id,
    clienteId: consulta.cliente_id,
    pregunta: consulta.pregunta,
    respuesta: consulta.respuesta,
    fecha: new Date(consulta.fecha),
    documentosReferenciados: consulta.documentos_referenciados || [],
  }));
};

// =============================================
// FILE UPLOAD OPERATIONS
// =============================================

/**
 * Upload a file to Supabase Storage and create a document record
 * @param file - The file to upload
 * @param clienteId - The client's ID
 * @param tipo - The document type
 * @param notas - Optional notes
 * @returns The created document ID
 */
export const uploadDocumento = async (
  file: File,
  clienteId: string,
  tipo: 'otro' | 'emitida_pdf' | 'recibida_pdf' | 'emitida_excel' | 'recibida_excel',
  notas?: string,
  asesorId?: string
): Promise<string> => {

  try {
    // Get the first asesor assigned to this client
    if (!asesorId) {
      const { data: asignacion } = await supabaseAdmin
        .from('asesor_cliente')
        .select('asesor_id')
        .eq('cliente_id', clienteId)
        .limit(1)
        .maybeSingle();
      asesorId = asignacion?.asesor_id || null;
    }

    // Create a unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${clienteId}/${timestamp}_${sanitizedFileName}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('documentos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Error al subir el archivo al almacenamiento: ${uploadError.message}`);
    }

    console.log('File uploaded successfully to:', filePath);

    // Get the public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('documentos')
      .getPublicUrl(filePath);

    // Create document record in database
    const documentoId = await createDocumento({
      nombre: file.name,
      clienteId: clienteId,
      asesorId: asesorId || null,
      tipo: tipo,
      estado: 'pendiente',
      procesadoIA: false,
      tamaño: file.size,
      urlArchivo: publicUrl,
    });

    return documentoId;
  } catch (error) {
    console.error('Error in uploadDocumento:', error);
    throw error;
  }
};

/**
 * Upload multiple files
 * @param files - Array of files to upload
 * @param clienteId - The client's ID
 * @param tipo - The document type
 * @param notas - Optional notes
 * @returns Array of created document IDs
 */
export const uploadMultipleDocumentos = async (
  files: File[],
  clienteId: string,
  tipo: 'otro' | 'emitida_pdf' | 'recibida_pdf' | 'emitida_excel' | 'recibida_excel',
  notas?: string
): Promise<string[]> => {
  const uploadPromises = files.map(file => uploadDocumento(file, clienteId, tipo, notas));
  return Promise.all(uploadPromises);
};

// =============================================
// ASSISTANT E2 OPERATIONS
// =============================================

export interface Conversacion {
  id: string;
  clienteId: string;
  titulo: string;
  fechaCreacion: Date;
  fechaUltimaActividad: Date;
  derivadoAsesor: boolean;
  asesorId: string | null;
}

export interface MensajeAsistente {
  id: string;
  conversacionId: string;
  rol: 'usuario' | 'asistente';
  contenido: string;
  metadatos?: any;
  esDerivacion: boolean;
  fecha: Date;
}

/**
 * Get all conversations for a client
 */
export const getConversacionesAsistente = async (clienteId: string): Promise<Conversacion[]> => {
  const { data, error } = await supabase
    .from('conversaciones_asistente')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha_ultima_actividad', { ascending: false });

  if (error) throw error;

  return (data || []).map(conv => ({
    id: conv.id,
    clienteId: conv.cliente_id,
    titulo: conv.titulo,
    fechaCreacion: new Date(conv.fecha_creacion),
    fechaUltimaActividad: new Date(conv.fecha_ultima_actividad),
    derivadoAsesor: conv.derivado_a_asesor || false,
    asesorId: conv.asesor_id || null,
  }));
};

/**
 * Get messages for a conversation
 */
export const getMensajesAsistente = async (conversacionId: string): Promise<MensajeAsistente[]> => {
  const { data, error } = await supabase
    .from('mensajes_asistente')
    .select('*')
    .eq('conversacion_id', conversacionId)
    .order('fecha', { ascending: true });

  if (error) throw error;

  return (data || []).map(msg => ({
    id: msg.id,
    conversacionId: msg.conversacion_id,
    rol: msg.rol,
    contenido: msg.contenido,
    metadatos: msg.metadatos,
    esDerivacion: msg.es_derivacion || false,
    fecha: new Date(msg.fecha),
  }));
};

/**
 * Create a new conversation
 */
export const createConversacionAsistente = async (
  clienteId: string,
  titulo: string = 'Nueva consulta'
): Promise<string> => {
  const { data, error } = await supabase
    .from('conversaciones_asistente')
    .insert({
      cliente_id: clienteId,
      titulo,
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
};

/**
 * Send a message in a conversation
 */
export const sendMensajeAsistente = async (
  conversacionId: string,
  rol: 'usuario' | 'asistente',
  contenido: string,
  metadatos?: any
): Promise<string> => {
  const { data, error } = await supabase
    .from('mensajes_asistente')
    .insert({
      conversacion_id: conversacionId,
      rol,
      contenido,
      metadatos,
    })
    .select()
    .single();

  if (error) throw error;

  // Update conversation last activity
  await supabase
    .from('conversaciones_asistente')
    .update({ fecha_ultima_actividad: new Date().toISOString() })
    .eq('id', conversacionId);

  return data.id;
};

/**
 * Update conversation title
 */
export const updateConversacionTitulo = async (
  conversacionId: string,
  titulo: string
): Promise<void> => {
  const { error } = await supabase
    .from('conversaciones_asistente')
    .update({ titulo })
    .eq('id', conversacionId);

  if (error) throw error;
};

/**
 * Delete conversation and its messages
 */
export const deleteConversacionAsistente = async (
  conversacionId: string
): Promise<void> => {
  // Delete messages first (if cascading delete is not set up)
  await supabase
    .from('mensajes_asistente')
    .delete()
    .eq('conversacion_id', conversacionId);

  // Delete conversation
  const { error } = await supabase
    .from('conversaciones_asistente')
    .delete()
    .eq('id', conversacionId);

  if (error) throw error;
};

/**
 * Escalate conversation to advisor
 */
export const derivarConversacionAsesor = async (
  conversacionId: string,
  asesorId: string,
  clienteId: string
): Promise<void> => {
  // Update conversation
  await supabase
    .from('conversaciones_asistente')
    .update({
      derivado_a_asesor: true,
      asesor_id: asesorId,
    })
    .eq('id', conversacionId);

  // Add system message
  await supabase.from('mensajes_asistente').insert({
    conversacion_id: conversacionId,
    rol: 'asistente',
    contenido: '✓ He enviado tu consulta a tu asesor. Te responderá en breve a través del módulo de Incidencias.',
    es_derivacion: true,
  });

  // Create incident from conversation
  const { data: mensajes } = await supabase
    .from('mensajes_asistente')
    .select('*')
    .eq('conversacion_id', conversacionId)
    .order('fecha', { ascending: true });

  if (mensajes && mensajes.length > 0) {
    const resumenMensajes = mensajes
      .map(m => `${m.rol === 'usuario' ? 'Cliente' : 'E2'}: ${m.contenido}`)
      .join('\n\n');

    // Create incident
    const { data: incidencia, error: incError } = await supabase
      .from('incidencias')
      .insert({
        cliente_id: clienteId,
        asesor_id: asesorId,
        estado: 'nueva',
        origen: 'manual',
      })
      .select()
      .single();

    if (!incError && incidencia) {
      // Add conversation history as first message
      await supabase.from('mensajes_incidencia').insert({
        incidencia_id: incidencia.id,
        usuario_id: clienteId,
        mensaje: `Conversación derivada del Asistente E2:\n\n${resumenMensajes}`,
      });
    }
  }
};

/**
 * Get upcoming tax reminders for a client
 */
export const getRecordatoriosFiscales = async (clienteId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('recordatorios_fiscales')
    .select(`
      *,
      calendario_fiscal:calendario_fiscal_id (
        modelo,
        descripcion,
        periodo,
        notas
      )
    `)
    .eq('cliente_id', clienteId)
    .eq('completado', false)
    .gte('fecha_vencimiento', new Date().toISOString())
    .order('fecha_vencimiento', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Mark a tax reminder as completed
 */
export const marcarRecordatorioCompletado = async (recordatorioId: string): Promise<void> => {
  const { error } = await supabase
    .from('recordatorios_fiscales')
    .update({
      completado: true,
      fecha_completado: new Date().toISOString(),
    })
    .eq('id', recordatorioId);

  if (error) throw error;
};

/**
 * Get knowledge base entries by category
 */
export const getBaseConocimiento = async (
  categoria?: string,
  limit: number = 10
): Promise<any[]> => {
  let query = supabase
    .from('base_conocimiento_e2')
    .select('*')
    .order('prioridad', { ascending: false })
    .limit(limit);

  if (categoria) {
    query = query.eq('categoria', categoria);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// =============================================
// ADVISOR ASSISTANT OPERATIONS
// =============================================

export interface ConversacionAsesor {
  id: string;
  asesorId: string;
  titulo: string;
  fechaCreacion: Date;
  fechaUltimaActividad: Date;
}

export interface MensajeAsesor {
  id: string;
  conversacionId: string;
  rol: 'usuario' | 'asistente';
  contenido: string;
  metadatos?: any;
  fecha: Date;
}

/**
 * Get all conversations for an advisor
 */
export const getConversacionesAsesor = async (asesorId: string): Promise<ConversacionAsesor[]> => {
  const { data, error } = await supabase
    .from('conversaciones_asesor')
    .select('*')
    .eq('asesor_id', asesorId)
    .order('fecha_ultima_actividad', { ascending: false });

  if (error) throw error;

  return (data || []).map(conv => ({
    id: conv.id,
    asesorId: conv.asesor_id,
    titulo: conv.titulo,
    fechaCreacion: new Date(conv.fecha_creacion),
    fechaUltimaActividad: new Date(conv.fecha_ultima_actividad),
  }));
};

/**
 * Get messages for an advisor conversation
 */
export const getMensajesAsesor = async (conversacionId: string): Promise<MensajeAsesor[]> => {
  const { data, error } = await supabase
    .from('mensajes_asesor')
    .select('*')
    .eq('conversacion_id', conversacionId)
    .order('fecha', { ascending: true });

  if (error) throw error;

  return (data || []).map(msg => ({
    id: msg.id,
    conversacionId: msg.conversacion_id,
    rol: msg.rol,
    contenido: msg.contenido,
    metadatos: msg.metadatos,
    fecha: new Date(msg.fecha),
  }));
};

/**
 * Create a new advisor conversation
 */
export const createConversacionAsesor = async (
  asesorId: string,
  titulo: string = 'Nueva conversación'
): Promise<string> => {
  const { data, error } = await supabase
    .from('conversaciones_asesor')
    .insert({
      asesor_id: asesorId,
      titulo,
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
};

/**
 * Send a message in an advisor conversation
 */
export const sendMensajeAsesor = async (
  conversacionId: string,
  rol: 'usuario' | 'asistente',
  contenido: string,
  metadatos?: any
): Promise<string> => {
  const { data, error } = await supabase
    .from('mensajes_asesor')
    .insert({
      conversacion_id: conversacionId,
      rol,
      contenido,
      metadatos,
    })
    .select()
    .single();

  if (error) throw error;

  // Update conversation last activity
  await supabase
    .from('conversaciones_asesor')
    .update({ fecha_ultima_actividad: new Date().toISOString() })
    .eq('id', conversacionId);

  return data.id;
};

/**
 * Update advisor conversation title
 */
export const updateConversacionAsesorTitulo = async (
  conversacionId: string,
  titulo: string
): Promise<void> => {
  const { error } = await supabase
    .from('conversaciones_asesor')
    .update({ titulo })
    .eq('id', conversacionId);

  if (error) throw error;
};

/**
 * Delete advisor conversation and its messages
 */
export const deleteConversacionAsesor = async (
  conversacionId: string
): Promise<void> => {
  // Delete messages first (if cascading delete is not set up)
  await supabase
    .from('mensajes_asesor')
    .delete()
    .eq('conversacion_id', conversacionId);

  // Delete conversation
  const { error } = await supabase
    .from('conversaciones_asesor')
    .delete()
    .eq('id', conversacionId);

  if (error) throw error;
};

