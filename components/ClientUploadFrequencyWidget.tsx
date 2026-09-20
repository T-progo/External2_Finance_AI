import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';

interface ClienteFrequency {
  id: string;
  nombre: string;
  lastUpload: Date | null;
  daysSinceUpload: number;
  totalUploads: number;
  avgDaysBetweenUploads: number;
  status: 'active' | 'warning' | 'critical';
}

interface ClientUploadFrequencyWidgetProps {
  asesorId: string;
}

export default function ClientUploadFrequencyWidget({ asesorId }: ClientUploadFrequencyWidgetProps) {
  const [clientesFrequency, setClientesFrequency] = useState<ClienteFrequency[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFrequencyData = useCallback(async () => {
    try {
      if (!asesorId) {
        console.error('No asesor ID provided');
        setLoading(false);
        return;
      }

      // Get assigned clients
      const { data: assignedClients, error: clientError } = await supabaseAdmin
        .from('asesor_cliente')
        .select('cliente_id, clientes(id, razon_social, nombre_comercial)')
        .eq('asesor_id', asesorId);

      if (clientError) {
        console.error('Error loading assigned clients:', clientError);
        setLoading(false);
        return;
      }

      const clientIds = assignedClients?.map(ac => ac.cliente_id) || [];
      console.log('ClientUploadFrequencyWidget - Assigned client IDs:', clientIds);

      // Get document upload data for each client
      const frequencyData: ClienteFrequency[] = [];

      for (const ac of assignedClients || []) {
        const { data: documents, error: docsError } = await supabaseAdmin
          .from('documentos')
          .select('fecha_subida')
          .eq('cliente_id', ac.cliente_id)
          .order('fecha_subida', { ascending: false });

        if (docsError) {
          console.error(`Error loading documents for client ${ac.cliente_id}:`, docsError);
        }

        const cliente = ac.clientes as any;
        if (!cliente) {
          console.warn(`No client data found for cliente_id: ${ac.cliente_id}`);
          continue;
        }

        const lastUpload = documents && documents.length > 0 
          ? new Date(documents[0].fecha_subida) 
          : null;
        
        const daysSinceUpload = lastUpload 
          ? Math.floor((Date.now() - lastUpload.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        // Calculate average days between uploads
        let avgDays = 0;
        if (documents && documents.length > 1) {
          const dates = documents.map(d => new Date(d.fecha_subida).getTime()).sort((a, b) => b - a);
          let totalDiff = 0;
          for (let i = 0; i < dates.length - 1; i++) {
            totalDiff += (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
          }
          avgDays = totalDiff / (dates.length - 1);
        } else if (documents && documents.length === 1) {
          // If only one document, use days since that upload as average
          avgDays = daysSinceUpload;
        }

        // Determine status
        let status: 'active' | 'warning' | 'critical' = 'active';
        if (daysSinceUpload > 30) status = 'critical';
        else if (daysSinceUpload > 15) status = 'warning';

        frequencyData.push({
          id: cliente.id,
          nombre: cliente.nombre_comercial || cliente.razon_social,
          lastUpload,
          daysSinceUpload,
          totalUploads: documents?.length || 0,
          avgDaysBetweenUploads: avgDays,
          status
        });
      }

      console.log('ClientUploadFrequencyWidget - Frequency data loaded:', frequencyData.length, 'clients');
      console.log('Status breakdown:', {
        active: frequencyData.filter(c => c.status === 'active').length,
        warning: frequencyData.filter(c => c.status === 'warning').length,
        critical: frequencyData.filter(c => c.status === 'critical').length
      });

      // Sort by days since upload (most critical first)
      frequencyData.sort((a, b) => b.daysSinceUpload - a.daysSinceUpload);

      setClientesFrequency(frequencyData);
    } catch (error) {
      console.error('Error loading frequency data:', error);
    } finally {
      setLoading(false);
    }
  }, [asesorId]);

  useEffect(() => {
    if (asesorId) {
      loadFrequencyData();
    }
  }, [asesorId, loadFrequencyData]);

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const mostFrequent = [...clientesFrequency]
    .sort((a, b) => a.avgDaysBetweenUploads - b.avgDaysBetweenUploads)
    .slice(0, 3);

  const leastFrequent = [...clientesFrequency]
    .filter(c => c.daysSinceUpload > 7)
    .sort((a, b) => b.daysSinceUpload - a.daysSinceUpload)
    .slice(0, 3);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">📊 Frecuencia de Subida</h2>
        <Link href="/asesor/clientes-detailed" className="text-sm text-asesor hover:underline">
          Ver detalles →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most Active */}
        <div>
          <h3 className="font-semibold text-green-700 mb-3 flex items-center space-x-2">
            <span>⬆️</span>
            <span>Más Activos</span>
          </h3>
          <div className="space-y-2">
            {mostFrequent.map((cliente, idx) => (
              <div key={cliente.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-2xl text-green-600">#{idx + 1}</span>
                      <p className="font-medium text-gray-900">{cliente.nombre}</p>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Sube cada {cliente.avgDaysBetweenUploads.toFixed(0)} días
                    </p>
                  </div>
                  <span className="badge badge-success text-xs">
                    {cliente.totalUploads} docs
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Least Active / Need Attention */}
        <div>
          <h3 className="font-semibold text-red-700 mb-3 flex items-center space-x-2">
            <span>⚠️</span>
            <span>Requieren Atención</span>
          </h3>
          <div className="space-y-2">
            {leastFrequent.map((cliente) => (
              <div 
                key={cliente.id} 
                className={`p-3 border rounded-lg ${
                  cliente.status === 'critical' 
                    ? 'bg-red-50 border-red-300' 
                    : 'bg-yellow-50 border-yellow-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{cliente.nombre}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {cliente.lastUpload 
                        ? `Última subida hace ${cliente.daysSinceUpload} días`
                        : 'Nunca ha subido documentos'
                      }
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      // Navigate to notification/reminder page
                      window.location.href = `/asesor/notificar-cliente?id=${cliente.id}`;
                    }}
                    className={`btn btn-sm ${
                      cliente.status === 'critical' ? 'btn-danger' : 'btn-warning'
                    }`}
                  >
                    Notificar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {clientesFrequency.filter(c => c.status === 'active').length}
            </div>
            <div className="text-xs text-gray-600">Activos</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {clientesFrequency.filter(c => c.status === 'warning').length}
            </div>
            <div className="text-xs text-gray-600">Advertencia</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {clientesFrequency.filter(c => c.status === 'critical').length}
            </div>
            <div className="text-xs text-gray-600">Crítico</div>
          </div>
        </div>
      </div>
    </div>
  );
}
