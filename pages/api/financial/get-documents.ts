import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clienteId } = req.query;

    if (!clienteId || typeof clienteId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid clienteId' });
    }

    // Fetch financial documents using admin client to bypass RLS
    const { data: documentos, error } = await supabaseAdmin
      .from('documentos_financieros')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha_subida', { ascending: false });

    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ error: `Error al obtener documentos: ${error.message}` });
    }

    // Transform the data to match the expected format
    const transformedDocs = (documentos || []).map((doc: any) => ({
      id: doc.id,
      clienteId: doc.cliente_id,
      asesorId: doc.asesor_id,
      nombre: doc.nombre,
      tipo: doc.tipo,
      periodo: doc.periodo,
      fechaSubida: doc.fecha_subida ? new Date(doc.fecha_subida).toISOString() : new Date().toISOString(),
      urlArchivo: doc.url_archivo,
      tamaño: doc.tamanio || 0,
      procesadoIA: doc.procesado_ia || false,
      datosExtraidos: doc.datos_extraidos || null,
      analisisIA: doc.analisis_ia || null,
    }));

    console.log(`[get-documents] Found ${transformedDocs.length} documents for clienteId: ${clienteId}`);
    return res.status(200).json(transformedDocs);
  } catch (error: any) {
    console.error('Error fetching financial documents:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
