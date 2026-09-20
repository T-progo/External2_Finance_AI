import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AnalyzeRequest {
  documentoId: string;
  clienteId: string;
  contenidoTexto?: string; // OCR text if already extracted
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { documentoId, clienteId, contenidoTexto }: AnalyzeRequest = req.body;

  if (!documentoId || !clienteId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get document details
    const { data: documento, error: docError } = await supabase
      .from('documentos_financieros')
      .select('*')
      .eq('id', documentoId)
      .single();

    if (docError || !documento) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get all financial documents for this client for comparative analysis
    const { data: todosDocumentos } = await supabase
      .from('documentos_financieros')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha_subida', { ascending: false });

    // Call OpenAI to analyze the document
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      // If no OpenAI key, return mock analysis
      const mockAnalysis = generateMockAnalysis(documento, todosDocumentos || []);
      
      // Update document with analysis
      await supabase
        .from('documentos_financieros')
        .update({
          procesado_ia: true,
          analisis_ia: mockAnalysis,
        })
        .eq('id', documentoId);

      return res.status(200).json({ analisis: mockAnalysis });
    }

    // Real OpenAI analysis
    const prompt = buildAnalysisPrompt(documento, contenidoTexto, todosDocumentos || []);

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
            content: 'Eres un asesor financiero experto que analiza informes financieros de empresas españolas. Proporciona análisis claros en lenguaje sencillo, sin tecnicismos innecesarios. Siempre responde en español.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error('OpenAI API error');
    }

    const openaiData = await openaiResponse.json();
    const analisisTexto = openaiData.choices[0].message.content;

    // Parse the AI response into structured format
    const analisis = parseAnalysisResponse(analisisTexto, documento);

    // Update document with analysis
    await supabase
      .from('documentos_financieros')
      .update({
        procesado_ia: true,
        analisis_ia: analisis,
      })
      .eq('id', documentoId);

    // Update datos_financieros if we have key indicators
    if (analisis.indicadoresClave.ingresos || analisis.indicadoresClave.gastos) {
      const resultado = (analisis.indicadoresClave.ingresos || 0) - (analisis.indicadoresClave.gastos || 0);
      const margen = analisis.indicadoresClave.ingresos 
        ? ((resultado / analisis.indicadoresClave.ingresos) * 100)
        : 0;

      await supabase.from('datos_financieros').upsert({
        cliente_id: clienteId,
        periodo: documento.periodo,
        ingresos: analisis.indicadoresClave.ingresos || 0,
        gastos: analisis.indicadoresClave.gastos || 0,
        resultado: resultado,
        margen: margen,
        riesgo_ia: determineRisk(margen, resultado),
        ultimo_cierre: new Date().toISOString(),
      });
    }

    return res.status(200).json({ analisis });
  } catch (error) {
    console.error('Error analyzing document:', error);
    return res.status(500).json({ error: 'Error processing analysis' });
  }
}

function buildAnalysisPrompt(documento: any, contenidoTexto: string | undefined, historico: any[]): string {
  return `
Analiza el siguiente documento financiero y proporciona un análisis estructurado:

**Tipo de documento:** ${documento.tipo}
**Periodo:** ${documento.periodo}
**Nombre:** ${documento.nombre}

${contenidoTexto ? `**Contenido extraído:**\n${contenidoTexto}` : '**Nota:** El contenido del documento debe inferirse del tipo y periodo.'}

${historico.length > 1 ? `**Documentos previos disponibles:** ${historico.length - 1} documentos para comparación` : ''}

Por favor, proporciona un análisis en el siguiente formato JSON:

{
  "resumenGeneral": "Resumen en lenguaje claro de la situación financiera (2-3 frases)",
  "indicadoresClave": {
    "ingresos": número o null,
    "gastos": número o null,
    "beneficio": número o null,
    "margen": porcentaje o null
  },
  "alertas": [
    {
      "tipo": "info|warning|danger",
      "titulo": "Título corto",
      "descripcion": "Explicación clara para el cliente"
    }
  ],
  "recomendaciones": [
    "Recomendación práctica 1",
    "Recomendación práctica 2"
  ],
  "categoriaGastos": [
    {
      "categoria": "Nombre categoría",
      "importe": número,
      "porcentaje": porcentaje del total
    }
  ]
}

**Importante:** Usa lenguaje sencillo, evita términos técnicos complejos. El cliente es un empresario sin formación contable.
`;
}

function parseAnalysisResponse(texto: string, documento: any): any {
  try {
    // Try to extract JSON from the response
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing AI response as JSON:', e);
  }

  // Fallback: create structured response from text
  return {
    resumenGeneral: texto.substring(0, 300),
    indicadoresClave: {},
    alertas: [],
    recomendaciones: [],
  };
}

function generateMockAnalysis(documento: any, historico: any[]): any {
  const tipos: any = {
    pyg: 'Cuenta de Pérdidas y Ganancias',
    balance: 'Balance de Situación',
    mayor: 'Libro Mayor',
    extracto: 'Extracto Bancario',
    excel: 'Archivo Excel con datos financieros',
  };

  const tipoNombre = tipos[documento.tipo] || 'Documento financiero';

  return {
    resumenGeneral: `He analizado tu ${tipoNombre} del periodo ${documento.periodo}. Los datos muestran la actividad económica de tu empresa en este periodo. Para un análisis más preciso, conecta la clave de OpenAI en la configuración.`,
    indicadoresClave: {
      ingresos: null,
      gastos: null,
      beneficio: null,
      margen: null,
    },
    alertas: [
      {
        tipo: 'info',
        titulo: 'Análisis en modo demo',
        descripcion: 'Este es un análisis simulado. Configura tu clave de OpenAI para obtener análisis reales basados en IA.',
      },
    ],
    recomendaciones: [
      'Revisa este documento con tu asesor para un análisis detallado',
      'Sube más documentos del mismo periodo para una visión completa',
    ],
    categoriaGastos: [],
  };
}

function determineRisk(margen: number, resultado: number): 'bajo' | 'medio' | 'alto' {
  if (resultado < 0 || margen < 0) return 'alto';
  if (margen < 5) return 'medio';
  return 'bajo';
}

