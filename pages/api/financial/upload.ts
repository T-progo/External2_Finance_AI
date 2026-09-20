import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      clienteId,
      asesorId,
      tipo,
      periodo,
      urlArchivo,
      nombre,
      tamanio
    } = req.body;

    if (!clienteId || !asesorId || !tipo || !periodo || !urlArchivo || !nombre || !tamanio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create financial document record using admin client to bypass RLS
    const { data: docFinanciero, error: docError } = await supabaseAdmin
      .from('documentos_financieros')
      .insert({
        cliente_id: clienteId,
        asesor_id: asesorId,
        nombre,
        tipo,
        periodo,
        url_archivo: urlArchivo,
        tamanio,
        procesado_ia: false,
      })
      .select('id')
      .single();

    if (docError) {
      console.error('Database insert error:', docError);
      return res.status(500).json({ error: `Error al crear el registro: ${docError.message}` });
    }

    return res.status(200).json({ id: docFinanciero.id });
  } catch (error: any) {
    console.error('Error uploading financial document:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
