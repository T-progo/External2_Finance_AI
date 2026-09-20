// Export utilities for PDF and Excel generation
import type { DatosFinancieros, DocumentoFinanciero } from '@/types';

/**
 * Generate CSV data from financial information
 */
export function generateCSV(datos: DatosFinancieros, documentos?: DocumentoFinanciero[]): string {
  let csv = 'Datos Financieros\n\n';
  csv += `Periodo,${datos.periodo}\n`;
  csv += `Ingresos,${datos.ingresos}\n`;
  csv += `Gastos,${datos.gastos}\n`;
  csv += `Resultado,${datos.resultado}\n`;
  csv += `Margen,${datos.margen}%\n`;
  if (datos.riesgoIA) {
    csv += `Riesgo IA,${datos.riesgoIA}\n`;
  }
  csv += '\n';

  if (documentos && documentos.length > 0) {
    csv += 'Documentos Financieros\n';
    csv += 'Nombre,Tipo,Periodo,Fecha Subida,Procesado\n';
    documentos.forEach(doc => {
      csv += `"${doc.nombre}","${doc.tipo}","${doc.periodo}","${doc.fechaSubida.toLocaleDateString('es-ES')}","${doc.procesadoIA ? 'Sí' : 'No'}"\n`;
    });
  }

  return csv;
}

/**
 * Download CSV file
 */
export function downloadCSV(datos: DatosFinancieros, documentos?: DocumentoFinanciero[]) {
  const csv = generateCSV(datos, documentos);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `datos-financieros-${datos.periodo}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate HTML for PDF printing (browser print to PDF)
 */
export function generatePrintableHTML(datos: DatosFinancieros, documentos?: DocumentoFinanciero[], clienteNombre?: string): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe Financiero - ${datos.periodo}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #4F46E5;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    .header h1 {
      color: #4F46E5;
      margin: 0;
      font-size: 32px;
    }
    .header p {
      color: #666;
      margin: 10px 0 0 0;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #4F46E5;
      border-bottom: 2px solid #E5E7EB;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    .metric-card {
      border: 2px solid #E5E7EB;
      border-radius: 8px;
      padding: 20px;
    }
    .metric-label {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .metric-value {
      font-size: 28px;
      font-weight: bold;
    }
    .metric-value.positive {
      color: #10B981;
    }
    .metric-value.negative {
      color: #EF4444;
    }
    .metric-value.neutral {
      color: #4F46E5;
    }
    .summary {
      background: #F3F4F6;
      border-left: 4px solid #4F46E5;
      padding: 20px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .risk-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }
    .risk-bajo {
      background: #D1FAE5;
      color: #065F46;
    }
    .risk-medio {
      background: #FEF3C7;
      color: #92400E;
    }
    .risk-alto {
      background: #FEE2E2;
      color: #991B1B;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #E5E7EB;
    }
    th {
      background: #F9FAFB;
      font-weight: 600;
      color: #374151;
    }
    .footer {
      margin-top: 60px;
      text-align: center;
      font-size: 12px;
      color: #999;
      border-top: 1px solid #E5E7EB;
      padding-top: 20px;
    }
    @media print {
      body {
        padding: 20px;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Informe Financiero</h1>
    ${clienteNombre ? `<p><strong>${clienteNombre}</strong></p>` : ''}
    <p>Periodo: ${datos.periodo}</p>
    <p style="font-size: 12px; color: #999;">Generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
  </div>

  <div class="section">
    <h2>Resumen Ejecutivo</h2>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Ingresos</div>
        <div class="metric-value positive">${formatCurrency(datos.ingresos)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Gastos</div>
        <div class="metric-value negative">${formatCurrency(datos.gastos)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Resultado</div>
        <div class="metric-value ${datos.resultado >= 0 ? 'positive' : 'negative'}">${formatCurrency(datos.resultado)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Margen</div>
        <div class="metric-value neutral">${datos.margen.toFixed(1)}%</div>
      </div>
    </div>
  </div>

  ${datos.riesgoIA ? `
  <div class="section">
    <h2>Análisis de Riesgo</h2>
    <div class="summary">
      <div style="margin-bottom: 10px;">
        <strong>Nivel de Riesgo:</strong> 
        <span class="risk-badge risk-${datos.riesgoIA}">
          ${datos.riesgoIA === 'bajo' ? '🟢 Bajo' : datos.riesgoIA === 'medio' ? '🟡 Medio' : '🔴 Alto'}
        </span>
      </div>
      <p>
        ${datos.riesgoIA === 'bajo' ? 'La situación financiera es estable. Los indicadores muestran que la empresa está en una posición sólida.' : ''}
        ${datos.riesgoIA === 'medio' ? 'Conviene mantener vigilancia sobre algunos indicadores. Se recomienda monitoreo regular de la evolución financiera.' : ''}
        ${datos.riesgoIA === 'alto' ? 'Se han detectado señales de riesgo. Se recomienda revisión detallada de la situación financiera y seguimiento cercano.' : ''}
      </p>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2>Interpretación</h2>
    <div class="summary">
      <p><strong>Situación General:</strong></p>
      <p>
        ${datos.resultado >= 0 
          ? `La empresa está generando beneficios de ${formatCurrency(datos.resultado)}. Esto significa que después de pagar todos los gastos, queda dinero disponible.`
          : `La empresa tiene pérdidas de ${formatCurrency(Math.abs(datos.resultado))}. Los gastos superan a los ingresos, lo que requiere atención.`
        }
      </p>
      
      <p style="margin-top: 15px;"><strong>Rentabilidad:</strong></p>
      <p>
        Con un margen del ${datos.margen.toFixed(1)}%, de cada 100€ que ingresan, quedan aproximadamente ${datos.margen.toFixed(0)}€ de beneficio después de pagar todos los gastos.
        ${datos.margen >= 15 ? ' La rentabilidad es muy saludable.' : ''}
        ${datos.margen >= 5 && datos.margen < 15 ? ' Hay margen de mejora en la rentabilidad.' : ''}
        ${datos.margen < 5 && datos.margen >= 0 ? ' El margen es muy ajustado. Se recomienda revisar la estructura de costes.' : ''}
        ${datos.margen < 0 ? ' Se está operando con pérdidas. Es urgente ajustar precios o reducir gastos.' : ''}
      </p>
    </div>
  </div>

  ${documentos && documentos.length > 0 ? `
  <div class="section">
    <h2>Documentos Financieros Analizados</h2>
    <table>
      <thead>
        <tr>
          <th>Documento</th>
          <th>Tipo</th>
          <th>Periodo</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${documentos.map(doc => `
          <tr>
            <td>${doc.nombre}</td>
            <td>${doc.tipo.toUpperCase()}</td>
            <td>${doc.periodo}</td>
            <td>${doc.fechaSubida.toLocaleDateString('es-ES')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <h2>Recomendaciones</h2>
    <div class="summary">
      <ul style="margin: 0; padding-left: 20px;">
        ${datos.resultado >= 0 ? `
          <li>Considerar reinvertir parte del beneficio para crecer</li>
          <li>Mantener control sobre los gastos fijos mensuales</li>
          <li>Planificar el pago de impuestos con el asesor</li>
        ` : `
          <li>Revisar urgentemente las mayores partidas de gasto</li>
          <li>Evaluar la posibilidad de aumentar precios sin perder clientes</li>
          <li>Agendar una reunión con el asesor para un plan de acción</li>
        `}
      </ul>
    </div>
  </div>

  <div class="footer">
    <p>Este informe es generado automáticamente basándose en los datos financieros disponibles.</p>
    <p>Para un análisis más detallado, consulte con su asesor financiero.</p>
  </div>

  <script>
    // Auto-print on load
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

/**
 * Open print dialog for PDF export
 */
export function printToPDF(datos: DatosFinancieros, documentos?: DocumentoFinanciero[], clienteNombre?: string) {
  const html = generatePrintableHTML(datos, documentos, clienteNombre);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    alert('Por favor, permite las ventanas emergentes para generar el PDF.');
  }
}

/**
 * Export to Excel (actually CSV that Excel can open)
 */
export function exportToExcel(datos: DatosFinancieros, documentos?: DocumentoFinanciero[]) {
  downloadCSV(datos, documentos);
}

