import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * API endpoint to upload mixed financial source documents
 * (P&L, Balance Sheet, General Ledger, Bank Statements, etc.)
 * 
 * These documents are processed by AI to extract financial metrics
 * and build comprehensive financial models
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
      asesorId,
      tipo,
      periodo,
      ejercicioFiscal,
      urlArchivo,
      nombre,
      tamanio,
      notas,
      usuarioNombre
    } = req.body;

    if (!clienteId || !tipo || !periodo || !urlArchivo || !nombre) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const tiposValidos = [
      'pyg', 'balance', 'mayor', 'extracto_bancario', 
      'excel_personalizado', 'nominas', 'prestamos', 'otro_financiero'
    ];

    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Create financial document record
    const { data: docFinanciero, error: docError } = await supabaseAdmin
      .from('documentos_financieros')
      .insert({
        cliente_id: clienteId,
        asesor_id: asesorId,
        nombre,
        tipo,
        periodo,
        ejercicio_fiscal: ejercicioFiscal || new Date().getFullYear().toString(),
        url_archivo: urlArchivo,
        tamanio,
        notas,
        estado: 'pendiente'
      })
      .select()
      .single();

    if (docError) {
      throw docError;
    }

    // Trigger AI processing (in background)
    // In a real implementation, this would queue a job to process the document
    // For now, we'll just mark it as needing processing
    processFinancialDocument(docFinanciero.id, tipo);

    // Create audit log
    await supabaseAdmin
      .from('auditoria_financiera')
      .insert({
        usuario_id: asesorId,
        usuario_nombre: usuarioNombre || 'Asesor',
        usuario_rol: 'asesor',
        accion: 'subir_documento_financiero',
        entidad_tipo: 'documento_financiero',
        entidad_id: docFinanciero.id,
        descripcion: `Documento financiero ${tipo} subido: ${nombre} - ${periodo}`,
        cliente_id: clienteId,
        datos_nuevos: {
          tipo,
          periodo,
          nombre
        }
      });

    return res.status(200).json({
      success: true,
      documento: docFinanciero
    });

  } catch (error: any) {
    console.error('Error uploading financial document:', error);
    return res.status(500).json({ 
      error: 'Error uploading financial document',
      details: error.message 
    });
  }
}

/**
 * Process financial document with AI
 * This is a placeholder - in production, this would use actual AI/OCR services
 */
async function processFinancialDocument(documentoId: string, tipo: string) {
  try {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock extracted data based on document type
    let datosExtraidos: any = {};
    let analisisIA: any = {};

    switch (tipo) {
      case 'pyg': // Profit & Loss
        datosExtraidos = {
          ingresos: Math.random() * 500000,
          gastos: Math.random() * 400000,
          resultado: 0,
          detalle_ingresos: {
            ventas: Math.random() * 400000,
            otros_ingresos: Math.random() * 100000
          },
          detalle_gastos: {
            personal: Math.random() * 150000,
            suministros: Math.random() * 50000,
            alquileres: Math.random() * 100000,
            otros: Math.random() * 100000
          }
        };
        datosExtraidos.resultado = datosExtraidos.ingresos - datosExtraidos.gastos;
        
        analisisIA = {
          resumenGeneral: `Resultados operacionales del periodo. Margen neto del ${((datosExtraidos.resultado / datosExtraidos.ingresos) * 100).toFixed(1)}%`,
          indicadoresClave: {
            ingresos: datosExtraidos.ingresos,
            gastos: datosExtraidos.gastos,
            beneficio: datosExtraidos.resultado,
            margen: (datosExtraidos.resultado / datosExtraidos.ingresos) * 100
          },
          alertas: [],
          recomendaciones: []
        };
        
        if (datosExtraidos.resultado < 0) {
          analisisIA.alertas.push({
            tipo: 'warning',
            titulo: 'Resultado negativo',
            descripcion: 'Los gastos superan los ingresos en este periodo'
          });
        }
        break;

      case 'balance': // Balance Sheet
        datosExtraidos = {
          activo_corriente: Math.random() * 300000,
          activo_no_corriente: Math.random() * 500000,
          pasivo_corriente: Math.random() * 200000,
          pasivo_no_corriente: Math.random() * 300000,
          patrimonio_neto: 0
        };
        datosExtraidos.patrimonio_neto = 
          (datosExtraidos.activo_corriente + datosExtraidos.activo_no_corriente) -
          (datosExtraidos.pasivo_corriente + datosExtraidos.pasivo_no_corriente);
        
        const ratioLiquidez = datosExtraidos.activo_corriente / datosExtraidos.pasivo_corriente;
        
        analisisIA = {
          resumenGeneral: `Situación patrimonial. Ratio de liquidez: ${ratioLiquidez.toFixed(2)}`,
          indicadoresClave: {
            activo_total: datosExtraidos.activo_corriente + datosExtraidos.activo_no_corriente,
            pasivo_total: datosExtraidos.pasivo_corriente + datosExtraidos.pasivo_no_corriente,
            patrimonio_neto: datosExtraidos.patrimonio_neto,
            ratio_liquidez: ratioLiquidez
          },
          alertas: [],
          recomendaciones: []
        };
        
        if (ratioLiquidez < 1) {
          analisisIA.alertas.push({
            tipo: 'danger',
            titulo: 'Riesgo de liquidez',
            descripcion: 'El activo corriente no cubre el pasivo corriente'
          });
        }
        break;

      case 'mayor': // General Ledger
        datosExtraidos = {
          cuentas: [],
          saldos_principales: {},
          movimientos_significativos: []
        };
        
        analisisIA = {
          resumenGeneral: 'Mayor contable procesado',
          indicadoresClave: {},
          alertas: [],
          recomendaciones: []
        };
        break;

      default:
        datosExtraidos = {
          procesado: true,
          requiere_revision: true
        };
        analisisIA = {
          resumenGeneral: 'Documento procesado, requiere validación manual',
          indicadoresClave: {},
          alertas: [],
          recomendaciones: []
        };
    }

    // Update document with extracted data
    await supabaseAdmin
      .from('documentos_financieros')
      .update({
        procesado_ia: true,
        datos_extraidos: datosExtraidos,
        analisis_ia: analisisIA,
        estado: 'procesado'
      })
      .eq('id', documentoId);

  } catch (error) {
    console.error('Error processing financial document:', error);
    await supabaseAdmin
      .from('documentos_financieros')
      .update({
        estado: 'error',
        notas: `Error en procesamiento AI: ${error}`
      })
      .eq('id', documentoId);
  }
}

