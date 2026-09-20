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
    const { clienteId, asunto, mensaje, asesorId, type } = req.body;

    if (!clienteId || !mensaje) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get client email
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('email, razon_social, profiles(email)')
      .eq('id', clienteId)
      .single();

    if (clienteError) throw clienteError;

    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, we'll just log the notification
    const clienteEmail = cliente.email || (Array.isArray(cliente.profiles) ? cliente.profiles[0]?.email : cliente.email);
    
    console.log('Sending notification:', {
      to: clienteEmail,
      subject: asunto,
      body: mensaje,
      type
    });

    // Create notification record in database
    await supabase.from('actividad_reciente').insert({
      tipo: 'notification_sent',
      descripcion: `Notificación enviada a ${cliente.razon_social}: ${asunto}`,
      usuario_id: asesorId,
      usuario_nombre: 'Asesor',
      enlace: `/asesor/clientes`
    });

    // In production, you would send actual email here:
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    await sgMail.send({
      to: cliente.email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: asunto,
      text: mensaje,
      html: mensaje.replace(/\n/g, '<br>')
    });
    */

    return res.status(200).json({ 
      success: true,
      message: 'Notificación enviada correctamente' 
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
