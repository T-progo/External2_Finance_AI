import { useState } from 'react';
import Layout from '@/components/Layout';

interface FechaFiscal {
  id: string;
  titulo: string;
  fecha: Date;
  tipo: 'iva' | 'irpf' | 'sociedades' | 'modelo' | 'otro';
  descripcion: string;
  completado: boolean;
}

export default function ClienteCalendario() {
  const [fechasFiscales] = useState<FechaFiscal[]>([
    {
      id: '1',
      titulo: 'IVA 4º Trimestre 2024',
      fecha: new Date('2025-01-30'),
      tipo: 'iva',
      descripcion: 'Presentación del IVA del último trimestre de 2024',
      completado: true,
    },
    {
      id: '2',
      titulo: 'IRPF 1º Trimestre 2025',
      fecha: new Date('2025-04-20'),
      tipo: 'irpf',
      descripcion: 'Pago fraccionado del IRPF correspondiente al primer trimestre',
      completado: false,
    },
    {
      id: '3',
      titulo: 'IVA 1º Trimestre 2025',
      fecha: new Date('2025-04-20'),
      tipo: 'iva',
      descripcion: 'Presentación del IVA del primer trimestre de 2025',
      completado: false,
    },
    {
      id: '4',
      titulo: 'Modelo 111 - Retenciones Marzo',
      fecha: new Date('2025-04-20'),
      tipo: 'modelo',
      descripcion: 'Retenciones e ingresos a cuenta de rendimientos del trabajo',
      completado: false,
    },
    {
      id: '5',
      titulo: 'Declaración de la Renta 2024',
      fecha: new Date('2025-06-30'),
      tipo: 'irpf',
      descripcion: 'Presentación de la declaración anual del IRPF',
      completado: false,
    },
  ]);

  const [mesMostrado, setMesMostrado] = useState(new Date());

  const getTipoColor = (tipo: FechaFiscal['tipo']) => {
    switch (tipo) {
      case 'iva':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'irpf':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'sociedades':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'modelo':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTipoIcon = (tipo: FechaFiscal['tipo']) => {
    switch (tipo) {
      case 'iva':
        return '📊';
      case 'irpf':
        return '💰';
      case 'sociedades':
        return '🏢';
      case 'modelo':
        return '📋';
      default:
        return '📅';
    }
  };

  const fechasProximas = fechasFiscales
    .filter(f => !f.completado && f.fecha >= new Date())
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .slice(0, 5);

  const fechasCompletadas = fechasFiscales.filter(f => f.completado).length;

  return (
    <Layout rol="cliente">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendario Fiscal</h1>
          <p className="text-gray-600 mt-1">Fechas importantes y recordatorios</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Próximas Obligaciones</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{fechasProximas.length}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Completadas este Año</div>
            <div className="text-2xl font-bold text-success mt-1">{fechasCompletadas}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Total Obligaciones</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{fechasFiscales.length}</div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">📅</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">No te preocupes</h3>
              <p className="text-sm text-blue-800">
                Tu asesor se encarga de todas las fechas importantes y te avisará con antelación.
                Este calendario es solo para que estés informado.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Próximas Fechas Importantes</h3>
          <div className="space-y-3">
            {fechasProximas.map(fecha => {
              const diasRestantes = Math.ceil(
                (fecha.fecha.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              
              return (
                <div
                  key={fecha.id}
                  className={`border-2 rounded-lg p-4 ${getTipoColor(fecha.tipo)}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl">{getTipoIcon(fecha.tipo)}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-gray-900">{fecha.titulo}</h4>
                          <p className="text-sm text-gray-700 mt-1">{fecha.descripcion}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">
                            {fecha.fecha.toLocaleDateString('es-ES', { 
                              day: 'numeric', 
                              month: 'short',
                              year: 'numeric' 
                            })}
                          </div>
                          <div className={`text-xs mt-1 font-medium ${
                            diasRestantes <= 7 ? 'text-red-600' :
                            diasRestantes <= 30 ? 'text-yellow-600' :
                            'text-gray-600'
                          }`}>
                            {diasRestantes <= 0 ? 'Hoy' :
                             diasRestantes === 1 ? 'Mañana' :
                             `En ${diasRestantes} días`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {fechasProximas.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  ¡Todo al día!
                </h3>
                <p className="text-gray-600">
                  No tienes obligaciones fiscales pendientes próximamente
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Obligaciones Completadas</h3>
          <div className="space-y-2">
            {fechasFiscales
              .filter(f => f.completado)
              .map(fecha => (
                <div
                  key={fecha.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">✅</div>
                    <div>
                      <div className="font-medium text-gray-900">{fecha.titulo}</div>
                      <div className="text-sm text-gray-600">
                        {fecha.fecha.toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-green-600 font-medium">Completado</span>
                </div>
              ))}

            {fechasCompletadas === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No hay obligaciones completadas todavía
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
