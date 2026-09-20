import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { User, ModulosActivos } from '@/types';

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

interface UpdateUserRequest {
  userId: string;
  updates: {
    nombre?: string;
    telefono?: string;
    estado?: 'activo' | 'inactivo';
    notasInternas?: string;
    rol?: 'admin' | 'asesor' | 'cliente';
    modulosActivos?: ModulosActivos;
    codigo?: string;
    tipoEmpresa?: string;
    provincia?: string;
    nombreFiscal?: string;
    cif?: string;
  };
}

interface UpdateUserResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * User Profile Update API Route
 * Handles user profile updates server-side to avoid CORS issues
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateUserResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId, updates } = req.body as UpdateUserRequest;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    console.log('[API updateUser] Starting update for user:', userId);
    console.log('[API updateUser] Updates to apply:', updates);

    // Update profile fields
    const profileUpdates: any = {};
    if (updates.nombre !== undefined) profileUpdates.nombre = updates.nombre;
    if (updates.telefono !== undefined) profileUpdates.telefono = updates.telefono;
    if (updates.estado !== undefined) profileUpdates.estado = updates.estado;
    if (updates.notasInternas !== undefined) profileUpdates.notas_internas = updates.notasInternas;
    if (updates.rol !== undefined) profileUpdates.rol = updates.rol;
    if (updates.codigo !== undefined) profileUpdates.codigo = updates.codigo;
    if (updates.tipoEmpresa !== undefined) profileUpdates.tipo_empresa = updates.tipoEmpresa;
    if (updates.provincia !== undefined) profileUpdates.provincia = updates.provincia;
    if (updates.nombreFiscal !== undefined) profileUpdates.nombre_fiscal = updates.nombreFiscal;
    if (updates.cif !== undefined) profileUpdates.cif = updates.cif;

    if (Object.keys(profileUpdates).length > 0) {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId)
        .select();

      if (profileError) {
        console.error('[API updateUser] Error updating profile:', profileError);
        return res.status(500).json({
          success: false,
          error: `Error al actualizar el perfil: ${profileError.message}`
        });
      }

      if (!profileData || profileData.length === 0) {
        console.warn('[API updateUser] Warning: Profile update returned no rows.');
        return res.status(500).json({
          success: false,
          error: 'No se pudo actualizar el perfil. Verifica los permisos.'
        });
      }

      console.log('[API updateUser] Profile updated successfully');
    }

    // Update modulosActivos in clientes table if provided
    if (updates.modulosActivos !== undefined) {
      const { data: clienteData, error: fetchError } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('[API updateUser] Error fetching cliente data:', fetchError);
        return res.status(500).json({
          success: false,
          error: `Error al buscar datos del cliente: ${fetchError.message}`
        });
      }

      if (clienteData) {
        // Update existing cliente record
        const clienteUpdates: any = {
          modulo_subida_documentos: updates.modulosActivos.subidaDocumentos,
          modulo_incidencias: updates.modulosActivos.incidencias,
          modulo_asistente_e2: updates.modulosActivos.asistenteE2,
          modulo_panel_financiero: updates.modulosActivos.panelFinanciero,
          modulo_facturacion: updates.modulosActivos.facturacion,
        };

        // Add additional fields if provided
        if (updates.codigo !== undefined) clienteUpdates.codigo = updates.codigo;
        if (updates.tipoEmpresa !== undefined) clienteUpdates.tipo_empresa = updates.tipoEmpresa;
        if (updates.provincia !== undefined) clienteUpdates.provincia = updates.provincia;
        if (updates.nombreFiscal !== undefined) clienteUpdates.nombre_fiscal = updates.nombreFiscal;
        if (updates.cif !== undefined) clienteUpdates.cif = updates.cif;

        const { data: updateData, error: clienteError } = await supabaseAdmin
          .from('clientes')
          .update(clienteUpdates)
          .eq('id', clienteData.id)
          .select();

        if (clienteError) {
          console.error('[API updateUser] Error updating cliente modulos:', clienteError);
          return res.status(500).json({
            success: false,
            error: `Error al actualizar módulos: ${clienteError.message}`
          });
        }

        if (!updateData || updateData.length === 0) {
          console.warn('[API updateUser] Warning: Cliente modulos update returned no rows.');
          return res.status(500).json({
            success: false,
            error: 'No se pudieron actualizar los módulos activos.'
          });
        }

        console.log('[API updateUser] Cliente modulos updated successfully');
      } else {
        // Cliente record doesn't exist - create it with minimal data
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('nombre, email, telefono')
          .eq('id', userId)
          .single();

        if (profileError || !profileData) {
          console.error('[API updateUser] Error fetching profile data for cliente creation:', profileError);
          return res.status(500).json({
            success: false,
            error: `Error al obtener datos del perfil: ${profileError?.message || 'Perfil no encontrado'}`
          });
        }

        // Create cliente record with minimal required data
        const { data: newCliente, error: createError } = await supabaseAdmin
          .from('clientes')
          .insert({
            user_id: userId,
            nif: `TEMP-${userId.substring(0, 8)}`, // Temporary NIF, should be updated later
            razon_social: profileData.nombre || 'Cliente',
            persona_contacto: profileData.nombre || 'Cliente',
            telefono: profileData.telefono || '',
            email: profileData.email,
            direccion_fiscal: '',
            estado: 'activo',
            modulo_subida_documentos: updates.modulosActivos.subidaDocumentos,
            modulo_incidencias: updates.modulosActivos.incidencias,
            modulo_asistente_e2: updates.modulosActivos.asistenteE2,
            modulo_panel_financiero: updates.modulosActivos.panelFinanciero,
            modulo_facturacion: updates.modulosActivos.facturacion,
          })
          .select()
          .single();

        if (createError) {
          console.error('[API updateUser] Error creating cliente record:', createError);
          return res.status(500).json({
            success: false,
            error: `Error al crear registro de cliente: ${createError.message}`
          });
        }

        console.log('[API updateUser] Created cliente record for user:', userId);
      }
    }

    console.log('[API updateUser] Update successful!');
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[API updateUser] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error inesperado al actualizar el usuario'
    });
  }
}
