import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * API endpoint for AI document verification workflow
 * 
 * This handles the advisor's verification actions:
 * - Validate (accept AI reading)
 * - Reject (mark for reprocessing or manual entry)
 * - Mark as pending review
 * 
 * Creates verification record for AI learning
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      documentoId,
      accion, // 'validado', 'rechazado', 'pendiente_revision'
      comentarios,
      camposCorregidos,
      asesorId,
      asesorNombre
    } = req.body;

    if (!documentoId || !accion) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['validado', 'rechazado', 'pendiente_revision'].includes(accion)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Get document
    const { data: documento, error: docError } = await supabaseAdmin
      .from('documentos')
      .select('*')
      .eq('id', documentoId)
      .single();

    if (docError || !documento) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const datosIA = documento.datos_ia as any;

    // Calculate field-level confidence scores
    const confianzasCampos: Record<string, number> = {};
    if (datosIA) {
      // Assign confidence to each field based on AI data
      Object.keys(datosIA).forEach(campo => {
        if (campo !== 'nivelConfianza' && datosIA[campo] !== undefined) {
          // If field was corrected by advisor, confidence was wrong
          if (camposCorregidos && camposCorregidos[campo]) {
            confianzasCampos[campo] = 0;
          } else {
            // Otherwise use global confidence or default high
            confianzasCampos[campo] = datosIA.nivelConfianza || 95;
          }
        }
      });
    }

    // Create verification record
    const { data: verificacion, error: verError } = await supabaseAdmin
      .from('verificaciones_ia')
      .insert({
        documento_id: documentoId,
        asesor_id: asesorId,
        modelo_ia: 'GPT-4-Vision', // This should come from actual AI model used
        confianza_global: datosIA?.nivelConfianza || 0,
        confianzas_campos: confianzasCampos,
        accion: accion,
        fecha_accion: new Date().toISOString(),
        comentarios_asesor: comentarios,
        campos_corregidos: camposCorregidos || {},
        usado_entrenamiento: false // Will be marked true when used for training
      })
      .select()
      .single();

    if (verError) {
      throw verError;
    }

    // Update document status based on action
    let newStatus: string;
    const updateData: any = {
      fecha_validacion: new Date().toISOString(),
      validado_por: asesorId
    };

    switch (accion) {
      case 'validado':
        newStatus = 'validado';
        // If fields were corrected, update datos_ia
        if (camposCorregidos && Object.keys(camposCorregidos).length > 0) {
          updateData.datos_ia = {
            ...datosIA,
            ...camposCorregidos,
            corregidoPorAsesor: true,
            asesorCorrecciones: camposCorregidos
          };
        }
        break;
      
      case 'rechazado':
        newStatus = 'rechazado';
        // Create incident for rejected document
        await supabaseAdmin
          .from('incidencias')
          .insert({
            documento_id: documentoId,
            cliente_id: documento.cliente_id,
            asesor_id: asesorId,
            estado: 'nueva',
            origen: 'asesor'
          });
        break;
      
      case 'pendiente_revision':
        newStatus = 'procesado_ia';
        break;
      
      default:
        newStatus = documento.estado;
    }

    updateData.estado = newStatus;

    await supabaseAdmin
      .from('documentos')
      .update(updateData)
      .eq('id', documentoId);

    // Update AI metrics
    await updateMetricsForVerification(accion, datosIA?.nivelConfianza || 0);

    // Create audit log
    await supabaseAdmin
      .from('auditoria_financiera')
      .insert({
        usuario_id: asesorId,
        usuario_nombre: asesorNombre || 'Asesor',
        usuario_rol: 'asesor',
        accion: `verificacion_ia_${accion}`,
        entidad_tipo: 'documento',
        entidad_id: documentoId,
        descripcion: `Documento ${accion}: ${documento.nombre}${comentarios ? ` - ${comentarios}` : ''}`,
        cliente_id: documento.cliente_id,
        datos_anteriores: { estado: documento.estado },
        datos_nuevos: { estado: newStatus, camposCorregidos }
      });

    return res.status(200).json({
      success: true,
      verificacion,
      documentoActualizado: {
        id: documentoId,
        estado: newStatus
      }
    });

  } catch (error: any) {
    console.error('Error in document verification:', error);
    return res.status(500).json({ 
      error: 'Error verifying document',
      details: error.message 
    });
  }
}

/**
 * Helper function to update AI metrics
 */
async function updateMetricsForVerification(
  accion: string,
  confianzaIA: number
) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Get or create today's metrics
    const { data: existingMetrics } = await supabaseAdmin
      .from('metricas_ia')
      .select('*')
      .eq('fecha', today)
      .eq('periodo', 'diario')
      .single();

    const incrementField = accion === 'validado' 
      ? 'documentos_validados' 
      : 'documentos_rechazados';

    const confidenceField = confianzaIA >= 95 
      ? 'alta_confianza'
      : confianzaIA >= 80
        ? 'media_confianza'
        : 'baja_confianza';

    if (existingMetrics) {
      // Update existing metrics
      await supabaseAdmin
        .from('metricas_ia')
        .update({
          [incrementField]: existingMetrics[incrementField] + 1,
          [confidenceField]: existingMetrics[confidenceField] + 1,
          documentos_procesados: existingMetrics.documentos_procesados + 1
        })
        .eq('id', existingMetrics.id);
    } else {
      // Create new metrics record
      await supabaseAdmin
        .from('metricas_ia')
        .insert({
          fecha: today,
          periodo: 'diario',
          documentos_procesados: 1,
          documentos_validados: accion === 'validado' ? 1 : 0,
          documentos_rechazados: accion === 'rechazado' ? 1 : 0,
          [confidenceField]: 1,
          precision_promedio: confianzaIA
        });
    }
  } catch (error) {
    console.error('Error updating AI metrics:', error);
    // Don't throw - metrics update failure shouldn't block verification
  }
}

