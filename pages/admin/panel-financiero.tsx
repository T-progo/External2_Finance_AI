import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { DashboardFinancieroAdmin } from '@/types';
import DataTable from '@/components/DataTable';
import FilterBar, { Filter } from '@/components/FilterBar';
import FinancialChart from '@/components/FinancialChart';
import toast from 'react-hot-toast';
import type { DatosFinancieros, Cliente } from '@/types';

export default function AdminPanelFinanciero() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardFinancieroAdmin | null>(null);
  const [datosFinancieros, setDatosFinancieros] = useState<DatosFinancieros[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>('2024');

  const filterConfig: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'Razón social...',
    },
    {
      key: 'riesgoIA',
      label: 'Riesgo IA',
      type: 'select',
      options: [
        { value: 'bajo', label: 'Bajo' },
        { value: 'medio', label: 'Medio' },
        { value: 'alto', label: 'Alto' },
      ],
    },
  ];

  const datosFiltradosConId = datosFinancieros.filter(datos => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      const cliente = getClienteById(datos.clienteId);
      if (!cliente?.razonSocial.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.riesgoIA && datos.riesgoIA !== filtros.riesgoIA) return false;
    return true;
  }).map(datos => ({ ...datos, id: datos.clienteId }));

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros({ ...filtros, [key]: value });
  };

  const handleLimpiarFiltros = () => {
    setFiltros({});
  };

  const handleVerDetalle = (datos: DatosFinancieros) => {
    setClienteSeleccionado(datos);
    setMostrarDetalle(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getRiesgoBadge = (riesgo?: 'bajo' | 'medio' | 'alto') => {
    if (!riesgo) return null;
    const badges = {
      bajo: 'badge-success',
      medio: 'badge-warning',
      alto: 'badge-danger',
    };
    const labels = {
      bajo: '🟢 Bajo',
      medio: '🟡 Medio',
      alto: '🔴 Alto',
    };
    return <span className={`badge ${badges[riesgo]}`}>{labels[riesgo]}</span>;
  };

  const columns = [
    {
      key: 'cliente',
      header: 'Cliente',
      sortable: true,
      render: (datos: DatosFinancieros) => {
        const cliente = getClienteById(datos.clienteId);
        return (
          <div>
            <div className="font-medium text-gray-900">{cliente?.razonSocial || '-'}</div>
            <div className="text-xs text-gray-500">{cliente?.nif || ''}</div>
          </div>
        );
      },
    },
    {
      key: 'periodo',
      header: 'Periodo',
      sortable: true,
    },
    {
      key: 'ingresos',
      header: 'Ingresos',
      sortable: true,
      render: (datos: DatosFinancieros) => (
        <div className="font-medium text-green-600">{formatCurrency(datos.ingresos)}</div>
      ),
    },
    {
      key: 'gastos',
      header: 'Gastos',
      sortable: true,
      render: (datos: DatosFinancieros) => (
        <div className="font-medium text-red-600">{formatCurrency(datos.gastos)}</div>
      ),
    },
    {
      key: 'resultado',
      header: 'Resultado',
      sortable: true,
      render: (datos: DatosFinancieros) => (
        <div className={`font-bold ${datos.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(datos.resultado)}
        </div>
      ),
    },
    {
      key: 'margen',
      header: 'Margen %',
      sortable: true,
      render: (datos: DatosFinancieros) => (
        <div className={`font-medium ${datos.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {datos.margen.toFixed(1)}%
        </div>
      ),
    },
    {
      key: 'riesgoIA',
      header: 'Riesgo IA',
      sortable: true,
      render: (datos: DatosFinancieros) => getRiesgoBadge(datos.riesgoIA),
    },
  ];

  const estadisticasConsolidadas = datosFinancieros.length > 0 ? {
    totalIngresos: datosFinancieros.reduce((sum, d) => sum + d.ingresos, 0),
    totalGastos: datosFinancieros.reduce((sum, d) => sum + d.gastos, 0),
    totalResultado: datosFinancieros.reduce((sum, d) => sum + d.resultado, 0),
    margenPromedio: datosFinancieros.reduce((sum, d) => sum + d.margen, 0) / datosFinancieros.length,
    clientesRiesgoAlto: datosFinancieros.filter(d => d.riesgoIA === 'alto').length,
    clientesRentables: datosFinancieros.filter(d => d.resultado > 0).length,
  } : {
    totalIngresos: 0,
    totalGastos: 0,
    totalResultado: 0,
    margenPromedio: 0,
    clientesRiesgoAlto: 0,
    clientesRentables: 0,
  };

  const getClienteById = (id: string) => clientes.find(c => c.id === id);

  return (
    <Layout rol="admin">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel Financiero Global</h1>
          <p className="text-gray-600 mt-1">Análisis consolidado con comentarios IA automáticos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="text-sm text-green-700 font-medium">Ingresos Totales</div>
            <div className="text-3xl font-bold text-green-900 mt-1">
              {formatCurrency(estadisticasConsolidadas.totalIngresos)}
            </div>
          </div>
          <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="text-sm text-red-700 font-medium">Gastos Totales</div>
            <div className="text-3xl font-bold text-red-900 mt-1">
              {formatCurrency(estadisticasConsolidadas.totalGastos)}
            </div>
          </div>
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="text-sm text-blue-700 font-medium">Resultado Consolidado</div>
            <div className={`text-3xl font-bold mt-1 ${estadisticasConsolidadas.totalResultado >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              {formatCurrency(estadisticasConsolidadas.totalResultado)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Margen Promedio</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {estadisticasConsolidadas.margenPromedio.toFixed(1)}%
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Clientes Rentables</div>
            <div className="text-2xl font-bold text-success mt-1">
              {estadisticasConsolidadas.clientesRentables}/{datosFinancieros.length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Clientes Riesgo Alto</div>
            <div className="text-2xl font-bold text-danger mt-1">
              {estadisticasConsolidadas.clientesRiesgoAlto}
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="text-3xl">🤖</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Análisis IA Automático</h3>
              <p className="text-sm text-blue-800">
                El resultado consolidado muestra una tendencia positiva con un margen promedio del{' '}
                {estadisticasConsolidadas.margenPromedio.toFixed(1)}%. Se recomienda atención especial a los{' '}
                {estadisticasConsolidadas.clientesRiesgoAlto} clientes con riesgo alto identificados por la IA.
                La tasa de rentabilidad es del{' '}
                {((estadisticasConsolidadas.clientesRentables / datosFinancieros.length) * 100).toFixed(0)}%.
              </p>
            </div>
          </div>
        </div>

        <FilterBar
          filters={filterConfig}
          values={filtros}
          onChange={handleFiltroChange}
          onClear={handleLimpiarFiltros}
        />

        <div className="card">
          <DataTable
            data={datosFiltradosConId}
            columns={columns}
            onRowClick={handleVerDetalle}
            actions={(datos) => (
              <button
                onClick={() => handleVerDetalle(datos)}
                className="text-blue-600 hover:text-blue-900"
                title="Ver detalle"
              >
                📊
              </button>
            )}
          />
        </div>

        {mostrarDetalle && clienteSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {getClienteById(clienteSeleccionado.clienteId)?.razonSocial}
                  </h2>
                  <p className="text-gray-600">Periodo: {clienteSeleccionado.periodo}</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarDetalle(false);
                    setClienteSeleccionado(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="card bg-green-50">
                    <div className="text-sm text-green-700">Ingresos</div>
                    <div className="text-2xl font-bold text-green-900 mt-1">
                      {formatCurrency(clienteSeleccionado.ingresos)}
                    </div>
                  </div>
                  <div className="card bg-red-50">
                    <div className="text-sm text-red-700">Gastos</div>
                    <div className="text-2xl font-bold text-red-900 mt-1">
                      {formatCurrency(clienteSeleccionado.gastos)}
                    </div>
                  </div>
                  <div className="card bg-blue-50">
                    <div className="text-sm text-blue-700">Resultado</div>
                    <div className={`text-2xl font-bold mt-1 ${clienteSeleccionado.resultado >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                      {formatCurrency(clienteSeleccionado.resultado)}
                    </div>
                  </div>
                  <div className="card bg-purple-50">
                    <div className="text-sm text-purple-700">Margen</div>
                    <div className={`text-2xl font-bold mt-1 ${clienteSeleccionado.margen >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                      {clienteSeleccionado.margen.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Análisis de Riesgo IA</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Nivel de Riesgo Detectado:</span>
                    {getRiesgoBadge(clienteSeleccionado.riesgoIA)}
                  </div>
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      {clienteSeleccionado.riesgoIA === 'alto' && 
                        'La IA ha detectado señales de riesgo alto. Se recomienda revisión detallada de la situación financiera y seguimiento cercano.'}
                      {clienteSeleccionado.riesgoIA === 'medio' && 
                        'La IA ha identificado algunos indicadores de precaución. Se sugiere monitoreo regular de la evolución financiera.'}
                      {clienteSeleccionado.riesgoIA === 'bajo' && 
                        'La situación financiera es estable según el análisis IA. Continuar con el seguimiento habitual.'}
                    </p>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Último Cierre</h3>
                  <p className="text-gray-700">
                    {clienteSeleccionado.ultimoCierre 
                      ? new Date(clienteSeleccionado.ultimoCierre).toLocaleDateString('es-ES')
                      : 'No disponible'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
