import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface QueryRequest {
  clienteId: string;
  pregunta: string;
  conversacionHistorial?: { role: string; content: string }[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clienteId, pregunta, conversacionHistorial }: QueryRequest = req.body;

  if (!clienteId || !pregunta) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get client's financial data
    const { data: datosFinancieros } = await supabase
      .from('datos_financieros')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get all financial documents for context
    const { data: documentos } = await supabase
      .from('documentos_financieros')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha_subida', { ascending: false });

    // Get recent invoices for VAT and expense queries
    const { data: facturas } = await supabase
      .from('documentos')
      .select('*')
      .eq('cliente_id', clienteId)
      .in('tipo', ['recibida', 'emitida'])
      .order('fecha_subida', { ascending: false })
      .limit(50);

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      // Mock response without OpenAI
      const respuesta = generateMockResponse(
        pregunta,
        datosFinancieros,
        documentos || [],
        facturas || []
      );

      // Save query to database
      await supabase.from('consultas_financieras').insert({
        cliente_id: clienteId,
        pregunta,
        respuesta,
      });

      return res.status(200).json({ respuesta, documentosReferenciados: [] });
    }

    // Build context for OpenAI
    const contexto = buildQueryContext(datosFinancieros, documentos || [], facturas || []);

    const messages: any[] = [
      {
        role: 'system',
        content: `Eres un asistente financiero que ayuda a empresarios españoles a entender sus finanzas. 
Responde SIEMPRE en español con lenguaje claro y sencillo, sin tecnicismos innecesarios.
Si no tienes información suficiente para responder con precisión, dilo claramente y sugiere consultar con el asesor.
Usa los datos financieros proporcionados para dar respuestas precisas y personalizadas.`,
      },
      {
        role: 'user',
        content: `${contexto}\n\n**Pregunta del cliente:** ${pregunta}`,
      },
    ];

    // Add conversation history if provided
    if (conversacionHistorial && conversacionHistorial.length > 0) {
      messages.splice(1, 0, ...conversacionHistorial.slice(-6)); // Last 6 messages for context
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error('OpenAI API error');
    }

    const openaiData = await openaiResponse.json();
    const respuesta = openaiData.choices[0].message.content;

    // Save query to database
    await supabase.from('consultas_financieras').insert({
      cliente_id: clienteId,
      pregunta,
      respuesta,
      documentos_referenciados: documentos?.map(d => d.id) || [],
    });

    return res.status(200).json({
      respuesta,
      documentosReferenciados: documentos?.slice(0, 3).map(d => ({
        id: d.id,
        nombre: d.nombre,
        periodo: d.periodo,
      })) || [],
    });
  } catch (error) {
    console.error('Error processing query:', error);
    return res.status(500).json({ error: 'Error processing query' });
  }
}

function buildQueryContext(datosFinancieros: any, documentos: any[], facturas: any[]): string {
  let contexto = '**Información financiera disponible:**\n\n';

  if (datosFinancieros) {
    contexto += `**Datos del periodo ${datosFinancieros.periodo}:**\n`;
    contexto += `- Ingresos: ${formatCurrency(datosFinancieros.ingresos)}\n`;
    contexto += `- Gastos: ${formatCurrency(datosFinancieros.gastos)}\n`;
    contexto += `- Resultado: ${formatCurrency(datosFinancieros.resultado)}\n`;
    contexto += `- Margen: ${datosFinancieros.margen.toFixed(1)}%\n\n`;
  }

  if (documentos.length > 0) {
    contexto += `**Documentos financieros subidos:** ${documentos.length}\n`;
    documentos.slice(0, 5).forEach(doc => {
      contexto += `- ${doc.nombre} (${doc.periodo})\n`;
      if (doc.analisis_ia?.indicadoresClave) {
        const ind = doc.analisis_ia.indicadoresClave;
        if (ind.ingresos) contexto += `  * Ingresos: ${formatCurrency(ind.ingresos)}\n`;
        if (ind.gastos) contexto += `  * Gastos: ${formatCurrency(ind.gastos)}\n`;
      }
    });
    contexto += '\n';
  }

  if (facturas.length > 0) {
    const facturasRecibidas = facturas.filter(f => f.tipo === 'recibida');
    const facturasEmitidas = facturas.filter(f => f.tipo === 'emitida');

    if (facturasRecibidas.length > 0) {
      const totalIVA = facturasRecibidas.reduce((sum, f) => {
        return sum + (f.datos_ia?.cuotaIVA || 0);
      }, 0);
      contexto += `**Facturas recibidas:** ${facturasRecibidas.length} facturas\n`;
      contexto += `- IVA total aproximado: ${formatCurrency(totalIVA)}\n\n`;
    }

    if (facturasEmitidas.length > 0) {
      contexto += `**Facturas emitidas:** ${facturasEmitidas.length} facturas\n\n`;
    }
  }

  if (!datosFinancieros && documentos.length === 0 && facturas.length === 0) {
    contexto += 'No hay datos financieros disponibles todavía. El asesor necesita subir documentos.\n';
  }

  return contexto;
}

function generateMockResponse(
  pregunta: string,
  datosFinancieros: any,
  documentos: any[],
  facturas: any[]
): string {
  const preguntaLower = pregunta.toLowerCase();

  if (!datosFinancieros && documentos.length === 0) {
    return 'Todavía no tengo datos financieros para analizar. Tu asesor está preparando esta información. Una vez que suba los documentos necesarios, podré responder tus preguntas sobre ingresos, gastos y la situación de tu empresa.';
  }

  if (preguntaLower.includes('ingresos') || preguntaLower.includes('facturación') || preguntaLower.includes('ventas')) {
    if (datosFinancieros?.ingresos) {
      return `En el periodo ${datosFinancieros.periodo}, tus ingresos totales fueron de ${formatCurrency(datosFinancieros.ingresos)}. Esto representa todo el dinero que ha entrado en tu empresa por ventas o servicios prestados. ${datosFinancieros.ingresos > 0 ? '¡Sigue así!' : 'Es importante revisar por qué no hay ingresos registrados.'}`;
    }
    return 'Aún no tengo datos de ingresos para este periodo. Tu asesor está procesando la información.';
  }

  if (preguntaLower.includes('gastos') || preguntaLower.includes('costes') || preguntaLower.includes('costos')) {
    if (datosFinancieros?.gastos) {
      return `Tus gastos totales en el ${datosFinancieros.periodo} ascendieron a ${formatCurrency(datosFinancieros.gastos)}. Estos son todos los desembolsos que ha tenido tu empresa para operar (suministros, nóminas, alquileres, etc.). Para un desglose detallado por categorías, consulta con tu asesor.`;
    }
    return 'Aún no tengo datos de gastos para este periodo. Tu asesor está procesando la información.';
  }

  if (preguntaLower.includes('beneficio') || preguntaLower.includes('resultado') || preguntaLower.includes('ganancia') || preguntaLower.includes('pérdida')) {
    if (datosFinancieros?.resultado !== undefined) {
      if (datosFinancieros.resultado >= 0) {
        return `Tu empresa tuvo un beneficio de ${formatCurrency(datosFinancieros.resultado)} en el ${datosFinancieros.periodo}. Esto significa que después de pagar todos los gastos, te queda esta cantidad. ¡Buen trabajo! Consulta con tu asesor sobre cómo reinvertir o planificar impuestos.`;
      } else {
        return `Tu empresa tuvo una pérdida de ${formatCurrency(Math.abs(datosFinancieros.resultado))} en el ${datosFinancieros.periodo}. Esto significa que los gastos superaron a los ingresos. Es importante revisar con tu asesor cómo mejorar esta situación y qué medidas tomar.`;
      }
    }
    return 'Aún no tengo datos de resultados para este periodo. Tu asesor está procesando la información.';
  }

  if (preguntaLower.includes('iva') || preguntaLower.includes('impuesto')) {
    const facturasRecibidas = facturas.filter((f: any) => f.tipo === 'recibida');
    if (facturasRecibidas.length > 0) {
      const totalIVA = facturasRecibidas.reduce((sum: number, f: any) => {
        return sum + (f.datos_ia?.cuotaIVA || 0);
      }, 0);
      return `Basándome en las ${facturasRecibidas.length} facturas recibidas que tengo registradas, el IVA total aproximado es de ${formatCurrency(totalIVA)}. Para el cálculo exacto del IVA a pagar o devolver, debes consultar con tu asesor, quien considerará también las facturas emitidas y otras variables.`;
    }
    return 'Para conocer el detalle de IVA a pagar de este trimestre, tu asesor puede proporcionarte un desglose exacto basado en tus facturas emitidas y recibidas. Normalmente se paga antes del día 20 del mes siguiente al cierre del trimestre.';
  }

  if (preguntaLower.includes('comparar') || preguntaLower.includes('comparación') || preguntaLower.includes('vs') || preguntaLower.includes('anterior')) {
    return 'Para comparativas detalladas entre periodos, necesito que tu asesor suba documentos de múltiples periodos. Una vez que tenga información histórica, podré mostrarte cómo ha evolucionado tu negocio y qué tendencias hay.';
  }

  // Default response
  return `Entiendo tu pregunta sobre "${pregunta}". ${datosFinancieros ? `Tengo información del periodo ${datosFinancieros.periodo}.` : 'Aún estoy esperando que tu asesor suba más documentos.'} Para una respuesta más precisa y personalizada sobre este tema específico, te recomiendo que consultes directamente con tu asesor, quien conoce todos los detalles de tu situación.`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

