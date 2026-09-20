import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatRequest {
  clienteId: string;
  conversacionId?: string;
  mensaje: string;
  userId: string;
}

interface ChatResponse {
  success: boolean;
  conversacionId?: string;
  respuesta?: string;
  metadatos?: any;
  acciones?: any[];
  error?: string;
}

/**
 * E2 Assistant Chat API
 * Handles intelligent responses with context from client data
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { clienteId, conversacionId, mensaje, userId } = req.body as ChatRequest;

    if (!clienteId || !mensaje || !userId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Create or get conversation
    let conversationId = conversacionId;
    if (!conversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('conversaciones_asistente')
        .insert({
          cliente_id: clienteId,
          titulo: mensaje.substring(0, 50) + (mensaje.length > 50 ? '...' : ''),
        })
        .select()
        .single();

      if (convError) throw convError;
      conversationId = newConv.id;
    }

    // Save user message
    await supabase.from('mensajes_asistente').insert({
      conversacion_id: conversationId,
      rol: 'usuario',
      contenido: mensaje,
    });

    // Update conversation last activity
    await supabase
      .from('conversaciones_asistente')
      .update({ fecha_ultima_actividad: new Date().toISOString() })
      .eq('id', conversationId);

    // Fetch context data for intelligent response
    const contextData = await fetchClientContext(clienteId);

    // Generate intelligent response
    const { respuesta, metadatos, acciones } = await generateIntelligentResponse(
      mensaje,
      contextData,
      clienteId
    );

    // Save assistant response
    await supabase.from('mensajes_asistente').insert({
      conversacion_id: conversationId,
      rol: 'asistente',
      contenido: respuesta,
      metadatos: metadatos || {},
    });

    return res.status(200).json({
      success: true,
      conversacionId: conversationId,
      respuesta,
      metadatos,
      acciones,
    });
  } catch (error: any) {
    console.error('Assistant chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

/**
 * Fetch all relevant context data for the client
 */
async function fetchClientContext(clienteId: string) {
  const [documentos, incidencias, datosFinancieros, recordatorios] = await Promise.all([
    // Documents count
    supabase
      .from('documentos')
      .select('id, estado, tipo, fecha_subida', { count: 'exact' })
      .eq('cliente_id', clienteId),
    
    // Open incidents
    supabase
      .from('incidencias')
      .select('id, estado, fecha_creacion')
      .eq('cliente_id', clienteId)
      .in('estado', ['nueva', 'en_revision']),
    
    // Financial data
    supabase
      .from('datos_financieros')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('periodo', { ascending: false })
      .limit(12),
    
    // Upcoming tax reminders
    supabase
      .from('recordatorios_fiscales')
      .select(`
        *,
        calendario_fiscal:calendario_fiscal_id (
          modelo,
          descripcion,
          periodo
        )
      `)
      .eq('cliente_id', clienteId)
      .eq('completado', false)
      .gte('fecha_vencimiento', new Date().toISOString())
      .order('fecha_vencimiento', { ascending: true })
      .limit(5),
  ]);

  return {
    documentos: documentos.data || [],
    documentosCount: documentos.count || 0,
    incidencias: incidencias.data || [],
    datosFinancieros: datosFinancieros.data || [],
    recordatorios: recordatorios.data || [],
  };
}

/**
 * Generate intelligent response based on query and context
 */
async function generateIntelligentResponse(
  mensaje: string,
  context: any,
  clienteId: string
): Promise<{ respuesta: string; metadatos?: any; acciones?: any[] }> {
  const mensajeLower = mensaje.toLowerCase();
  const acciones: any[] = [];

  // DOCUMENTARY QUERIES
  if (
    mensajeLower.includes('factura') ||
    mensajeLower.includes('documento') ||
    mensajeLower.includes('subido') ||
    mensajeLower.includes('pendiente')
  ) {
    const pendientes = context.documentos.filter((d: any) => 
      d.estado === 'pendiente' || d.estado === 'incidencia'
    ).length;
    const procesados = context.documentos.filter((d: any) => 
      d.estado === 'procesado_ia' || d.estado === 'validado' || d.estado === 'contabilizado'
    ).length;

    const respuesta = `📄 **Estado de tus documentos:**

• Total de documentos subidos: **${context.documentosCount}**
• Documentos procesados: **${procesados}**
• Documentos pendientes: **${pendientes}**

${pendientes > 0 
  ? '⚠️ Tienes documentos pendientes de procesamiento. Tu asesor los revisará pronto.' 
  : '✅ Todos tus documentos están procesados.'
}

¿Necesitas subir más documentos o revisar alguno en particular?`;

    acciones.push({
      tipo: 'navegacion',
      etiqueta: '📂 Ver mis documentos',
      url: '/cliente/documentos',
    });

    return { respuesta, acciones };
  }

  // INCIDENTS QUERIES
  if (
    mensajeLower.includes('incidencia') ||
    mensajeLower.includes('problema') ||
    mensajeLower.includes('consulta asesor') ||
    mensajeLower.includes('pregunta asesor')
  ) {
    const incidenciasAbiertas = context.incidencias.length;

    const respuesta = `💬 **Estado de tus incidencias:**

${incidenciasAbiertas > 0 
  ? `• Tienes **${incidenciasAbiertas}** incidencia(s) abierta(s) con tu asesor.
• Tu asesor está revisándolas y te responderá pronto.` 
  : '• No tienes incidencias abiertas actualmente.'}

${incidenciasAbiertas === 0 
  ? '¿Quieres crear una nueva consulta para tu asesor?' 
  : '¿Quieres revisar tus incidencias abiertas?'}`;

    acciones.push({
      tipo: 'navegacion',
      etiqueta: incidenciasAbiertas > 0 ? '💬 Ver incidencias' : '➕ Nueva consulta a asesor',
      url: '/cliente/incidencias',
    });

    return { respuesta, acciones };
  }

  // TAX/FISCAL QUERIES
  if (
    mensajeLower.includes('vencimiento') ||
    mensajeLower.includes('iva') ||
    mensajeLower.includes('impuesto') ||
    mensajeLower.includes('modelo') ||
    mensajeLower.includes('plazo') ||
    mensajeLower.includes('pagar')
  ) {
    const proximosVencimientos = context.recordatorios.slice(0, 3);
    
    let respuesta = '📅 **Próximos vencimientos fiscales:**\n\n';
    
    if (proximosVencimientos.length > 0) {
      proximosVencimientos.forEach((recordatorio: any, idx: number) => {
        const fecha = new Date(recordatorio.fecha_vencimiento);
        const diasHasta = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        respuesta += `${idx + 1}. **Modelo ${recordatorio.calendario_fiscal.modelo}** - ${recordatorio.calendario_fiscal.descripcion}\n`;
        respuesta += `   📆 Vencimiento: ${fecha.toLocaleDateString('es-ES')} (en ${diasHasta} días)\n\n`;
      });
      
      if (proximosVencimientos.some((r: any) => {
        const dias = Math.ceil((new Date(r.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return dias <= 7;
      })) {
        respuesta += '⚠️ **Atención:** Tienes vencimientos próximos en los siguientes 7 días.\n\n';
      }
    } else {
      respuesta += '✅ No tienes vencimientos fiscales pendientes en los próximos días.\n\n';
    }

    respuesta += 'Tu asesor te avisará con tiempo de cualquier obligación fiscal.';

    acciones.push({
      tipo: 'navegacion',
      etiqueta: '📅 Ver calendario fiscal completo',
      url: '/cliente/calendario-fiscal',
    });

    return { respuesta, acciones };
  }

  // FINANCIAL QUERIES
  if (
    mensajeLower.includes('financier') ||
    mensajeLower.includes('ingreso') ||
    mensajeLower.includes('gasto') ||
    mensajeLower.includes('beneficio') ||
    mensajeLower.includes('pérdida') ||
    mensajeLower.includes('situación económica')
  ) {
    if (context.datosFinancieros.length === 0) {
      const respuesta = `📊 **Panel Financiero:**

Aún no tienes datos financieros procesados en tu cuenta. 

Una vez que tu asesor procese tus documentos contables, podrás ver aquí:
• Ingresos y gastos mensuales
• Evolución de tu negocio
• Análisis de rentabilidad
• Proyecciones futuras

¿Necesitas ayuda subiendo tus primeros documentos?`;

      return { respuesta };
    }

    const ultimoPeriodo = context.datosFinancieros[0];
    const ingresos = parseFloat(ultimoPeriodo.ingresos);
    const gastos = parseFloat(ultimoPeriodo.gastos);
    const resultado = parseFloat(ultimoPeriodo.resultado);
    const margen = ultimoPeriodo.margen || 0;

    const respuesta = `📊 **Tu situación financiera actual** (${ultimoPeriodo.periodo}):

💰 **Ingresos:** ${ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
💸 **Gastos:** ${gastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
${resultado >= 0 ? '✅' : '⚠️'} **Resultado:** ${resultado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
📈 **Margen:** ${margen}%

${resultado >= 0 
  ? '¡Tu negocio está generando beneficios! 🎉' 
  : '⚠️ Estás teniendo pérdidas. Habla con tu asesor para optimizar gastos.'
}

Para ver más detalles y gráficos, visita tu Panel Financiero.`;

    acciones.push({
      tipo: 'navegacion',
      etiqueta: '📊 Ver Panel Financiero completo',
      url: '/cliente/panel-financiero',
    });

    return { respuesta, acciones };
  }

  // KNOWLEDGE BASE SEARCH
  const knowledgeResponse = await searchKnowledgeBase(mensaje);
  if (knowledgeResponse) {
    return { respuesta: knowledgeResponse };
  }

  // Try OpenAI for general queries
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    try {
      const aiResponse = await generateOpenAIResponse(mensaje, context);
      if (aiResponse) {
        return { respuesta: aiResponse };
      }
    } catch (error) {
      console.error('OpenAI error:', error);
      // Fall through to default response
    }
  }

  // DEFAULT RESPONSE - Escalate to advisor
  const respuesta = `Entiendo tu consulta sobre: "${mensaje}"

Para darte una respuesta precisa y personalizada sobre tu situación específica, te recomiendo que consultes con tu asesor.

¿Quieres que derive esta consulta a tu asesor? Él podrá revisar tu caso en detalle y darte la mejor respuesta.`;

  acciones.push({
    tipo: 'derivar',
    etiqueta: '👤 Derivar a mi asesor',
  });

  return { respuesta, acciones };
}

/**
 * Generate response using OpenAI for general queries
 */
async function generateOpenAIResponse(mensaje: string, context: any): Promise<string | null> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) return null;

  try {
    const systemPrompt = `Eres E2, un asistente financiero y contable para empresarios en España. 

Tu objetivo es ayudar a los empresarios a entender conceptos de contabilidad, fiscalidad y gestión empresarial de forma clara y sencilla.

Características de tus respuestas:
- SIEMPRE responde en español
- Usa lenguaje simple y evita tecnicismos innecesarios
- Si usas términos técnicos, explícalos
- Proporciona respuestas prácticas y útiles
- Si la pregunta es muy específica o compleja, sugiere consultar con el asesor
- Sé amable y cercano

Sobre el negocio del cliente:
- Tiene ${context.documentosCount} documentos en el sistema
- ${context.incidencias.length} incidencias abiertas
- ${context.recordatorios.length} recordatorios fiscales pendientes

Responde solo sobre temas relacionados con:
- Conceptos básicos de contabilidad y fiscalidad española
- Obligaciones fiscales generales
- Interpretación de documentos contables
- Gestión empresarial básica

Si la pregunta no está relacionada con estos temas o es demasiado personal/específica, sugiere amablemente derivar al asesor.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: mensaje,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!openaiResponse.ok) {
      return null;
    }

    const openaiData = await openaiResponse.json();
    return openaiData.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return null;
  }
}

/**
 * Search knowledge base for relevant answers
 */
async function searchKnowledgeBase(query: string): Promise<string | null> {
  const queryLower = query.toLowerCase();
  
  // Simple keyword matching (in production, use vector search or ML)
  const { data: knowledge } = await supabase
    .from('base_conocimiento_e2')
    .select('*')
    .order('prioridad', { ascending: false });

  if (!knowledge || knowledge.length === 0) return null;

  // Find best match based on keywords
  let bestMatch = null;
  let maxScore = 0;

  for (const entry of knowledge) {
    let score = 0;
    const keywords = entry.palabras_clave || [];
    
    keywords.forEach((keyword: string) => {
      if (queryLower.includes(keyword.toLowerCase())) {
        score += 1;
      }
    });

    // Check if query contains key words from question
    const questionWords = entry.pregunta.toLowerCase().split(' ');
    questionWords.forEach((word: string) => {
      if (word.length > 4 && queryLower.includes(word)) {
        score += 0.5;
      }
    });

    if (score > maxScore && score >= 1) {
      maxScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    let respuesta = bestMatch.respuesta;
    if (bestMatch.fuente_oficial) {
      respuesta += `\n\n📚 **Fuente:** ${bestMatch.fuente_oficial}`;
    }
    return respuesta;
  }

  return null;
}

