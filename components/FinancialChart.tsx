// Simple bar chart component for financial data visualization
import React from 'react';

interface FinancialChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
}

interface FinancialChartData {
  labels: string[];
  datasets: FinancialChartDataset[];
}

interface FinancialChartProps {
  // Simple summary mode (legacy)
  ingresos?: number;
  gastos?: number;
  resultado?: number;
  // Lightweight multi-dataset mode (line/bar-ish)
  type?: 'line' | 'bar';
  data?: FinancialChartData;
}

export default function FinancialChart({
  ingresos,
  gastos,
  resultado,
  type,
  data,
}: FinancialChartProps) {
  // Render dataset mode when data is provided
  if (data && data.datasets?.length) {
    const maxValue = Math.max(
      ...data.datasets.flatMap(ds => ds.data),
      0
    ) || 1;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800">
            {type === 'line' ? 'Tendencia' : 'Distribución'}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {data.datasets.map((ds, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded bg-gray-100 text-gray-800 border border-gray-200"
                style={{ borderColor: ds.borderColor || '#888', color: ds.borderColor || '#444' }}
              >
                {ds.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {data.labels.map((label, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>{label}</span>
              </div>
              <div className="space-y-1">
                {data.datasets.map((ds, dIdx) => {
                  const val = ds.data[idx] || 0;
                  const pct = Math.min(100, Math.max(0, (val / maxValue) * 100));
                  return (
                    <div key={dIdx} className="flex items-center space-x-2">
                      <div className="w-20 text-[11px] text-gray-700">{ds.label}</div>
                      <div className="flex-1 bg-gray-200 rounded h-3">
                        <div
                          className="h-3 rounded"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: ds.backgroundColor || ds.borderColor || '#2563eb',
                          }}
                        />
                      </div>
                      <div className="w-20 text-right text-[11px] text-gray-800">
                        {new Intl.NumberFormat('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                          maximumFractionDigits: 0,
                        }).format(val)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback to legacy simple summary mode
  const safeIngresos = ingresos || 0;
  const safeGastos = gastos || 0;
  const safeResultado = resultado ?? (safeIngresos - safeGastos);
  const maxValue = Math.max(safeIngresos, safeGastos, 1);
  const ingresosPercent = (safeIngresos / maxValue) * 100;
  const gastosPercent = (safeGastos / maxValue) * 100;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Ingresos</span>
          <span className="text-sm font-semibold text-green-600">
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(safeIngresos)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6">
          <div
            className="bg-green-500 h-6 rounded-full flex items-center justify-end pr-2"
            style={{ width: `${ingresosPercent}%` }}
          >
            <span className="text-white text-xs font-semibold">
              {ingresosPercent.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Gastos</span>
          <span className="text-sm font-semibold text-red-600">
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(safeGastos)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6">
          <div
            className="bg-red-500 h-6 rounded-full flex items-center justify-end pr-2"
            style={{ width: `${gastosPercent}%` }}
          >
            <span className="text-white text-xs font-semibold">
              {gastosPercent.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-300">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-900">Resultado</span>
          <span className={`text-lg font-bold ${safeResultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(safeResultado)}
          </span>
        </div>
      </div>
    </div>
  );
}

