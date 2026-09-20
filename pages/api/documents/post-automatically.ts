import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { archiveFinancialDataFromInvoice } from '@/lib/supabaseService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Invalid document IDs' });
    }

    // Get documents with AI data
    const { data: documents, error: fetchError } = await supabase
      .from('documentos')
      .select('*')
      .in('id', documentIds);

    if (fetchError) throw fetchError;

    let posted = 0;
    let failed = 0;

    for (const doc of documents || []) {
      try {
        // Check if AI confidence is high enough
        if (doc.datos_ia?.nivelConfianza && doc.datos_ia.nivelConfianza >= 95) {
          // TODO: Integrate with ERP API to post the document
          // For now, just update the status
          
          const { error: updateError } = await supabase
            .from('documentos')
            .update({
              estado: 'contabilizado',
              nro_asiento_erp: `AUTO-${Date.now()}-${doc.id.slice(0, 8)}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', doc.id);

          if (updateError) throw updateError;
          
          // Archive financial data to datos_financieros
          try {
            await archiveFinancialDataFromInvoice(doc.cliente_id, {
              tipo: doc.tipo,
              datos_ia: doc.datos_ia,
              fecha_subida: doc.fecha_subida
            });
          } catch (archiveError) {
            console.error(`Error archiving financial data for document ${doc.id}:`, archiveError);
            // Don't fail the posting if archiving fails
          }
          
          posted++;
        } else {
          // Create incident for low confidence
          await supabase
            .from('incidencias')
            .insert({
              documento_id: doc.id,
              cliente_id: doc.cliente_id,
              asesor_id: doc.asesor_id,
              estado: 'nueva',
              origen: 'ia'
            });

          const { data: incidencia } = await supabase
            .from('incidencias')
            .select('id')
            .eq('documento_id', doc.id)
            .single();

          if (incidencia) {
            await supabase
              .from('mensajes_incidencia')
              .insert({
                incidencia_id: incidencia.id,
                usuario_id: null,
                mensaje: `La IA detectó un nivel de confianza bajo (${doc.datos_ia?.nivelConfianza}%) en este documento. Se requiere revisión manual.`
              });
          }

          failed++;
        }
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        failed++;
      }
    }

    return res.status(200).json({ 
      posted, 
      failed,
      message: `${posted} documento(s) contabilizado(s), ${failed} requieren revisión manual` 
    });

  } catch (error) {
    console.error('Error posting documents automatically:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
