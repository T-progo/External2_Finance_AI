import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { archiveFinancialDataFromInvoice } from '@/lib/supabaseService';

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

interface UpdateDocumentoRequest {
  documentoId: string;
  updates: {
    nombre?: string;
    tamanio?: number;
    urlArchivo?: string;
    estado?: string;
    procesadoIA?: boolean;
    datosIA?: any;
    nroAsientoERP?: string | null;
    tipo?: string;
  };
}

interface UpdateDocumentoResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Document Update API Route
 * Handles document updates server-side to avoid CORS issues
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateDocumentoResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { documentoId, updates } = req.body as UpdateDocumentoRequest;

    if (!documentoId) {
      return res.status(400).json({ success: false, error: 'Documento ID is required' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    console.log('[API updateDocumento] Starting update for documento:', documentoId);
    console.log('[API updateDocumento] Updates to apply:', updates);

    // Build update object with only provided fields
    const updateData: any = {};
    
    if (updates.nombre !== undefined) updateData.nombre = updates.nombre;
    if (updates.tamanio !== undefined) updateData.tamanio = updates.tamanio;
    if (updates.urlArchivo !== undefined) updateData.url_archivo = updates.urlArchivo;
    if (updates.estado !== undefined) updateData.estado = updates.estado;
    if (updates.procesadoIA !== undefined) updateData.procesado_ia = updates.procesadoIA;
    if (updates.datosIA !== undefined) updateData.datos_ia = updates.datosIA;
    if (updates.nroAsientoERP !== undefined) updateData.nro_asiento_erp = updates.nroAsientoERP;
    if (updates.tipo !== undefined) updateData.tipo = updates.tipo;

    const { data, error } = await supabaseAdmin
      .from('documentos')
      .update(updateData)
      .eq('id', documentoId)
      .select();

    if (error) {
      console.error('[API updateDocumento] Error updating documento:', error);
      return res.status(500).json({
        success: false,
        error: `Error al actualizar el documento: ${error.message}`
      });
    }

    if (!data || data.length === 0) {
      console.error('[API updateDocumento] No rows were updated');
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado o no se pudo actualizar'
      });
    }

    console.log('[API updateDocumento] Update successful!');
    
    // If financial data was updated, archive it to datos_financieros
    // Archive when: 1) datosIA is provided in updates, OR 2) document is being marked as contabilizado
    if (data && data.length > 0) {
      const updatedDoc = data[0];
      const shouldArchive = 
        (updates.datosIA && (updates.datosIA.totalFactura || updates.datosIA.importeTotal)) ||
        (updates.estado === 'contabilizado' && updatedDoc.datos_ia && (updatedDoc.datos_ia.totalFactura || updatedDoc.datos_ia.importeTotal));
      
      if (shouldArchive) {
        try {
          // Use the provided datosIA if available, otherwise use the updated document's datos_ia
          const datosIAToArchive = updates.datosIA || updatedDoc.datos_ia;
          
          await archiveFinancialDataFromInvoice(
            updatedDoc.cliente_id,
            {
              tipo: updatedDoc.tipo,
              datos_ia: datosIAToArchive,
              fecha_subida: updatedDoc.fecha_subida
            }
          );
          console.log('[API updateDocumento] Financial data archived successfully');
        } catch (archiveError) {
          console.error('[API updateDocumento] Error archiving financial data (non-critical):', archiveError);
          // Don't fail the request if archiving fails
        }
      }
    }
    
    return res.status(200).json({ success: true, data: data[0] });
  } catch (error: any) {
    console.error('[API updateDocumento] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error inesperado al actualizar el documento'
    });
  }
}

