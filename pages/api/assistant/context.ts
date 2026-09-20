import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

interface ContextResponse {
  success: boolean;
  data?: {
    documentosStats: {
      total: number;
      pendientes: number;
      procesados: number;
      porTipo: any;
    };
    incidenciasStats: {
      abiertas: number;
      enRevision: number;
      resueltas: number;
    };
    proximosVencimientos: any[];
    datosFinancierosRecientes: any[];
    sugerencias: string[];
  };
  error?: string;
}

/**
 * Fetch context data for assistant quick suggestions
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ContextResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { clienteId } = req.query;

    if (!clienteId || typeof clienteId !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing clienteId' });
    }

    // Fetch all context data in parallel
    const [
      documentosResult,
      incidenciasResult,
      recordatoriosResult,
      financialResult,
    ] = await Promise.all([
      supabase
        .from('documentos')
        .select('id, estado, tipo, fecha_subida')
        .eq('cliente_id', clienteId),
      
      supabase
        .from('incidencias')
        .select('id, estado, fecha_creacion')
        .eq('cliente_id', clienteId),
      
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
      
      supabase
        .from('datos_financieros')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('periodo', { ascending: false })
        .limit(3),
    ]);

    const documentos = documentosResult.data || [];
    const incidencias = incidenciasResult.data || [];
    const recordatorios = recordatoriosResult.data || [];
    const datosFinancieros = financialResult.data || [];

    // Calculate document stats
    const documentosStats = {
      total: documentos.length,
      pendientes: documentos.filter(d => d.estado === 'pendiente' || d.estado === 'incidencia').length,
      procesados: documentos.filter(d => 
        d.estado === 'procesado_ia' || d.estado === 'validado' || d.estado === 'contabilizado'
      ).length,
      porTipo: documentos.reduce((acc: any, doc: any) => {
        acc[doc.tipo] = (acc[doc.tipo] || 0) + 1;
        return acc;
      }, {}),
    };

    // Calculate incident stats
    const incidenciasStats = {
      abiertas: incidencias.filter(i => i.estado === 'nueva').length,
      enRevision: incidencias.filter(i => i.estado === 'en_revision').length,
      resueltas: incidencias.filter(i => i.estado === 'resuelta' || i.estado === 'cerrada').length,
    };

    // Generate intelligent suggestions based on context
    const sugerencias = generateSuggestions({
      documentosStats,
      incidenciasStats,
      recordatorios,
      datosFinancieros,
    });

    return res.status(200).json({
      success: true,
      data: {
        documentosStats,
        incidenciasStats,
        proximosVencimientos: recordatorios,
        datosFinancierosRecientes: datosFinancieros,
        sugerencias,
      },
    });
  } catch (error: any) {
    console.error('Context fetch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

/**
 * Generate intelligent suggestions based on client's current situation
 */
function generateSuggestions(context: any): string[] {
  const sugerencias: string[] = [];

  // Document-related suggestions
  if (context.documentosStats.pendientes > 0) {
    sugerencias.push(`Tengo ${context.documentosStats.pendientes} documentos pendientes, ¿qué significa?`);
  }

  if (context.documentosStats.total === 0) {
    sugerencias.push('¿Qué documentos debo subir primero?');
  }

  // Incident-related suggestions
  if (context.incidenciasStats.abiertas > 0) {
    sugerencias.push('¿Cuándo responderá mi asesor a mis consultas?');
  }

  // Tax-related suggestions
  if (context.proximosVencimientos?.length > 0) {
    const proximoVencimiento = context.proximosVencimientos[0];
    const fecha = new Date(proximoVencimiento.fecha_vencimiento);
    const diasHasta = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (diasHasta <= 15) {
      sugerencias.push(`¿Qué necesito para presentar el Modelo ${proximoVencimiento.calendario_fiscal.modelo}?`);
    } else {
      sugerencias.push('¿Cuándo tengo que pagar el IVA?');
    }
  } else {
    sugerencias.push('¿Cuándo tengo que presentar mis impuestos?');
  }

  // Financial suggestions
  if (context.datosFinancierosRecientes?.length > 0) {
    const ultimoPeriodo = context.datosFinancierosRecientes[0];
    if (parseFloat(ultimoPeriodo.resultado) < 0) {
      sugerencias.push('¿Cómo puedo mejorar mi situación financiera?');
    } else {
      sugerencias.push('¿Cuál es mi situación financiera actual?');
    }
  } else {
    sugerencias.push('¿Cuándo veré mis datos financieros?');
  }

  // General suggestions
  sugerencias.push('¿Qué gastos puedo deducir en mi negocio?');
  sugerencias.push('Explícame qué es una factura rectificativa');

  // Return top 5 most relevant
  return sugerencias.slice(0, 5);
}

