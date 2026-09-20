import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

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

interface SetAdvisorClientsRequest {
  asesorId: string;
  clienteIds: string[];
}

interface SetAdvisorClientsResponse {
  success: boolean;
  error?: string;
}

/**
 * Set Advisor Clients API Route
 * Handles advisor-client relationship updates server-side to avoid CORS issues
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SetAdvisorClientsResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { asesorId, clienteIds } = req.body as SetAdvisorClientsRequest;

    if (!asesorId) {
      return res.status(400).json({ success: false, error: 'Asesor ID is required' });
    }

    if (!Array.isArray(clienteIds)) {
      return res.status(400).json({ success: false, error: 'clienteIds must be an array' });
    }

    console.log('[API setAdvisorClients] Setting clients for asesor:', asesorId);
    console.log('[API setAdvisorClients] Cliente IDs:', clienteIds);

    // Delete existing relationships for this advisor
    const { error: deleteError } = await supabaseAdmin
      .from('asesor_cliente')
      .delete()
      .eq('asesor_id', asesorId);

    if (deleteError) {
      console.error('[API setAdvisorClients] Error deleting existing advisor-client relationships:', deleteError);
      return res.status(500).json({ 
        success: false, 
        error: `Error al eliminar relaciones existentes: ${deleteError.message}` 
      });
    }

    // Insert new relationships if any clients are selected
    if (clienteIds.length > 0) {
      const rows = clienteIds.map((clienteId) => ({
        asesor_id: asesorId,
        cliente_id: clienteId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('asesor_cliente')
        .insert(rows);

      if (insertError) {
        console.error('[API setAdvisorClients] Error inserting advisor-client relationships:', insertError);
        return res.status(500).json({ 
          success: false, 
          error: `Error al crear las relaciones: ${insertError.message}` 
        });
      }
    }

    console.log('[API setAdvisorClients] Successfully updated advisor-client relationships');
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[API setAdvisorClients] Unexpected error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error inesperado al actualizar las relaciones' 
    });
  }
}


