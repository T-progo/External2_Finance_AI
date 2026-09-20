import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * API endpoint for manual sequential seat number assignment
 * 
 * Advisor can specify starting seat number and the system assigns
 * sequential numbers to selected documents (e.g., 3201, 3202, 3203...)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentoIds, nroAsientoInicial, usuarioId, usuarioNombre } = req.body;

    if (!documentoIds || !Array.isArray(documentoIds) || documentoIds.length === 0) {
      return res.status(400).json({ error: 'No documents provided' });
    }

    if (!nroAsientoInicial) {
      return res.status(400).json({ error: 'Starting seat number required' });
    }

    // Parse starting seat number (handle formats like "3201" or "A-3201")
    const match = nroAsientoInicial.match(/(\d+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid seat number format' });
    }

    const startingNumber = parseInt(match[1]);
    const prefix = nroAsientoInicial.substring(0, match.index);

    const resultados: {
      total: number;
      actualizados: number;
      asignaciones: Array<{
        documentoId: string;
        documentoNombre: string;
        nroAsiento: string;
      }>;
    } = {
      total: documentoIds.length,
      actualizados: 0,
      asignaciones: []
    };

    // Sort documents by date to ensure chronological assignment
    const { data: docs } = await supabaseAdmin
      .from('documentos')
      .select('*')
      .in('id', documentoIds)
      .order('fecha_subida', { ascending: true });

    if (!docs) {
      return res.status(404).json({ error: 'Documents not found' });
    }

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const nroAsiento = `${prefix}${startingNumber + i}`;

      // Update document
      const { error: updateError } = await supabaseAdmin
        .from('documentos')
        .update({
          nro_asiento_erp: nroAsiento,
          estado: 'contabilizado',
          fecha_contabilizacion: new Date().toISOString()
        })
        .eq('id', doc.id);

      if (updateError) {
        console.error('Error updating document:', updateError);
        continue;
      }

      // Create ERP asiento record
      const datosIA = doc.datos_ia as any;
      const apuntes = [];
      
      // Generate basic accounting entries from invoice data
      if (datosIA) {
        if (doc.tipo === 'recibida') {
          // Received invoice: Expense + VAT deductible
          apuntes.push({
            cuenta: '6000', // Expense account
            concepto: `${datosIA.razonSocialEmisor || 'Proveedor'} - ${datosIA.numeroFactura || ''}`,
            debe: datosIA.baseImponible || 0,
            haber: 0
          });
          apuntes.push({
            cuenta: '4720', // VAT deductible
            concepto: `IVA ${datosIA.tipoIVA || 21}%`,
            debe: datosIA.cuotaIVA || 0,
            haber: 0
          });
          apuntes.push({
            cuenta: '4000', // Suppliers
            concepto: datosIA.razonSocialEmisor || 'Proveedor',
            debe: 0,
            haber: datosIA.totalFactura || 0
          });
        } else if (doc.tipo === 'emitida') {
          // Issued invoice: Income + VAT payable
          apuntes.push({
            cuenta: '4300', // Customers
            concepto: datosIA.razonSocialReceptor || 'Cliente',
            debe: datosIA.totalFactura || 0,
            haber: 0
          });
          apuntes.push({
            cuenta: '7000', // Income account
            concepto: `${datosIA.razonSocialReceptor || 'Cliente'} - ${datosIA.numeroFactura || ''}`,
            debe: 0,
            haber: datosIA.baseImponible || 0
          });
          apuntes.push({
            cuenta: '4770', // VAT payable
            concepto: `IVA ${datosIA.tipoIVA || 21}%`,
            debe: 0,
            haber: datosIA.cuotaIVA || 0
          });
        }
      }

      const totalDebe = apuntes.reduce((sum, a) => sum + a.debe, 0);
      const totalHaber = apuntes.reduce((sum, a) => sum + a.haber, 0);

      await supabaseAdmin
        .from('erp_asientos')
        .insert({
          cliente_id: doc.cliente_id,
          documento_id: doc.id,
          nro_asiento: nroAsiento,
          fecha_asiento: datosIA?.fechaFactura || datosIA?.fecha || doc.fecha_subida,
          descripcion: `${doc.tipo === 'emitida' ? 'Factura emitida' : 'Factura recibida'} ${datosIA?.numeroFactura || ''}`,
          metodo_match: 'secuencial',
          apuntes: apuntes,
          total_debe: totalDebe,
          total_haber: totalHaber
        });

      resultados.actualizados++;
      resultados.asignaciones.push({
        documentoId: doc.id,
        documentoNombre: doc.nombre,
        nroAsiento: nroAsiento
      });
    }

    // Create audit log
    await supabaseAdmin
      .from('auditoria_financiera')
      .insert({
        usuario_id: usuarioId,
        usuario_nombre: usuarioNombre || 'Asesor',
        usuario_rol: 'asesor',
        accion: 'asignacion_manual_asientos',
        entidad_tipo: 'documentos',
        entidad_id: documentoIds[0], // Reference first document
        descripcion: `Asignación manual de ${resultados.actualizados} asientos consecutivos desde ${nroAsientoInicial}`,
        datos_nuevos: resultados.asignaciones
      });

    return res.status(200).json({
      success: true,
      resultados
    });

  } catch (error: any) {
    console.error('Error assigning seat numbers:', error);
    return res.status(500).json({ 
      error: 'Error assigning seat numbers',
      details: error.message 
    });
  }
}

