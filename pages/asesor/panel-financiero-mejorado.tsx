import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import FinancialAIAssistant from '@/components/FinancialAIAssistant';
import FinancialChart from '@/components/FinancialChart';
import toast from 'react-hot-toast';

interface ClienteFinanciero {
  id: string;
  nombre: string;
  ingresos: number;
  gastos: number;
  resultado: number;
  margen: number;
  riesgo: 'bajo' | 'medio' | 'alto';
}

export default function PanelFinancieroMejorado() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [clientesData, setClientesData] = useState<ClienteFinanciero[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [ratios, setRatios] = useState({
    liquidez: 0,
    solvencia: 0,
    rentabilidad: 0,
    endeudamiento: 0
  });

  const loadFinancialData = useCallback(async () => {
    try {
      setLoadingData(true);

      if (!user?.id) {
        setClientesData([]);
        setRatios({ liquidez: 0, solvencia: 0, rentabilidad: 0, endeudamiento: 0 });
        return;
      }

      const resp = await fetch('/api/financial/summary-for-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asesorId: user.id }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo cargar datos financieros');
      }

      const payload = await resp.json();
      const financialData = payload.data || [];

      if (!financialData || financialData.length === 0) {
        setClientesData([]);
        setRatios({ liquidez: 0, solvencia: 0, rentabilidad: 0, endeudamiento: 0 });
        return;
      }

      // Fetch client names separately (client-side, harmless)
      const uniqueClientIds = [...new Set(financialData.map((fd: any) => fd.cliente_id))];
      const { data: clientesInfo } = await supabase
        .from('clientes')
        .select('id, razon_social, nombre_comercial')
        .in('id', uniqueClientIds);

      const clientesMap = new Map();
      clientesInfo?.forEach((c: any) => {
        clientesMap.set(c.id, c.nombre_comercial || c.razon_social || 'Cliente sin nombre');
      });

      // Group by cliente and take latest
      const clientesDataMap = new Map();

      financialData.forEach((fd: any) => {
        if (!clientesDataMap.has(fd.cliente_id)) {
          const ingresos = typeof fd.ingresos === 'string' ? parseFloat(fd.ingresos) : fd.ingresos || 0;
          const gastos = typeof fd.gastos === 'string' ? parseFloat(fd.gastos) : fd.gastos || 0;
          const resultado = typeof fd.resultado === 'string' ? parseFloat(fd.resultado) : fd.resultado || 0;
          const margen = typeof fd.margen === 'string' ? parseFloat(fd.margen) : fd.margen || 0;

          clientesDataMap.set(fd.cliente_id, {
            id: fd.cliente_id,
            nombre: clientesMap.get(fd.cliente_id) || `Cliente ${fd.cliente_id.substring(0, 8)}`,
            ingresos: Number(ingresos) || 0,
            gastos: Number(gastos) || 0,
            resultado: Number(resultado) || 0,
            margen: Number(margen) || 0,
            riesgo: fd.riesgo_ia || 'bajo',
          });
        }
      });

      const clientes = Array.from(clientesDataMap.values());
      setClientesData(clientes);

      const totalIngresos = clientes.reduce((sum, c) => sum + (c.ingresos || 0), 0);
      const totalGastos = clientes.reduce((sum, c) => sum + (c.gastos || 0), 0);
      const totalResultado = clientes.reduce((sum, c) => sum + (c.resultado || 0), 0);

      setRatios({
        liquidez: totalGastos > 0 ? (totalIngresos / totalGastos) * 100 : 0,
        solvencia: totalIngresos > 0 ? (totalResultado / totalIngresos) * 100 : 0,
        rentabilidad: totalIngresos > 0 ? (totalResultado / totalIngresos) * 100 : 0,
        endeudamiento: totalIngresos > 0 ? (totalGastos / totalIngresos) * 100 : 0,
      });
    } catch (error) {
      console.error('[Panel Financiero] Error loading financial data:', error);
      toast.error('Error al cargar datos financieros');
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'asesor')) {
      router.push('/');
    }
    if (user && user.rol === 'asesor') {
      loadFinancialData();
    }
  }, [user, loading, router, loadFinancialData]);

  const handleUploadFinancialData = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.xlsx,.xls';
    fileInput.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('clienteId', selectedCliente || '');

      try {
        const response = await fetch('/api/financial-data/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error('Error uploading file');

        toast.success('Datos financieros cargados correctamente');
        loadFinancialData();
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al cargar datos');
      }
    };
    fileInput.click();
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-asesor"></div>
      </div>
    );
  }

  const totalIngresos = clientesData.reduce((sum, c) => sum + c.ingresos, 0);
  const totalGastos = clientesData.reduce((sum, c) => sum + c.gastos, 0);
  const totalResultado = clientesData.reduce((sum, c) => sum + c.resultado, 0);

  return (
    <>
      <Head>
        <title>Panel Financiero - Externaliza2</title>
      </Head>
      <Layout rol="asesor">
        <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Panel Financiero</h1>
              <p className="text-gray-600 mt-1">
                Análisis financiero y ratios de todos tus clientes
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleUploadFinancialData}
                className="btn btn-secondary"
              >
                📤 Cargar Datos
              </button>
              <button
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="btn btn-asesor"
              >
                🤖 Asistente IA
              </button>
            </div>
          </div>

          {/* Main Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-green-50 to-green-100">
              <h3 className="text-sm text-gray-600 mb-2">Ingresos Totales</h3>
              <p className="text-3xl font-bold text-green-700">
                €{totalIngresos.toLocaleString('es-ES')}
              </p>
              <p className="text-xs text-gray-600 mt-2">Todos los clientes</p>
            </div>
            <div className="card bg-gradient-to-br from-red-50 to-red-100">
              <h3 className="text-sm text-gray-600 mb-2">Gastos Totales</h3>
              <p className="text-3xl font-bold text-red-700">
                €{totalGastos.toLocaleString('es-ES')}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {totalIngresos > 0 ? ((totalGastos / totalIngresos) * 100).toFixed(1) : '0.0'}% de ingresos
              </p>
            </div>
            <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
              <h3 className="text-sm text-gray-600 mb-2">Resultado Neto</h3>
              <p className="text-3xl font-bold text-blue-700">
                €{totalResultado.toLocaleString('es-ES')}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Margen: {totalIngresos > 0 ? ((totalResultado / totalIngresos) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>

          {/* Ratios Financieros */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Ratios Financieros</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Liquidez</span>
                  <span className="text-xs font-medium text-green-600">Bueno</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {ratios.liquidez.toFixed(1)}%
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-full bg-green-500 rounded-full" 
                    style={{width: `${Math.min(ratios.liquidez, 100)}%`}}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Solvencia</span>
                  <span className="text-xs font-medium text-blue-600">Óptimo</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {ratios.solvencia.toFixed(1)}%
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{width: `${Math.abs(ratios.solvencia)}%`}}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Rentabilidad</span>
                  <span className="text-xs font-medium text-purple-600">Excelente</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {ratios.rentabilidad.toFixed(1)}%
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-full bg-purple-500 rounded-full" 
                    style={{width: `${Math.abs(ratios.rentabilidad)}%`}}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Endeudamiento</span>
                  <span className="text-xs font-medium text-yellow-600">Moderado</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {ratios.endeudamiento.toFixed(1)}%
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-full bg-yellow-500 rounded-full" 
                    style={{width: `${Math.min(ratios.endeudamiento, 100)}%`}}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Client Financial Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Desglose por Cliente
              </h2>
              {clientesData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">No hay datos financieros disponibles</p>
                  <p className="text-sm">
                    Los datos financieros se generan automáticamente cuando se contabilizan documentos.
                    Asegúrate de que los documentos estén marcados como contabilizados.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {clientesData.map(cliente => (
                  <div 
                    key={cliente.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedCliente === cliente.id 
                        ? 'border-asesor bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedCliente(cliente.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900">{cliente.nombre}</h3>
                      <span className={`badge text-xs ${
                        cliente.riesgo === 'alto' ? 'badge-danger' :
                        cliente.riesgo === 'medio' ? 'badge-warning' :
                        'badge-success'
                      }`}>
                        {cliente.riesgo.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Ingresos:</span>
                        <p className="font-medium text-green-600">
                          €{cliente.ingresos.toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Gastos:</span>
                        <p className="font-medium text-red-600">
                          €{cliente.gastos.toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Margen:</span>
                        <p className={`font-medium ${
                          cliente.margen > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {cliente.margen.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Tendencia Financiera Agregada
              </h2>
              <FinancialChart 
                ingresos={totalIngresos}
                gastos={totalGastos}
                resultado={totalResultado}
              />
            </div>
          </div>
        </div>

        {/* AI Assistant Modal */}
        {showAIAssistant && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-[600px] flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold">Asistente Financiero IA</h2>
                <button
                  onClick={() => setShowAIAssistant(false)}
                  className="text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <FinancialAIAssistant 
                  clienteId={selectedCliente || undefined}
                  asesorView={true}
                />
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}
