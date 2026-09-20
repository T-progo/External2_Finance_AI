import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * API endpoint to import ERP accounting entries (asientos) and automatically match them with invoices
 * 
 * Flow:
 * 1. Advisor uploads ERP report (Excel/TXT)
 * 2. System parses the report and extracts asientos
 * 3. For each asiento, try to match with existing documents by:
 *    - Date, NIF, invoice number, total amount
 * 4. Create erp_asientos records with match confidence
 * 5. Update documentos with nro_asiento_erp
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clienteId, asientos, archivoOrigen } = req.body;

    if (!clienteId || !asientos || !Array.isArray(asientos)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const resultados: {
      total: number;
      matched: number;
      unmatched: number;
      asientosCreados: any[];
    } = {
      total: asientos.length,
      matched: 0,
      unmatched: 0,
      asientosCreados: []
    };

    for (const asiento of asientos) {
      const { nroAsiento, fecha, descripcion, apuntes, facturaAsociada } = asiento;

      // Try to find matching document
      let documentoId: string | null = null;
      let confianzaMatch = 0;

      if (facturaAsociada) {
        const { data: matchingDocs } = await supabaseAdmin
          .from('documentos')
          .select('*')
          .eq('cliente_id', clienteId)
          .not('datos_ia', 'is', null);

        if (matchingDocs && matchingDocs.length > 0) {
          // Match by invoice number, date, NIF, and total
          for (const doc of matchingDocs) {
            const datosIA = doc.datos_ia as any;
            let score = 0;

            // Match invoice number
            if (datosIA?.numeroFactura === facturaAsociada.numeroFactura) {
              score += 40;
            }

            // Match date (within 3 days tolerance)
            const docFecha = new Date(datosIA?.fechaFactura || datosIA?.fecha || '');
            const asientoFecha = new Date(facturaAsociada.fecha);
            const diffDays = Math.abs((docFecha.getTime() - asientoFecha.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 3) {
              score += 30;
            }

            // Match NIF
            if (datosIA?.nifEmisor === facturaAsociada.nif || datosIA?.nifReceptor === facturaAsociada.nif) {
              score += 20;
            }

            // Match total (within 1% tolerance)
            const docTotal = datosIA?.totalFactura || datosIA?.importeTotal || 0;
            const diff = Math.abs(docTotal - facturaAsociada.total);
            const diffPercentage = docTotal > 0 ? (diff / docTotal) * 100 : 100;
            if (diffPercentage <= 1) {
              score += 10;
            }

            if (score > confianzaMatch) {
              confianzaMatch = score;
              documentoId = doc.id;
            }
          }
        }
      }

      // Calculate totals
      const totalDebe = apuntes.reduce((sum: number, a: any) => sum + (a.debe || 0), 0);
      const totalHaber = apuntes.reduce((sum: number, a: any) => sum + (a.haber || 0), 0);

      // Create ERP asiento record
      const { data: newAsiento, error: asientoError } = await supabaseAdmin
        .from('erp_asientos')
        .insert({
          cliente_id: clienteId,
          documento_id: documentoId,
          nro_asiento: nroAsiento,
          fecha_asiento: fecha,
          descripcion: descripcion,
          archivo_erp_origen: archivoOrigen,
          metodo_match: documentoId ? 'automatico' : 'manual',
          confianza_match: confianzaMatch,
          apuntes: apuntes,
          total_debe: totalDebe,
          total_haber: totalHaber
        })
        .select()
        .single();

      if (asientoError) {
        console.error('Error creating ERP asiento:', asientoError);
        continue;
      }

      // Update documento with ERP seat number if matched
      if (documentoId && confianzaMatch >= 70) {
        await supabaseAdmin
          .from('documentos')
          .update({
            nro_asiento_erp: nroAsiento,
            estado: 'contabilizado'
          })
          .eq('id', documentoId);

        resultados.matched++;
      } else {
        resultados.unmatched++;
      }

      resultados.asientosCreados.push(newAsiento);
    }

    // Create audit log
    await supabaseAdmin
      .from('auditoria_financiera')
      .insert({
        usuario_nombre: 'Sistema',
        usuario_rol: 'admin',
        accion: 'importar_asientos_erp',
        entidad_tipo: 'erp_asientos',
        entidad_id: clienteId,
        descripcion: `Importados ${resultados.total} asientos del ERP. ${resultados.matched} coincidencias automáticas.`,
        cliente_id: clienteId
      });

    return res.status(200).json({
      success: true,
      resultados
    });

  } catch (error: any) {
    console.error('Error importing ERP asientos:', error);
    return res.status(500).json({ 
      error: 'Error importing ERP entries',
      details: error.message 
    });
  }
}

