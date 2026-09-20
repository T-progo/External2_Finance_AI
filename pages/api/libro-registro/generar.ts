import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { LibroRegistroExportData } from '@/types';

/**
 * API endpoint to generate Libro Registro (Invoice Record Book) Excel file
 * 
 * Flow:
 * 1. Advisor selects period and type (emitidas/recibidas)
 * 2. System gathers all validated invoices for that period
 * 3. Generates Excel with all invoice details
 * 4. Creates libro_registro record
 * 5. Marks documents as included in libro (bloqueado = true to prevent changes)
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
      clienteId, 
      periodo, 
      ejercicioFiscal,
      tipoLibro, 
      usuarioId,
      usuarioNombre 
    } = req.body;

    if (!clienteId || !periodo || !tipoLibro) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['emitidas', 'recibidas', 'bienes_inversion'].includes(tipoLibro)) {
      return res.status(400).json({ error: 'Invalid tipoLibro' });
    }

    // Get client info
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (!cliente) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get all validated documents for the period and type
    const documentType = tipoLibro === 'emitidas' ? 'emitida' : 'recibida';
    
    const { data: documentos, error: docsError } = await supabaseAdmin
      .from('documentos')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('tipo', documentType)
      .in('estado', ['validado', 'contabilizado'])
      .not('datos_ia', 'is', null);

    if (docsError) {
      throw docsError;
    }

    if (!documentos || documentos.length === 0) {
      return res.status(400).json({ 
        error: 'No validated documents found for this period and type' 
      });
    }

    // Filter by period (this should be enhanced with proper period parsing)
    const filteredDocs = documentos.filter(doc => {
      const datosIA = doc.datos_ia as any;
      const fechaFactura = datosIA?.fechaFactura || datosIA?.fecha;
      if (!fechaFactura) return false;
      
      // Simple period matching (should be enhanced for actual period logic)
      const fecha = new Date(fechaFactura);
      const year = fecha.getFullYear().toString();
      
      return periodo.includes(year);
    });

    // Prepare export data
    const facturas = filteredDocs.map(doc => {
      const datosIA = doc.datos_ia as any;
      return {
        fecha: datosIA?.fechaFactura || datosIA?.fecha || '',
        numeroFactura: datosIA?.numeroFactura || '',
        nifContraparte: tipoLibro === 'emitidas' 
          ? (datosIA?.nifReceptor || '')
          : (datosIA?.nifEmisor || ''),
        razonSocialContraparte: tipoLibro === 'emitidas'
          ? (datosIA?.razonSocialReceptor || '')
          : (datosIA?.razonSocialEmisor || ''),
        baseImponible: datosIA?.baseImponible || 0,
        tipoIVA: datosIA?.tipoIVA || 0,
        cuotaIVA: datosIA?.cuotaIVA || 0,
        total: datosIA?.totalFactura || datosIA?.importeTotal || 0,
        documentoId: doc.id,
        nroAsiento: doc.nro_asiento_erp || ''
      };
    });

    // Sort by date
    facturas.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // Calculate totals
    const totales = facturas.reduce((acc, f) => ({
      baseImponible: acc.baseImponible + f.baseImponible,
      cuotaIVA: acc.cuotaIVA + f.cuotaIVA,
      total: acc.total + f.total
    }), { baseImponible: 0, cuotaIVA: 0, total: 0 });

    const exportData: LibroRegistroExportData = {
      cliente: {
        nif: cliente.nif,
        razonSocial: cliente.razon_social
      },
      periodo,
      facturas,
      totales
    };

    // In a real implementation, you would generate actual Excel file here
    // For now, we'll create a JSON representation and a mock URL
    const mockExcelUrl = `/exports/libro-registro-${clienteId}-${periodo}-${tipoLibro}.xlsx`;

    // Create libro_registro record
    const { data: libro, error: libroError } = await supabaseAdmin
      .from('libro_registro')
      .insert({
        cliente_id: clienteId,
        periodo,
        ejercicio_fiscal: ejercicioFiscal || new Date().getFullYear().toString(),
        tipo_libro: tipoLibro,
        generado_por: usuarioId,
        url_archivo_excel: mockExcelUrl,
        total_facturas: filteredDocs.length,
        total_base_imponible: totales.baseImponible,
        total_iva: totales.cuotaIVA,
        total_importe: totales.total,
        documentos_incluidos: filteredDocs.map(d => d.id),
        estado: 'generado'
      })
      .select()
      .single();

    if (libroError) {
      throw libroError;
    }

    // Mark documents as included in libro and block them
    await supabaseAdmin
      .from('documentos')
      .update({
        incluido_en_libro: libro.id,
        bloqueado: true
      })
      .in('id', filteredDocs.map(d => d.id));

    // Create audit log
    await supabaseAdmin
      .from('auditoria_financiera')
      .insert({
        usuario_id: usuarioId,
        usuario_nombre: usuarioNombre || 'Asesor',
        usuario_rol: 'asesor',
        accion: 'generar_libro_registro',
        entidad_tipo: 'libro_registro',
        entidad_id: libro.id,
        descripcion: `Libro Registro ${tipoLibro} generado para ${periodo}: ${filteredDocs.length} facturas, total ${totales.total.toFixed(2)}€`,
        cliente_id: clienteId,
        datos_nuevos: {
          libroId: libro.id,
          totalFacturas: filteredDocs.length,
          totales
        }
      });

    return res.status(200).json({
      success: true,
      libro,
      exportData,
      summary: {
        totalFacturas: filteredDocs.length,
        totales
      }
    });

  } catch (error: any) {
    console.error('Error generating libro registro:', error);
    return res.status(500).json({ 
      error: 'Error generating invoice record book',
      details: error.message 
    });
  }
}

