import { useState } from 'react';
import Layout from '@/components/Layout';
import { mockDocumentos } from '@/lib/mockData';

export default function AdminContabilizadorIA() {
  const totalDocumentos = mockDocumentos.length;
  const procesadosIA = mockDocumentos.filter(d => d.procesadoIA).length;
  const documentosConIA = mockDocumentos.filter(d => d.datosIA);
  
  const nivelConfianzaPromedio = documentosConIA.length > 0
    ? documentosConIA.reduce((sum, d) => sum + (d.datosIA?.nivelConfianza || 0), 0) / documentosConIA.length
    : 0;

  const documentosAltaConfianza = documentosConIA.filter(d => (d.datosIA?.nivelConfianza || 0) >= 95).length;
  const documentosMediaConfianza = documentosConIA.filter(d => {
    const confianza = d.datosIA?.nivelConfianza || 0;
    return confianza >= 80 && confianza < 95;
  }).length;
  const documentosBajaConfianza = documentosConIA.filter(d => (d.datosIA?.nivelConfianza || 0) < 80).length;

  const validados = mockDocumentos.filter(d => d.estado === 'validado' || d.estado === 'contabilizado').length;
  const tasaValidacion = totalDocumentos > 0 ? (validados / totalDocumentos) * 100 : 0;

  const porTipoDocumento = {
    emitida: documentosConIA.filter(d => d.tipo === 'emitida_pdf' || d.tipo === 'emitida_excel').length,
    recibida: documentosConIA.filter(d => d.tipo === 'recibida_pdf' || d.tipo === 'recibida_excel').length,
    nomina: 0, // 'nomina' type no longer exists in new enum
    gasto: 0, // 'gasto' type no longer exists in new enum
    otro: documentosConIA.filter(d => d.tipo === 'otro').length,
  };

  const [vistaActiva, setVistaActiva] = useState<'metricas' | 'rendimiento' | 'precision'>('metricas');

  return (
    <Layout rol="admin">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contabilizador IA</h1>
          <p className="text-gray-600 mt-1">Supervisión y métricas de rendimiento del motor IA</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="text-sm text-blue-700 font-medium">Documentos Procesados</div>
            <div className="text-3xl font-bold text-blue-900 mt-1">{procesadosIA}</div>
            <div className="text-xs text-blue-600 mt-1">de {totalDocumentos} totales</div>
          </div>
          <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="text-sm text-green-700 font-medium">Confianza Promedio</div>
            <div className="text-3xl font-bold text-green-900 mt-1">{nivelConfianzaPromedio.toFixed(1)}%</div>
            <div className="text-xs text-green-600 mt-1">nivel de precisión</div>
          </div>
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="text-sm text-purple-700 font-medium">Tasa Validación</div>
            <div className="text-3xl font-bold text-purple-900 mt-1">{tasaValidacion.toFixed(0)}%</div>
            <div className="text-xs text-purple-600 mt-1">{validados} validados</div>
          </div>
          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <div className="text-sm text-yellow-700 font-medium">Alta Confianza</div>
            <div className="text-3xl font-bold text-yellow-900 mt-1">{documentosAltaConfianza}</div>
            <div className="text-xs text-yellow-600 mt-1">≥ 95% confianza</div>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setVistaActiva('metricas')}
            className={`btn ${vistaActiva === 'metricas' ? 'btn-admin' : 'btn-secondary'}`}
          >
            📊 Métricas Generales
          </button>
          <button
            onClick={() => setVistaActiva('rendimiento')}
            className={`btn ${vistaActiva === 'rendimiento' ? 'btn-admin' : 'btn-secondary'}`}
          >
            ⚡ Rendimiento
          </button>
          <button
            onClick={() => setVistaActiva('precision')}
            className={`btn ${vistaActiva === 'precision' ? 'btn-admin' : 'btn-secondary'}`}
          >
            🎯 Precisión por Tipo
          </button>
        </div>

        {vistaActiva === 'metricas' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Confianza</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-700">Alta Confianza (≥95%)</span>
                    <span className="text-2xl">🟢</span>
                  </div>
                  <div className="text-3xl font-bold text-green-900">{documentosAltaConfianza}</div>
                  <div className="mt-2 bg-green-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${(documentosAltaConfianza / documentosConIA.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-yellow-700">Media Confianza (80-94%)</span>
                    <span className="text-2xl">🟡</span>
                  </div>
                  <div className="text-3xl font-bold text-yellow-900">{documentosMediaConfianza}</div>
                  <div className="mt-2 bg-yellow-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full" 
                      style={{ width: `${(documentosMediaConfianza / documentosConIA.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-700">Baja Confianza (&lt;80%)</span>
                    <span className="text-2xl">🔴</span>
                  </div>
                  <div className="text-3xl font-bold text-red-900">{documentosBajaConfianza}</div>
                  <div className="mt-2 bg-red-200 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full" 
                      style={{ width: `${(documentosBajaConfianza / documentosConIA.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis IA Automático</h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  El motor IA está funcionando con un nivel de confianza promedio del{' '}
                  <strong>{nivelConfianzaPromedio.toFixed(1)}%</strong>.{' '}
                  {documentosAltaConfianza > documentosBajaConfianza 
                    ? 'La mayoría de documentos se procesan con alta precisión, indicando un rendimiento óptimo del sistema.'
                    : 'Se recomienda revisar los documentos con baja confianza para mejorar el entrenamiento del modelo.'}
                  {' '}La tasa de validación del <strong>{tasaValidacion.toFixed(0)}%</strong> indica que los asesores
                  están confirmando la mayoría de las lecturas automáticas.
                </p>
              </div>
            </div>
          </div>
        )}

        {vistaActiva === 'rendimiento' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Velocidad de Procesamiento</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Documentos/hora</span>
                      <span className="font-bold text-gray-900">~120</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Tiempo medio/documento</span>
                      <span className="font-bold text-gray-900">30s</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '90%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Disponibilidad sistema</span>
                      <span className="font-bold text-gray-900">99.8%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '99.8%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas de Calidad</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-700">Documentos sin errores</span>
                    <span className="text-lg font-bold text-green-900">87%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <span className="text-sm text-yellow-700">Correcciones manuales</span>
                    <span className="text-lg font-bold text-yellow-900">13%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700">Tasa de aprendizaje</span>
                    <span className="text-lg font-bold text-blue-900">+2.3%/mes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {vistaActiva === 'precision' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Precisión por Tipo de Documento</h3>
              <div className="space-y-4">
                {[
                  { tipo: 'Facturas Emitidas', cantidad: porTipoDocumento.emitida, precision: 96, color: 'blue' },
                  { tipo: 'Facturas Recibidas', cantidad: porTipoDocumento.recibida, precision: 94, color: 'green' },
                  { tipo: 'Nóminas', cantidad: porTipoDocumento.nomina, precision: 88, color: 'purple' },
                  { tipo: 'Gastos', cantidad: porTipoDocumento.gasto, precision: 75, color: 'yellow' },
                  { tipo: 'Otros', cantidad: porTipoDocumento.otro, precision: 82, color: 'gray' },
                ].map((item) => (
                  <div key={item.tipo} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{item.tipo}</div>
                        <div className="text-sm text-gray-500">{item.cantidad} documentos procesados</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold text-${item.color}-600`}>{item.precision}%</div>
                        <div className="text-xs text-gray-500">precisión</div>
                      </div>
                    </div>
                    <div className="bg-gray-200 rounded-full h-3">
                      <div 
                        className="h-3 rounded-full"
                        style={{ 
                          width: `${item.precision}%`,
                          backgroundColor: item.color === 'blue' ? '#2563eb' : 
                                         item.color === 'green' ? '#16a34a' :
                                         item.color === 'purple' ? '#9333ea' :
                                         item.color === 'yellow' ? '#ca8a04' : '#6b7280'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
