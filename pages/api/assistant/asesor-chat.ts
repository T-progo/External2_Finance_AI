import type { NextApiRequest, NextApiResponse } from 'next';

interface AsesorChatRequest {
  asesorId: string;
  conversacionId: string;
  mensaje: string;
  historial?: { rol: string; contenido: string }[];
}

interface AsesorChatResponse {
  success: boolean;
  respuesta?: string;
  fuentes?: string[];
  error?: string;
}

/**
 * Asesor Assistant Chat API with OpenAI
 * Handles intelligent responses for advisors
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AsesorChatResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { asesorId, conversacionId, mensaje, historial } = req.body as AsesorChatRequest;

    if (!asesorId || !conversacionId || !mensaje) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      // Fallback to simple response if no OpenAI key
      const respuestaSimple = generarRespuestaSimple(mensaje);
      return res.status(200).json({
        success: true,
        respuesta: respuestaSimple,
        fuentes: ['Plan General Contable', 'Normativa fiscal vigente'],
      });
    }

    // Build conversation context for OpenAI
    const messages: any[] = [
      {
        role: 'system',
        content: `Eres E2, un asistente inteligente especializado en contabilidad, fiscalidad y gestión empresarial para asesores fiscales en España. 

Tus capacidades incluyen:
- Consultas sobre normativa fiscal española actual
- Interpretación del Plan General Contable
- Asesoramiento sobre contabilización de operaciones
- Información sobre plazos fiscales y obligaciones tributarias
- Mejores prácticas en gestión de clientes
- Integración con sistemas ERP
- Workflow de procesamiento de documentos con IA

Características de tus respuestas:
- SIEMPRE responde en español
- Usa un lenguaje técnico pero claro
- Proporciona respuestas detalladas y completas
- Incluye ejemplos prácticos cuando sea relevante
- Si no estás seguro, indícalo claramente
- Cita la normativa aplicable cuando sea relevante
- Estructura tus respuestas con bullets o numeración cuando sea apropiado`,
      },
    ];

    // Add conversation history
    if (historial && historial.length > 0) {
      historial.slice(-6).forEach((msg) => {
        messages.push({
          role: msg.rol === 'usuario' ? 'user' : 'assistant',
          content: msg.contenido,
        });
      });
    }

    // Add current question
    messages.push({
      role: 'user',
      content: mensaje,
    });

    // Call OpenAI API
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
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error('Error al comunicarse con OpenAI');
    }

    const openaiData = await openaiResponse.json();
    const respuesta = openaiData.choices[0].message.content;

    return res.status(200).json({
      success: true,
      respuesta,
      fuentes: ['Plan General Contable', 'Normativa fiscal vigente', 'BOE'],
    });
  } catch (error: any) {
    console.error('Asesor assistant chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor',
    });
  }
}

/**
 * Simple fallback response when OpenAI is not available
 */
function generarRespuestaSimple(pregunta: string): string {
  const preguntaLower = pregunta.toLowerCase();
  
  if (preguntaLower.includes('intracomunitaria')) {
    return 'Para contabilizar una factura intracomunitaria:\n\n1. En el debe: Cuenta 600 (Compras) por el importe\n2. En el debe: Cuenta 472 (IVA soportado) por el IVA\n3. En el haber: Cuenta 477 (IVA repercutido) por el mismo IVA\n4. En el haber: Cuenta 400 (Proveedores) por el total\n\nRecuerda que el IVA se autoliquida.';
  }
  if (preguntaLower.includes('iva reducido') || preguntaLower.includes('superreducido')) {
    return 'IVA General: 21% - Mayoría de bienes y servicios\nIVA Reducido: 10% - Alimentos básicos, transporte, hostelería\nIVA Superreducido: 4% - Productos de primera necesidad (pan, leche, libros, medicamentos)\n\nCada tipo tiene aplicaciones específicas según la normativa vigente.';
  }
  if (preguntaLower.includes('plazo') || preguntaLower.includes('fecha')) {
    return 'Plazos fiscales principales:\n\n• IVA mensual: Día 20\n• IRPF trimestral: Día 20\n• Retenciones (Modelo 111): Día 20\n• IVA trimestral: Día 20 (siguiente mes)\n\nTe recomiendo revisar el calendario fiscal completo en el módulo correspondiente.';
  }
  
  return 'Estoy aquí para ayudarte con consultas contables, fiscales y normativas. Puedo asistirte con contabilización, interpretación de normativa, plazos fiscales y gestión de tus clientes. ¿En qué puedo ayudarte específicamente?';
}

