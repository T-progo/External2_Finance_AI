import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clienteId, question, asesorView } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Get financial data
    let query = supabase
      .from('datos_financieros')
      .select('*, clientes(razon_social, nombre_comercial)');

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data: financialData, error } = await query;

    if (error) throw error;

    // Simple AI response generation based on keywords
    const answer = generateAIResponse(question, financialData || [], asesorView);

    return res.status(200).json({ answer });

  } catch (error) {
    console.error('Error processing AI query:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function generateAIResponse(question: string, data: any[], asesorView: boolean): string {
  const lowerQuestion = question.toLowerCase();

  // Calculate aggregates
  const totalIngresos = data.reduce((sum, d) => sum + (d.ingresos || 0), 0);
  const totalGastos = data.reduce((sum, d) => sum + (d.gastos || 0), 0);
  const totalResultado = data.reduce((sum, d) => sum + (d.resultado || 0), 0);
  const margen = totalIngresos > 0 ? ((totalResultado / totalIngresos) * 100) : 0;

  // Response templates based on keywords
  if (lowerQuestion.includes('factura') || lowerQuestion.includes('ingreso')) {
    return `📊 **Análisis de Facturación:**\n\nIngresos totales: €${totalIngresos.toLocaleString('es-ES')}\n\nEsto representa ${asesorView ? 'la suma de todos tus clientes' : 'tu actividad comercial'}. ${
      margen > 20 
        ? '✅ Tu margen es saludable.' 
        : '⚠️ Considera revisar tu estructura de costes.'
    }`;
  }

  if (lowerQuestion.includes('margen') || lowerQuestion.includes('beneficio')) {
    return `💰 **Análisis de Márgenes:**\n\nResultado neto: €${totalResultado.toLocaleString('es-ES')}\nMargen de beneficio: ${margen.toFixed(2)}%\n\n${
      margen > 25 
        ? '✅ Excelente margen de beneficio. Tu negocio es rentable.' 
        : margen > 15 
        ? '👍 Buen margen de beneficio. Hay espacio para mejorar.' 
        : '⚠️ Margen bajo. Considera optimizar costes o aumentar precios.'
    }`;
  }

  if (lowerQuestion.includes('gasto') || lowerQuestion.includes('coste')) {
    const ratioGastos = totalIngresos > 0 ? ((totalGastos / totalIngresos) * 100) : 0;
    return `💳 **Análisis de Gastos:**\n\nGastos totales: €${totalGastos.toLocaleString('es-ES')}\nRatio gastos/ingresos: ${ratioGastos.toFixed(2)}%\n\n${
      ratioGastos < 70 
        ? '✅ Tus gastos están bien controlados.' 
        : '⚠️ Los gastos son elevados. Revisa oportunidades de optimización.'
    }`;
  }

  if (lowerQuestion.includes('riesgo') || lowerQuestion.includes('liquidez')) {
    const clientesAltoRiesgo = data.filter(d => d.riesgo_ia === 'alto').length;
    return `🚨 **Análisis de Riesgo:**\n\n${asesorView ? `Clientes de alto riesgo: ${clientesAltoRiesgo}\n` : ''}Liquidez actual: ${(totalIngresos / totalGastos).toFixed(2)}x\n\n${
      totalIngresos > totalGastos * 1.5 
        ? '✅ Excelente posición de liquidez.' 
        : '⚠️ Monitorea de cerca tu flujo de caja.'
    }`;
  }

  // Default response
  return `📊 **Resumen Financiero:**\n\n• Ingresos: €${totalIngresos.toLocaleString('es-ES')}\n• Gastos: €${totalGastos.toLocaleString('es-ES')}\n• Resultado: €${totalResultado.toLocaleString('es-ES')}\n• Margen: ${margen.toFixed(2)}%\n\n${
    totalResultado > 0 
      ? '✅ Situación financiera positiva.' 
      : '⚠️ Situación financiera que requiere atención.'
  }\n\n¿Necesitas un análisis más específico? Pregúntame sobre facturación, márgenes, gastos o liquidez.`;
}
