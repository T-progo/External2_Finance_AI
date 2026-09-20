import { useState } from 'react';
import Layout from '@/components/Layout';
import { Incidencia, IncidentStatus, IncidentOrigin } from '@/types';
import { mockIncidencias, mockClientes, getClienteById } from '@/lib/mockData';
import DataTable from '@/components/DataTable';
import FilterBar, { Filter } from '@/components/FilterBar';
import IncidentChat from '@/components/IncidentChat';

export default function AdminIncidencias() {
  const [incidencias] = useState<Incidencia[]>(mockIncidencias);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState<Incidencia | null>(null);
  const [mostrarChat, setMostrarChat] = useState(false);

  const filterConfig: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'ID incidencia, cliente...',
    },
    {
      key: 'cliente',
      label: 'Cliente',
      type: 'select',
      options: mockClientes.map(c => ({ value: c.id, label: c.razonSocial })),
    },
    {
      key: 'origen',
      label: 'Origen',
      type: 'select',
      options: [
        { value: 'ia', label: 'IA' },
        { value: 'manual', label: 'Manual' },
        { value: 'asesor', label: 'Asesor' },
      ],
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'nueva', label: 'Nueva' },
        { value: 'en_revision', label: 'En Revisión' },
        { value: 'resuelta', label: 'Resuelta' },
        { value: 'cerrada', label: 'Cerrada' },
      ],
    },
  ];

  const incidenciasFiltradas = incidencias.filter(inc => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      const cliente = getClienteById(inc.clienteId);
      if (!inc.id.toLowerCase().includes(busqueda) && 
          !cliente?.razonSocial.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.cliente && inc.clienteId !== filtros.cliente) return false;
    if (filtros.origen && inc.origen !== filtros.origen) return false;
    if (filtros.estado && inc.estado !== filtros.estado) return false;
    return true;
  });

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros({ ...filtros, [key]: value });
  };

  const handleLimpiarFiltros = () => {
    setFiltros({});
  };

  const handleVerIncidencia = (inc: Incidencia) => {
    setIncidenciaSeleccionada(inc);
    setMostrarChat(true);
  };

  const getEstadoBadge = (estado: IncidentStatus) => {
    const badges: Record<IncidentStatus, string> = {
      nueva: 'badge-warning',
      en_revision: 'badge-info',
      resuelta: 'badge-success',
      cerrada: 'badge-secondary',
    };
    
    const labels: Record<IncidentStatus, string> = {
      nueva: '🟡 Nueva',
      en_revision: '🟠 En Revisión',
      resuelta: '🟢 Resuelta',
      cerrada: '⚪ Cerrada',
    };
    
    return <span className={`badge ${badges[estado]}`}>{labels[estado]}</span>;
  };

  const getOrigenBadge = (origen: IncidentOrigin) => {
    const badges: Record<IncidentOrigin, string> = {
      ia: 'badge-info',
      manual: 'badge-warning',
      asesor: 'badge-asesor',
    };
    
    const labels: Record<IncidentOrigin, string> = {
      ia: '🤖 IA',
      manual: '✋ Manual',
      asesor: '👔 Asesor',
    };
    
    return <span className={`badge ${badges[origen]}`}>{labels[origen]}</span>;
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (inc: Incidencia) => (
        <div className="font-medium text-gray-900">{inc.id}</div>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (inc: Incidencia) => {
        const cliente = getClienteById(inc.clienteId);
        return <div className="text-sm text-gray-900">{cliente?.razonSocial || '-'}</div>;
      },
    },
    {
      key: 'origen',
      header: 'Origen',
      sortable: true,
      render: (inc: Incidencia) => getOrigenBadge(inc.origen),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (inc: Incidencia) => getEstadoBadge(inc.estado),
    },
    {
      key: 'mensajes',
      header: 'Mensajes',
      render: (inc: Incidencia) => (
        <div className="text-sm text-gray-600">{inc.mensajes.length}</div>
      ),
    },
    {
      key: 'fechaCreacion',
      header: 'Creada',
      sortable: true,
      render: (inc: Incidencia) => new Date(inc.fechaCreacion).toLocaleDateString('es-ES'),
    },
    {
      key: 'ultimaRespuesta',
      header: 'Última Actualización',
      sortable: true,
      render: (inc: Incidencia) => 
        inc.fechaUltimaRespuesta 
          ? new Date(inc.fechaUltimaRespuesta).toLocaleDateString('es-ES')
          : '-',
    },
  ];

  const estadisticas = {
    total: incidencias.length,
    nuevas: incidencias.filter(i => i.estado === 'nueva').length,
    enRevision: incidencias.filter(i => i.estado === 'en_revision').length,
    resueltas: incidencias.filter(i => i.estado === 'resuelta').length,
    ia: incidencias.filter(i => i.origen === 'ia').length,
    tasaResolucion: incidencias.length > 0 
      ? Math.round((incidencias.filter(i => i.estado === 'resuelta' || i.estado === 'cerrada').length / incidencias.length) * 100)
      : 0,
  };

  return (
    <Layout rol="admin">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incidencias Globales</h1>
          <p className="text-gray-600 mt-1">Supervisión, métricas IA y control de calidad</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{estadisticas.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Nuevas</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{estadisticas.nuevas}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">En Revisión</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{estadisticas.enRevision}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Resueltas</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{estadisticas.resueltas}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Origen IA</div>
            <div className="text-2xl font-bold text-info mt-1">{estadisticas.ia}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Tasa Resolución</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticas.tasaResolucion}%</div>
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
            data={incidenciasFiltradas}
            columns={columns}
            onRowClick={handleVerIncidencia}
            actions={(inc) => (
              <button
                onClick={() => handleVerIncidencia(inc)}
                className="text-blue-600 hover:text-blue-900"
                title="Ver chat"
              >
                💬
              </button>
            )}
          />
        </div>

        {mostrarChat && incidenciaSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh]">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Incidencia {incidenciaSeleccionada.id}</h2>
                <button
                  onClick={() => {
                    setMostrarChat(false);
                    setIncidenciaSeleccionada(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="h-[600px]">
                <IncidentChat 
                  incidencia={incidenciaSeleccionada} 
                  currentUserRole="admin"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
