import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Cliente, ModulosActivos } from '@/types';

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

interface UpdateClienteRequest {
  clienteId: string;
  updates: {
    asesoresAsignados?: string[];
    modulosActivos?: ModulosActivos;
    nif?: string;
    razonSocial?: string;
    nombreComercial?: string;
    personaContacto?: string;
    telefono?: string;
    email?: string;
    direccionFiscal?: string;
    estado?: 'activo' | 'inactivo';
  };
}

interface UpdateClienteResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Client Update API Route
 * Handles client updates server-side to avoid CORS issues
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateClienteResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { clienteId, updates } = req.body as UpdateClienteRequest;

    if (!clienteId) {
      return res.status(400).json({ success: false, error: 'Cliente ID is required' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    console.log('[API updateCliente] Starting update for cliente:', clienteId);
    console.log('[API updateCliente] Updates to apply:', updates);

    // Handle asesor assignments separately first (before updating client record)
    if (updates.asesoresAsignados !== undefined) {
      console.log('[API updateCliente] Updating asesor assignments first...');
      
      // Remove existing assignments
      const { error: deleteError } = await supabaseAdmin
        .from('asesor_cliente')
        .delete()
        .eq('cliente_id', clienteId);

      if (deleteError) {
        console.error('[API updateCliente] Error deleting existing asesor assignments:', deleteError);
        return res.status(500).json({ 
          success: false, 
          error: `Error al eliminar asignaciones de asesores: ${deleteError.message}` 
        });
      }

      // Add new assignments
      if (updates.asesoresAsignados.length > 0) {
        const rows = updates.asesoresAsignados.map(asesorId => ({
          asesor_id: asesorId,
          cliente_id: clienteId,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('asesor_cliente')
          .insert(rows);

        if (insertError) {
          console.error('[API updateCliente] Error inserting new asesor assignments:', insertError);
          return res.status(500).json({ 
            success: false, 
            error: `Error al crear asignaciones de asesores: ${insertError.message}` 
          });
        }
        
        console.log('[API updateCliente] Asesor assignments updated successfully');
      } else {
        console.log('[API updateCliente] No asesores to assign (all removed)');
      }
    }

    // Build update object with only provided fields (excluding asesoresAsignados)
    const updateData: any = {};
    
    if (updates.nif !== undefined) updateData.nif = updates.nif;
    if (updates.razonSocial !== undefined) updateData.razon_social = updates.razonSocial;
    if (updates.nombreComercial !== undefined) updateData.nombre_comercial = updates.nombreComercial;
    if (updates.personaContacto !== undefined) updateData.persona_contacto = updates.personaContacto;
    if (updates.telefono !== undefined) updateData.telefono = updates.telefono;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.direccionFiscal !== undefined) updateData.direccion_fiscal = updates.direccionFiscal;
    if (updates.estado !== undefined) updateData.estado = updates.estado;
    
    if (updates.modulosActivos) {
      // Update all module properties if modulosActivos is provided
      if (updates.modulosActivos.subidaDocumentos !== undefined) 
        updateData.modulo_subida_documentos = updates.modulosActivos.subidaDocumentos;
      if (updates.modulosActivos.incidencias !== undefined) 
        updateData.modulo_incidencias = updates.modulosActivos.incidencias;
      if (updates.modulosActivos.asistenteE2 !== undefined) 
        updateData.modulo_asistente_e2 = updates.modulosActivos.asistenteE2;
      if (updates.modulosActivos.panelFinanciero !== undefined) 
        updateData.modulo_panel_financiero = updates.modulosActivos.panelFinanciero;
      if (updates.modulosActivos.facturacion !== undefined) 
        updateData.modulo_facturacion = updates.modulosActivos.facturacion;
      
      console.log('[API updateCliente] Updating modulos activos:', updateData);
    }

    // Only update client record if there are fields to update
    if (Object.keys(updateData).length > 0) {
      console.log('[API updateCliente] Final update data to send to Supabase:', updateData);

      const { data, error } = await supabaseAdmin
        .from('clientes')
        .update(updateData)
        .eq('id', clienteId)
        .select();

      if (error) {
        console.error('[API updateCliente] Supabase error:', error);
        
        // If asesor assignments were successfully updated, don't fail completely
        if (updates.asesoresAsignados !== undefined) {
          console.warn('[API updateCliente] Client record update failed, but asesor assignments were updated successfully');
          console.warn('[API updateCliente] Attempting to fetch current client data...');
          
          // Try to fetch the current client data
          const { data: clienteData, error: fetchError } = await supabaseAdmin
            .from('clientes')
            .select('*')
            .eq('id', clienteId)
            .single();

          if (!fetchError && clienteData) {
            console.log('[API updateCliente] Successfully fetched client data after partial update');
            return res.status(200).json({ success: true, data: clienteData });
          }
        }
        
        return res.status(500).json({ 
          success: false, 
          error: `Error actualizando cliente: ${error.message} (${error.code || 'unknown'})` 
        });
      }

      console.log('[API updateCliente] Update successful! Returned data:', data);
      
      if (!data || data.length === 0) {
        console.error('[API updateCliente] ❌ ERROR: No rows were updated!');
        
        // If asesor assignments were successfully updated, don't fail completely
        if (updates.asesoresAsignados !== undefined) {
          console.warn('[API updateCliente] Client record update returned no data, but asesor assignments were updated');
          const { data: clienteData, error: fetchError } = await supabaseAdmin
            .from('clientes')
            .select('*')
            .eq('id', clienteId)
            .single();

          if (!fetchError && clienteData) {
            return res.status(200).json({ success: true, data: clienteData });
          }
        }
        
        console.error('[API updateCliente] This is most likely an RLS (Row Level Security) policy issue.');
        console.error('[API updateCliente] SOLUTION: Run the SQL script at scripts/QUICK_FIX_RLS.sql in Supabase SQL Editor');
        console.error('[API updateCliente] Cliente ID attempted:', clienteId);
        
        return res.status(403).json({ 
          success: false, 
          error: 'No se pudo actualizar el perfil debido a permisos de seguridad. Por favor, contacta con soporte técnico. (Error: RLS policy blocking update)' 
        });
      }

      return res.status(200).json({ success: true, data: data[0] });
    } else {
      // If only asesor assignments were updated, fetch and return the current client data
      console.log('[API updateCliente] Only asesor assignments were updated, fetching current client data...');
      const { data: clienteData, error: fetchError } = await supabaseAdmin
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();

      if (fetchError || !clienteData) {
        return res.status(500).json({ 
          success: false, 
          error: `Error al obtener datos del cliente: ${fetchError?.message || 'Cliente no encontrado'}` 
        });
      }

      return res.status(200).json({ success: true, data: clienteData });
    }
  } catch (error: any) {
    console.error('[API updateCliente] Unexpected error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error inesperado al actualizar el cliente' 
    });
  }
}


