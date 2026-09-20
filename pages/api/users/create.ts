import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { ModulosActivos } from '@/types';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface CreateUserRequest {
  email: string;
  password: string;
  nombre: string;
  rol: 'admin' | 'asesor' | 'cliente';
  telefono?: string;
  estado?: 'activo' | 'inactivo';
  modulosActivos?: ModulosActivos;
  codigo?: string;
  tipoEmpresa?: string;
  provincia?: string;
  nombreFiscal?: string;
  cif?: string;
}

interface CreateUserResponse {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * User Create API Route
 * Handles user creation server-side
 * Creates auth user, profile, and cliente record if needed
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateUserResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { 
      email, 
      password, 
      nombre, 
      rol, 
      telefono, 
      estado, 
      modulosActivos,
      codigo,
      tipoEmpresa,
      provincia,
      nombreFiscal,
      cif,
    } = req.body as CreateUserRequest;

    if (!email || !password || !nombre) {
      return res.status(400).json({ success: false, error: 'Email, password y nombre son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    console.log('[API createUser] Starting user creation:', { email, nombre, rol });

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        nombre,
        rol,
      },
    });

    if (authError || !authData.user) {
      console.error('[API createUser] Error creating auth user:', authError);
      return res.status(500).json({
        success: false,
        error: `Error al crear usuario: ${authError?.message || 'Error desconocido'}`
      });
    }

    const userId = authData.user.id;
    console.log('[API createUser] Auth user created:', userId);

    // Profile is created automatically by trigger, but we need to update it with additional fields
    const profileUpdates: any = {};
    if (telefono) profileUpdates.telefono = telefono;
    if (estado) profileUpdates.estado = estado;
    if (codigo) profileUpdates.codigo = codigo;
    if (tipoEmpresa) profileUpdates.tipo_empresa = tipoEmpresa;
    if (provincia) profileUpdates.provincia = provincia;
    if (nombreFiscal) profileUpdates.nombre_fiscal = nombreFiscal;
    if (cif) profileUpdates.cif = cif;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profileError) {
        console.error('[API createUser] Error updating profile:', profileError);
        // Don't fail the entire operation, just log the error
      }
    }

    // Create cliente record if role is cliente
    if (rol === 'cliente') {
      const defaultModulos: ModulosActivos = modulosActivos || {
        subidaDocumentos: true,
        incidencias: true,
        asistenteE2: false,
        panelFinanciero: false,
        facturacion: false,
      };

      const clienteInsertData: any = {
        user_id: userId,
        nif: cif || `TEMP-${userId.substring(0, 8)}`, // Use CIF if provided, otherwise temporary NIF
        razon_social: nombreFiscal || nombre,
        persona_contacto: nombre,
        telefono: telefono || '',
        email: email,
        direccion_fiscal: '',
        estado: estado || 'activo',
        modulo_subida_documentos: defaultModulos.subidaDocumentos,
        modulo_incidencias: defaultModulos.incidencias,
        modulo_asistente_e2: defaultModulos.asistenteE2,
        modulo_panel_financiero: defaultModulos.panelFinanciero,
        modulo_facturacion: defaultModulos.facturacion,
      };

      // Add additional fields if they exist
      if (codigo) clienteInsertData.codigo = codigo;
      if (tipoEmpresa) clienteInsertData.tipo_empresa = tipoEmpresa;
      if (provincia) clienteInsertData.provincia = provincia;
      if (nombreFiscal) clienteInsertData.nombre_fiscal = nombreFiscal;
      if (cif) clienteInsertData.cif = cif;

      const { error: clienteError } = await supabaseAdmin
        .from('clientes')
        .insert(clienteInsertData);

      if (clienteError) {
        console.error('[API createUser] Error creating cliente record:', clienteError);
        // Don't fail the entire operation, just log the error
        // The cliente record can be created/updated later
      } else {
        console.log('[API createUser] Cliente record created successfully');
      }
    }

    console.log('[API createUser] User creation successful');
    return res.status(200).json({ success: true, userId });
  } catch (error: any) {
    console.error('[API createUser] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error inesperado al crear el usuario'
    });
  }
}
