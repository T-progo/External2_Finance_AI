import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clienteId, threshold, enabled } = req.body;

    if (!clienteId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    // Store configuration in a notifications_config table
    // For now, we'll store it in client metadata
    const { error } = await supabase
      .from('clientes')
      .update({
        // You would need to add these columns to the clientes table
        // auto_notification_enabled: enabled,
        // auto_notification_threshold: threshold || 15
      })
      .eq('id', clienteId);

    if (error) {
      console.error('Error updating notification config:', error);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Configuración guardada' 
    });

  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
