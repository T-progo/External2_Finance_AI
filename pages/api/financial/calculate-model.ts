import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * API endpoint to calculate comprehensive financial model for a client
 * 
 * Combines data from:
 * - Invoices (AI Record Book)
 * - P&L statements
 * - Balance sheets
 * - General ledger
 * - Other financial documents
 * 
 * Generates financial ratios, trends, and AI commentary
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clienteId, periodo, ejercicioFiscal } = req.body;

    if (!clienteId || !periodo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get all financial documents for this period
    const { data: docsFinancieros } = await supabaseAdmin
      .from('documentos_financieros')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('periodo', periodo)
      .eq('procesado_ia', true);

    // Get invoice-level financial data
    const { data: datosFacturas } = await supabaseAdmin
      .from('datos_financieros')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('periodo', periodo);

    // Initialize financial model
    const modelo: any = {
      cliente_id: clienteId,
      periodo,
      ejercicio_fiscal: ejercicioFiscal || new Date().getFullYear().toString(),
      documentos_fuente: (docsFinancieros || []).map(d => d.id),
      fecha_calculo: new Date().toISOString()
    };

    // Extract data from different document types
    let pyg: any = null;
    let balance: any = null;
    let mayor: any = null;

    (docsFinancieros || []).forEach(doc => {
      const datos = doc.datos_extraidos;
      
      switch (doc.tipo) {
        case 'pyg':
          pyg = datos;
          break;
        case 'balance':
          balance = datos;
          break;
        case 'mayor':
          mayor = datos;
          break;
      }
    });

    // Build P&L section
    if (pyg) {
      modelo.ingresos_operacionales = pyg.ingresos || 0;
      modelo.gastos_operacionales = pyg.gastos || 0;
      modelo.resultado_operacional = pyg.resultado || 0;
      modelo.resultado_neto = pyg.resultado || 0;
      modelo.gastos_por_categoria = pyg.detalle_gastos || {};
      modelo.ingresos_por_linea = pyg.detalle_ingresos || {};
    } else if (datosFacturas && datosFacturas.length > 0) {
      // Fallback to invoice-level data
      const latest = datosFacturas[0];
      modelo.ingresos_operacionales = parseFloat(latest.ingresos) || 0;
      modelo.gastos_operacionales = parseFloat(latest.gastos) || 0;
      modelo.resultado_operacional = parseFloat(latest.resultado) || 0;
      modelo.resultado_neto = parseFloat(latest.resultado) || 0;
    }

    // Build Balance Sheet section
    if (balance) {
      modelo.activo_corriente = balance.activo_corriente || 0;
      modelo.activo_no_corriente = balance.activo_no_corriente || 0;
      modelo.total_activo = balance.activo_corriente + balance.activo_no_corriente;
      modelo.pasivo_corriente = balance.pasivo_corriente || 0;
      modelo.pasivo_no_corriente = balance.pasivo_no_corriente || 0;
      modelo.patrimonio_neto = balance.patrimonio_neto || 0;
      modelo.total_pasivo_patrimonio = modelo.pasivo_corriente + modelo.pasivo_no_corriente + modelo.patrimonio_neto;
    }

    // Calculate Financial Ratios
    if (modelo.activo_corriente && modelo.pasivo_corriente) {
      modelo.ratio_liquidez = modelo.activo_corriente / modelo.pasivo_corriente;
    }
    
    if (modelo.total_activo && modelo.pasivo_corriente && modelo.pasivo_no_corriente) {
      const totalPasivo = modelo.pasivo_corriente + modelo.pasivo_no_corriente;
      modelo.ratio_solvencia = modelo.patrimonio_neto / totalPasivo;
      modelo.ratio_endeudamiento = totalPasivo / modelo.total_activo;
    }

    if (modelo.ingresos_operacionales) {
      modelo.margen_bruto = (modelo.resultado_operacional / modelo.ingresos_operacionales) * 100;
      modelo.margen_operacional = (modelo.resultado_operacional / modelo.ingresos_operacionales) * 100;
      modelo.margen_neto = (modelo.resultado_neto / modelo.ingresos_operacionales) * 100;
    }

    if (modelo.total_activo && modelo.resultado_neto) {
      modelo.roi = (modelo.resultado_neto / modelo.total_activo) * 100;
    }

    if (modelo.patrimonio_neto && modelo.resultado_neto) {
      modelo.roe = (modelo.resultado_neto / modelo.patrimonio_neto) * 100;
    }

    // Generate AI Analysis
    const alertas = [];
    const recomendaciones = [];
    
    // Liquidity alerts
    if (modelo.ratio_liquidez < 1) {
      alertas.push({
        tipo: 'danger',
        titulo: 'Riesgo de liquidez crítico',
        descripcion: `Ratio de liquidez ${modelo.ratio_liquidez.toFixed(2)}. El activo corriente no cubre las obligaciones a corto plazo.`,
        metrica: 'liquidez',
        valor: modelo.ratio_liquidez
      });
      recomendaciones.push('Revisar flujo de caja y considerar renegociación de plazos de pago con proveedores');
    } else if (modelo.ratio_liquidez < 1.5) {
      alertas.push({
        tipo: 'warning',
        titulo: 'Liquidez ajustada',
        descripcion: `Ratio de liquidez ${modelo.ratio_liquidez.toFixed(2)}. Situación de liquidez justa pero manejable.`,
        metrica: 'liquidez',
        valor: modelo.ratio_liquidez
      });
    }

    // Profitability alerts
    if (modelo.margen_neto < 0) {
      alertas.push({
        tipo: 'danger',
        titulo: 'Resultado negativo',
        descripcion: `Margen neto ${modelo.margen_neto.toFixed(1)}%. Los gastos superan los ingresos.`,
        metrica: 'margen',
        valor: modelo.margen_neto
      });
      recomendaciones.push('Análisis urgente de estructura de costes y revisión de precios');
    } else if (modelo.margen_neto < 5) {
      alertas.push({
        tipo: 'warning',
        titulo: 'Margen bajo',
        descripcion: `Margen neto ${modelo.margen_neto.toFixed(1)}%. Rentabilidad reducida.`,
        metrica: 'margen',
        valor: modelo.margen_neto
      });
      recomendaciones.push('Evaluar oportunidades de mejora de eficiencia operativa');
    } else {
      alertas.push({
        tipo: 'info',
        titulo: 'Rentabilidad saludable',
        descripcion: `Margen neto ${modelo.margen_neto.toFixed(1)}%. Situación financiera positiva.`,
        metrica: 'margen',
        valor: modelo.margen_neto
      });
    }

    // Solvency alerts
    if (modelo.ratio_endeudamiento > 0.7) {
      alertas.push({
        tipo: 'warning',
        titulo: 'Endeudamiento elevado',
        descripcion: `Ratio de endeudamiento ${(modelo.ratio_endeudamiento * 100).toFixed(1)}%. Alta dependencia de financiación externa.`,
        metrica: 'endeudamiento',
        valor: modelo.ratio_endeudamiento
      });
    }

    // Generate natural language commentary
    const comentarioIA = generarComentarioIA(modelo, alertas);
    
    // Determine risk level
    const nivelRiesgo = determinarNivelRiesgo(alertas);

    modelo.alertas_financieras = alertas;
    modelo.recomendaciones_ia = recomendaciones;
    modelo.comentario_ia = comentarioIA;
    modelo.nivel_riesgo = nivelRiesgo;
    modelo.factores_riesgo = alertas
      .filter(a => a.tipo === 'danger' || a.tipo === 'warning')
      .map(a => a.titulo);

    // Save or update financial model
    const { data: modeloGuardado, error: modeloError } = await supabaseAdmin
      .from('modelos_financieros_cliente')
      .upsert(modelo, {
        onConflict: 'cliente_id,periodo'
      })
      .select()
      .single();

    if (modeloError) {
      throw modeloError;
    }

    // Update datos_financieros reference
    if (datosFacturas && datosFacturas.length > 0) {
      await supabaseAdmin
        .from('datos_financieros')
        .update({
          modelo_financiero_id: modeloGuardado.id,
          riesgo_ia: nivelRiesgo
        })
        .eq('cliente_id', clienteId)
        .eq('periodo', periodo);
    }

    return res.status(200).json({
      success: true,
      modelo: modeloGuardado
    });

  } catch (error: any) {
    console.error('Error calculating financial model:', error);
    return res.status(500).json({ 
      error: 'Error calculating financial model',
      details: error.message 
    });
  }
}

function generarComentarioIA(modelo: any, alertas: any[]): string {
  const partes = [];
  
  // Opening
  if (modelo.resultado_neto > 0) {
    partes.push(`El periodo ${modelo.periodo} muestra resultados positivos con un beneficio neto de ${modelo.resultado_neto.toFixed(0)}€.`);
  } else {
    partes.push(`El periodo ${modelo.periodo} arroja pérdidas de ${Math.abs(modelo.resultado_neto).toFixed(0)}€.`);
  }

  // Margins
  if (modelo.margen_neto) {
    partes.push(`El margen neto alcanza el ${modelo.margen_neto.toFixed(1)}%, ${modelo.margen_neto > 10 ? 'indicando buena rentabilidad' : modelo.margen_neto > 5 ? 'en niveles aceptables' : 'requiriendo mejoras'}.`);
  }

  // Liquidity
  if (modelo.ratio_liquidez) {
    if (modelo.ratio_liquidez >= 1.5) {
      partes.push(`La liquidez es sólida con un ratio de ${modelo.ratio_liquidez.toFixed(2)}.`);
    } else if (modelo.ratio_liquidez >= 1) {
      partes.push(`La liquidez es justa con un ratio de ${modelo.ratio_liquidez.toFixed(2)}, se recomienda mantener vigilancia sobre el flujo de caja.`);
    } else {
      partes.push(`ALERTA: La liquidez es crítica con un ratio de ${modelo.ratio_liquidez.toFixed(2)}, es necesario tomar medidas inmediatas.`);
    }
  }

  // Main alerts
  const alertasCriticas = alertas.filter(a => a.tipo === 'danger');
  if (alertasCriticas.length > 0) {
    partes.push(`Puntos de atención: ${alertasCriticas.map(a => a.titulo.toLowerCase()).join(', ')}.`);
  }

  return partes.join(' ');
}

function determinarNivelRiesgo(alertas: any[]): 'bajo' | 'medio' | 'alto' {
  const criticas = alertas.filter(a => a.tipo === 'danger').length;
  const warnings = alertas.filter(a => a.tipo === 'warning').length;

  if (criticas >= 2) return 'alto';
  if (criticas >= 1 || warnings >= 2) return 'medio';
  return 'bajo';
}

