import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type SummaryResponse = {
  success: boolean;
  data?: any[];
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SummaryResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { asesorId } = req.body as { asesorId?: string };
    if (!asesorId) {
      return res.status(400).json({ success: false, error: 'asesorId is required' });
    }

    // Get assigned clients
    const { data: assignedClients, error: clientsError } = await supabaseAdmin
      .from('asesor_cliente')
      .select('cliente_id')
      .eq('asesor_id', asesorId);

    if (clientsError) {
      throw clientsError;
    }

    const clientIds = assignedClients?.map((c) => c.cliente_id) || [];
    if (clientIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('datos_financieros')
      .select('*')
      .in('cliente_id', clientIds)
      .order('ultimo_cierre', { ascending: false, nullsFirst: false });

    if (error) throw error;

    return res.status(200).json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('[financial/summary-for-advisor] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unexpected error',
    });
  }
}

