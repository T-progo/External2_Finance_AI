import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface DownloadZipRequest {
  documentoIds: string[];
}

/**
 * Sanitize filename for ZIP and ensure uniqueness.
 */
function safeZipName(nombre: string, used: Set<string>): string {
  const base = (nombre || 'documento').replace(/[^\w\u00C0-\u024F.\- ()]/gi, '_').slice(0, 200);
  let name = base;
  let n = 0;
  while (used.has(name)) {
    const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
    const stem = ext ? base.slice(0, base.lastIndexOf('.')) : base;
    name = `${stem}_${++n}${ext}`;
  }
  used.add(name);
  return name;
}

/**
 * Download selected documents as a ZIP file.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentoIds } = req.body as DownloadZipRequest;

    if (!Array.isArray(documentoIds) || documentoIds.length === 0) {
      return res.status(400).json({ error: 'documentoIds array is required' });
    }

    const { data: docs, error: fetchError } = await supabaseAdmin
      .from('documentos')
      .select('id, nombre, url_archivo')
      .in('id', documentoIds);

    if (fetchError) {
      console.error('[download-zip] Error fetching documents:', fetchError);
      return res.status(500).json({ error: 'Error al obtener documentos' });
    }

    const withUrl = (docs || []).filter((d) => d.url_archivo);
    if (withUrl.length === 0) {
      return res.status(400).json({ error: 'Ningún documento tiene archivo para descargar' });
    }

    const zip = new JSZip();
    const used = new Set<string>();

    for (const doc of withUrl) {
      try {
        const resp = await fetch(doc.url_archivo);
        if (!resp.ok) continue;
        const buf = Buffer.from(await resp.arrayBuffer());
        const name = safeZipName(doc.nombre || 'documento', used);
        zip.file(name, buf);
      } catch (e) {
        console.warn('[download-zip] Skip fetch for doc', doc.id, e);
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const filename = `documentos-contabilizados-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(zipBuffer.length));
    return res.send(zipBuffer);
  } catch (error: any) {
    console.error('[download-zip] Unexpected error:', error);
    return res.status(500).json({ error: error?.message || 'Error al generar ZIP' });
  }
}
