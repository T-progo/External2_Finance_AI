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

interface DeleteDocumentoRequest {
  documentoId: string;
}

interface DeleteDocumentoResponse {
  success: boolean;
  error?: string;
}

/**
 * Extract file path from Supabase storage URL
 * URL format: https://[project].supabase.co/storage/v1/object/public/documentos/[path]
 */
function extractFilePathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/documentos\/(.+)$/);
    return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
  } catch (error) {
    console.error('Error extracting file path from URL:', error);
    return null;
  }
}

/**
 * Document Delete API Route
 * Handles document deletion server-side to avoid CORS issues
 * Also deletes the associated file from storage
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteDocumentoResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { documentoId } = req.body as DeleteDocumentoRequest;

    if (!documentoId) {
      return res.status(400).json({ success: false, error: 'Documento ID is required' });
    }

    console.log('[API deleteDocumento] Starting deletion for documento:', documentoId);

    // First, fetch the documento to get the file URL
    const { data: documento, error: fetchError } = await supabaseAdmin
      .from('documentos')
      .select('id, url_archivo')
      .eq('id', documentoId)
      .maybeSingle();

    if (fetchError) {
      console.error('[API deleteDocumento] Error fetching documento:', fetchError);
      return res.status(500).json({
        success: false,
        error: `Error al obtener el documento: ${fetchError.message}`
      });
    }

    if (!documento) {
      console.warn('[API deleteDocumento] Documento not found:', documentoId);
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }

    // Delete the file from storage if URL exists
    if (documento.url_archivo) {
      const filePath = extractFilePathFromUrl(documento.url_archivo);
      
      if (filePath) {
        console.log('[API deleteDocumento] Deleting file from storage:', filePath);
        const { error: storageError } = await supabaseAdmin.storage
          .from('documentos')
          .remove([filePath]);

        if (storageError) {
          console.error('[API deleteDocumento] Error deleting file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
          // (file might already be deleted or not exist)
        } else {
          console.log('[API deleteDocumento] File deleted from storage successfully');
        }
      } else {
        console.warn('[API deleteDocumento] Could not extract file path from URL:', documento.url_archivo);
      }
    }

    // Delete the database record
    const { error: deleteError } = await supabaseAdmin
      .from('documentos')
      .delete()
      .eq('id', documentoId);

    if (deleteError) {
      console.error('[API deleteDocumento] Error deleting documento from database:', deleteError);
      return res.status(500).json({
        success: false,
        error: `Error al eliminar el documento: ${deleteError.message}`
      });
    }

    console.log('[API deleteDocumento] Documento deleted successfully');
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[API deleteDocumento] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error inesperado al eliminar el documento'
    });
  }
}

