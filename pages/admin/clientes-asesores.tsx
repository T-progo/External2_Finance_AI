import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { Cliente, User, ModulosActivos } from '@/types';
import { getClientes, getDocumentos, getIncidencias, getAllUsers, getDatosFinancieros, updateCliente, setAdvisorClients } from '@/lib/supabaseService';
import DataTable from '@/components/DataTable';
import FilterBar, { Filter } from '@/components/FilterBar';
import Dialog from '@/components/Dialog';
import toast from 'react-hot-toast';

export default function AdminClientesAsesores() {
  const router = useRouter();
  const initialVista = router.query.vista === 'asesores' ? 'asesores' : 'clientes';
  const [vistaActiva, setVistaActiva] = useState<'clientes' | 'asesores'>(initialVista);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [asesores, setAsesores] = useState<User[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [mostrarModal, setMostrarModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<User | null>(null);
  const [asesoresSeleccionadosCliente, setAsesoresSeleccionadosCliente] = useState<string[]>([]);
  const [clientesSeleccionadosAsesor, setClientesSeleccionadosAsesor] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [filtroAsesoresCliente, setFiltroAsesoresCliente] = useState('');
  const [filtroClientesAsesor, setFiltroClientesAsesor] = useState('');
  const [modulosClienteEdit, setModulosClienteEdit] = useState<ModulosActivos | null>(null);

  useEffect(() => {
    if (router.query.vista === 'asesores') {
      setVistaActiva('asesores');
    } else if (router.query.vista === 'clientes') {
      setVistaActiva('clientes');
    }
  }, [router.query.vista]);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [clientesDb, usuariosDb, documentosDb, incidenciasDb] = await Promise.all([
          getClientes(),
          getAllUsers(),
          getDocumentos(),
          getIncidencias(),
        ]);

        setClientes(clientesDb);
        setAsesores(usuariosDb.filter(u => u.rol === 'asesor'));
        setDocumentos(documentosDb);
        setIncidencias(incidenciasDb);
      } catch (error) {
        console.error('Error cargando datos de clientes/asesores:', error);
      }
    };

    cargarDatos();
  }, []);

  const asesoresFiltradosParaCliente = asesores.filter((asesor) => {
    if (!filtroAsesoresCliente) return true;
    const term = filtroAsesoresCliente.toLowerCase();
    return (
      asesor.nombre.toLowerCase().includes(term) ||
      asesor.email.toLowerCase().includes(term)
    );
  });

  const clientesFiltradosParaAsesor = clientes.filter((cliente) => {
    if (!filtroClientesAsesor) return true;
    const term = filtroClientesAsesor.toLowerCase();
    return (
      cliente.razonSocial.toLowerCase().includes(term) ||
      cliente.nif.toLowerCase().includes(term)
    );
  });

  const filterConfigClientes: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'Razón social, NIF...',
    },
    {
      key: 'asesor',
      label: 'Asesor Asignado',
      type: 'select',
      options: asesores.map(a => ({ value: a.id, label: a.nombre })),
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'activo', label: 'Activo' },
        { value: 'inactivo', label: 'Inactivo' },
      ],
    },
  ];

  const clientesFiltrados = clientes.filter(cliente => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      if (!cliente.razonSocial.toLowerCase().includes(busqueda) && 
          !cliente.nif.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.asesor && !cliente.asesoresAsignados.includes(filtros.asesor)) return false;
    if (filtros.estado && cliente.estado !== filtros.estado) return false;
    return true;
  });

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros({ ...filtros, [key]: value });
  };

  const handleLimpiarFiltros = () => {
    setFiltros({});
  };

  const handleVerCliente = (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    // Ensure we create a new array and filter out any invalid IDs
    const asesoresIds = Array.isArray(cliente.asesoresAsignados) 
      ? cliente.asesoresAsignados.filter(id => id && typeof id === 'string')
      : [];
    setAsesoresSeleccionadosCliente([...asesoresIds]);
    // Initialize modulosClienteEdit with default values if missing
    const defaultModulos: ModulosActivos = {
      subidaDocumentos: false,
      incidencias: false,
      asistenteE2: false,
      panelFinanciero: false,
      facturacion: false,
    };
    setModulosClienteEdit(cliente.modulosActivos ? { ...cliente.modulosActivos } : { ...defaultModulos });
    setFiltroAsesoresCliente('');
    setMostrarModal(true);
  };

  const handleVerAsesor = (asesor: User) => {
    setAsesorSeleccionado(asesor);
    // Get currently assigned clients for this advisor
    const actuales = clientes
      .filter(c => Array.isArray(c.asesoresAsignados) && c.asesoresAsignados.includes(asesor.id))
      .map(c => c.id)
      .filter(id => id && typeof id === 'string'); // Ensure valid IDs
    setClientesSeleccionadosAsesor([...actuales]);
    setFiltroClientesAsesor('');
    setMostrarModal(true);
  };

  const handleGuardarAsesoresCliente = async () => {
    if (!clienteSeleccionado) return;
    setSaving(true);
    try {
      // Validate and filter advisor IDs to ensure they exist in the advisors list
      const validAsesorIds = asesoresSeleccionadosCliente.filter(id => {
        const exists = asesores.some(a => a.id === id);
        if (!exists) {
          console.warn(`Advisor ID ${id} not found in advisors list`);
        }
        return exists && id && typeof id === 'string';
      });
      
      console.log('Guardando asesores para cliente:', clienteSeleccionado.id);
      console.log('Asesores seleccionados (original):', asesoresSeleccionadosCliente);
      console.log('Asesores seleccionados (validados):', validAsesorIds);
      
      // Check if modulosActivos actually changed
      // Always compare with a default object if clienteSeleccionado.modulosActivos is missing
      const originalModulos = clienteSeleccionado.modulosActivos || {
        subidaDocumentos: false,
        incidencias: false,
        asistenteE2: false,
        panelFinanciero: false,
        facturacion: false,
      };
      
      const modulosChanged = modulosClienteEdit !== null &&
        JSON.stringify(modulosClienteEdit) !== JSON.stringify(originalModulos);
      
      // Build update object - include modulosActivos if they were edited
      const updateData: any = {
        asesoresAsignados: validAsesorIds,
      };
      
      if (modulosClienteEdit !== null) {
        updateData.modulosActivos = modulosClienteEdit;
        if (modulosChanged) {
          console.log('Módulos activos han cambiado, se actualizarán');
        } else {
          console.log('Módulos activos se incluirán en la actualización (sin cambios detectados)');
        }
      }
      
      await updateCliente(clienteSeleccionado.id, updateData);

      console.log('Cliente actualizado, recargando datos...');
      const [clientesDb, usuariosDb, documentosDb, incidenciasDb] = await Promise.all([
        getClientes(),
        getAllUsers(),
        getDocumentos(),
        getIncidencias(),
      ]);

      setClientes(clientesDb);
      setAsesores(usuariosDb.filter(u => u.rol === 'asesor'));
      setDocumentos(documentosDb);
      setIncidencias(incidenciasDb);

      toast.success('Cliente actualizado correctamente');
      setMostrarModal(false);
      setClienteSeleccionado(null);
      setAsesoresSeleccionadosCliente([]);
      setModulosClienteEdit(null);
    } catch (error: any) {
      console.error('Error actualizando asesores del cliente:', error);
      
      // Check for CORS or network errors
      const errorMessage = error.message || '';
      if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_FAILED')) {
        toast.error(
          'Error de conexión. Verifica que la clave de servicio de Supabase esté configurada correctamente en las variables de entorno.',
          { duration: 5000 }
        );
      } else {
        toast.error(errorMessage || 'Error al actualizar asesores del cliente');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarClientesAsesor = async () => {
    if (!asesorSeleccionado) return;
    setSaving(true);
    try {
      // Validate and filter client IDs to ensure they exist in the clients list
      const validClienteIds = clientesSeleccionadosAsesor.filter(id => {
        const exists = clientes.some(c => c.id === id);
        if (!exists) {
          console.warn(`Client ID ${id} not found in clients list`);
        }
        return exists && id && typeof id === 'string';
      });
      
      console.log('Guardando clientes para asesor:', asesorSeleccionado.id);
      console.log('Clientes seleccionados (original):', clientesSeleccionadosAsesor);
      console.log('Clientes seleccionados (validados):', validClienteIds);
      
      await setAdvisorClients(asesorSeleccionado.id, validClienteIds);

      console.log('Asesor actualizado, recargando datos...');
      const [clientesDb, usuariosDb, documentosDb, incidenciasDb] = await Promise.all([
        getClientes(),
        getAllUsers(),
        getDocumentos(),
        getIncidencias(),
      ]);

      setClientes(clientesDb);
      setAsesores(usuariosDb.filter(u => u.rol === 'asesor'));
      setDocumentos(documentosDb);
      setIncidencias(incidenciasDb);

      toast.success('Clientes del asesor actualizados');
      setMostrarModal(false);
      setAsesorSeleccionado(null);
      setClientesSeleccionadosAsesor([]);
    } catch (error: any) {
      console.error('Error actualizando clientes del asesor:', error);
      
      // Check for CORS or network errors
      const errorMessage = error.message || '';
      if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_FAILED')) {
        toast.error(
          'Error de conexión. Verifica que la clave de servicio de Supabase esté configurada correctamente en las variables de entorno.',
          { duration: 5000 }
        );
      } else {
        toast.error(errorMessage || 'Error al actualizar clientes del asesor');
      }
    } finally {
      setSaving(false);
    }
  };

  const getAsesorNombre = (asesorId: string) => {
    const asesor = asesores.find(a => a.id === asesorId);
    return asesor?.nombre || 'Sin asignar';
  };

  const getClienteEstadisticas = (clienteId: string) => {
    const docs = (documentos || []).filter(d => d.clienteId === clienteId);
    const incs = (incidencias || []).filter(i => i.clienteId === clienteId);
    return {
      documentos: docs.length || 0,
      pendientes: docs.filter(d => d.estado === 'pendiente').length || 0,
      incidencias: incs.filter(i => i.estado !== 'cerrada').length || 0,
    };
  };

  const getAsesorEstadisticas = (asesorId: string) => {
    const clientesAsignados = (clientes || []).filter(c => 
      Array.isArray(c.asesoresAsignados) && c.asesoresAsignados.includes(asesorId)
    );
    const docs = (documentos || []).filter(d => d.asesorId === asesorId);
    const incs = (incidencias || []).filter(i => i.asesorId === asesorId);
    return {
      clientes: clientesAsignados.length || 0,
      documentos: docs.length || 0,
      pendientes: docs.filter(d => d.estado === 'pendiente').length || 0,
      incidencias: incs.filter(i => i.estado !== 'cerrada').length || 0,
    };
  };

  const columnasClientes = [
    {
      key: 'razonSocial',
      header: 'Cliente',
      sortable: true,
      render: (cliente: Cliente) => (
        <div>
          <div className="font-medium text-gray-900">{cliente.razonSocial}</div>
          <div className="text-sm text-gray-500">NIF: {cliente.nif}</div>
        </div>
      ),
    },
    {
      key: 'personaContacto',
      header: 'Contacto',
      render: (cliente: Cliente) => (
        <div>
          <div className="text-sm text-gray-900">{cliente.personaContacto}</div>
          <div className="text-xs text-gray-500">{cliente.email}</div>
          <div className="text-xs text-gray-500">{cliente.telefono}</div>
        </div>
      ),
    },
    {
      key: 'asesor',
      header: 'Asesor',
      render: (cliente: Cliente) => (
        <div className="text-sm text-gray-900">
          {cliente.asesoresAsignados.map(id => getAsesorNombre(id)).join(', ')}
        </div>
      ),
    },
    {
      key: 'estadisticas',
      header: 'Estadísticas',
      render: (cliente: Cliente) => {
        const stats = getClienteEstadisticas(cliente.id);
        return (
          <div className="text-xs space-y-1">
            <div>📄 {stats.documentos} docs ({stats.pendientes} pendientes)</div>
            <div>⚠️ {stats.incidencias} incidencias</div>
          </div>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (cliente: Cliente) => (
        <span className={`badge ${cliente.estado === 'activo' ? 'badge-success' : 'badge-secondary'}`}>
          {cliente.estado === 'activo' ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ];

  const columnasAsesores = [
    {
      key: 'nombre',
      header: 'Asesor',
      sortable: true,
      render: (asesor: User) => (
        <div>
          <div className="font-medium text-gray-900">{asesor.nombre}</div>
          <div className="text-sm text-gray-500">{asesor.email}</div>
        </div>
      ),
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (asesor: User) => asesor.telefono || '-',
    },
    {
      key: 'estadisticas',
      header: 'Cartera',
      render: (asesor: User) => {
        const stats = getAsesorEstadisticas(asesor.id);
        return (
          <div className="text-xs space-y-1">
            <div>👥 {stats.clientes} clientes</div>
            <div>📄 {stats.documentos} docs ({stats.pendientes} pendientes)</div>
            <div>⚠️ {stats.incidencias} incidencias</div>
          </div>
        );
      },
    },
    {
      key: 'ultimoAcceso',
      header: 'Último Acceso',
      sortable: true,
      render: (asesor: User) => 
        asesor.ultimoAcceso 
          ? new Date(asesor.ultimoAcceso).toLocaleDateString('es-ES')
          : '-',
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (asesor: User) => (
        <span className={`badge ${asesor.estado === 'activo' ? 'badge-success' : 'badge-secondary'}`}>
          {asesor.estado === 'activo' ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ];

  const estadisticasGenerales = {
    totalClientes: (clientes || []).length || 0,
    clientesActivos: (clientes || []).filter(c => c.estado === 'activo').length || 0,
    totalAsesores: (asesores || []).length || 0,
    asesoresActivos: (asesores || []).filter(a => a.estado === 'activo').length || 0,
    promedioPorAsesor: (asesores || []).length > 0 
      ? Math.round(((clientes || []).length / (asesores || []).length) || 0) 
      : 0,
  };

  return (
    <Layout rol="admin">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clientes y Asesores</h1>
          <p className="text-gray-600 mt-1">Gestión de relaciones, asignaciones y estadísticas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total Clientes</div>
            <div className="text-2xl font-bold text-cliente mt-1">{estadisticasGenerales.totalClientes}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Clientes Activos</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticasGenerales.clientesActivos}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Total Asesores</div>
            <div className="text-2xl font-bold text-asesor mt-1">{estadisticasGenerales.totalAsesores}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Asesores Activos</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticasGenerales.asesoresActivos}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Promedio por Asesor</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {isNaN(estadisticasGenerales.promedioPorAsesor) ? 0 : estadisticasGenerales.promedioPorAsesor}
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setVistaActiva('clientes')}
            className={`btn ${vistaActiva === 'clientes' ? 'btn-admin' : 'btn-secondary'}`}
          >
            Ver Clientes
          </button>
          <button
            onClick={() => setVistaActiva('asesores')}
            className={`btn ${vistaActiva === 'asesores' ? 'btn-admin' : 'btn-secondary'}`}
          >
            Ver Asesores
          </button>
        </div>

        {vistaActiva === 'clientes' && (
          <>
            <FilterBar
              filters={filterConfigClientes}
              values={filtros}
              onChange={handleFiltroChange}
              onClear={handleLimpiarFiltros}
            />

            <div className="card">
              <DataTable
                data={clientesFiltrados}
                columns={columnasClientes}
                onRowClick={handleVerCliente}
                actions={(cliente) => (
                  <button
                    onClick={() => handleVerCliente(cliente)}
                    className="text-blue-600 hover:text-blue-900"
                    title="Ver detalles"
                  >
                    👁️
                  </button>
                )}
              />
            </div>
          </>
        )}

        {vistaActiva === 'asesores' && (
          <div className="card">
            <DataTable
              data={asesores}
              columns={columnasAsesores}
              onRowClick={handleVerAsesor}
              actions={(asesor) => (
                <button
                  onClick={() => handleVerAsesor(asesor)}
                  className="text-blue-600 hover:text-blue-900"
                  title="Ver detalles"
                >
                  👁️
                </button>
              )}
            />
          </div>
        )}

        <Dialog
          isOpen={mostrarModal && clienteSeleccionado !== null}
          onClose={() => {
            setMostrarModal(false);
            setClienteSeleccionado(null);
            setAsesoresSeleccionadosCliente([]);
            setModulosClienteEdit(null);
            setFiltroAsesoresCliente('');
          }}
          closeOnBackdrop= {false}
          closeOnEscape= {false}
          title={
            clienteSeleccionado && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{clienteSeleccionado.razonSocial}</h2>
                <p className="text-gray-600">NIF: {clienteSeleccionado.nif}</p>
              </div>
            )
          }
          maxWidth="4xl"
          footer={
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setMostrarModal(false);
                  setClienteSeleccionado(null);
                  setAsesoresSeleccionadosCliente([]);
                  setModulosClienteEdit(null);
                  setFiltroAsesoresCliente('');
                }}
                className="btn btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarAsesoresCliente}
                className="btn btn-admin"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          }
        >
          {clienteSeleccionado && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Información General</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600">Nombre Comercial:</span>
                      <p className="font-medium">{clienteSeleccionado.nombreComercial || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Persona de Contacto:</span>
                      <p className="font-medium">{clienteSeleccionado.personaContacto}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Email:</span>
                      <p className="font-medium">{clienteSeleccionado.email}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Teléfono:</span>
                      <p className="font-medium">{clienteSeleccionado.telefono}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Dirección Fiscal:</span>
                      <p className="font-medium">{clienteSeleccionado.direccionFiscal}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Fecha Alta:</span>
                      <p className="font-medium">{new Date(clienteSeleccionado.fechaAlta).toLocaleDateString('es-ES')}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Asesores Asignados</h3>
                  <div className="mb-3">
                    <input
                      type="text"
                      value={filtroAsesoresCliente}
                      onChange={(e) => setFiltroAsesoresCliente(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Buscar asesor por nombre o email"
                    />
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {asesoresFiltradosParaCliente.map((asesor) => (
                      <label key={asesor.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={asesoresSeleccionadosCliente.includes(asesor.id)}
                          onChange={(e) => {
                            const asesorId = asesor.id;
                            if (e.target.checked) {
                              // Only add if not already in the list
                              if (!asesoresSeleccionadosCliente.includes(asesorId)) {
                                setAsesoresSeleccionadosCliente([
                                  ...asesoresSeleccionadosCliente,
                                  asesorId,
                                ]);
                              }
                            } else {
                              // Remove the advisor from the list
                              setAsesoresSeleccionadosCliente(
                                asesoresSeleccionadosCliente.filter(id => id !== asesorId)
                              );
                            }
                          }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{asesor.nombre}</p>
                          <p className="text-sm text-gray-600">{asesor.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Estadísticas</h3>
                  {(() => {
                    const stats = getClienteEstadisticas(clienteSeleccionado.id);
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-600">Documentos</p>
                          <p className="text-2xl font-bold text-blue-900">{stats.documentos}</p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg">
                          <p className="text-sm text-yellow-600">Pendientes</p>
                          <p className="text-2xl font-bold text-yellow-900">{stats.pendientes}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg">
                          <p className="text-sm text-red-600">Incidencias</p>
                          <p className="text-2xl font-bold text-red-900">{stats.incidencias}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Módulos Activos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[ 
                      { key: 'subidaDocumentos', label: 'subida Documentos' },
                      { key: 'incidencias', label: 'incidencias' },
                      { key: 'asistenteE2', label: 'asistente E2' },
                      { key: 'panelFinanciero', label: 'panel Financiero' },
                      { key: 'facturacion', label: 'facturacion' },
                    ].map((modulo) => {
                      // Always use modulosClienteEdit if it exists, otherwise fall back to clienteSeleccionado.modulosActivos or defaults
                      const currentModulos = modulosClienteEdit || clienteSeleccionado.modulosActivos || {
                        subidaDocumentos: false,
                        incidencias: false,
                        asistenteE2: false,
                        panelFinanciero: false,
                        facturacion: false,
                      };
                      const activo = currentModulos[modulo.key as keyof ModulosActivos] || false;
                      return (
                        <label
                          key={modulo.key}
                          className={`p-3 rounded-lg border-2 text-left w-full cursor-pointer transition-all ${
                            activo ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={activo}
                              onChange={(e) => {
                                // Ensure we always have a valid object to modify
                                const current = modulosClienteEdit || clienteSeleccionado.modulosActivos || {
                                  subidaDocumentos: false,
                                  incidencias: false,
                                  asistenteE2: false,
                                  panelFinanciero: false,
                                  facturacion: false,
                                };
                                setModulosClienteEdit({
                                  ...current,
                                  [modulo.key]: e.target.checked,
                                });
                              }}
                              className={`w-4 h-4 rounded border-2 focus:ring-2 focus:ring-offset-0 cursor-pointer ${
                                activo
                                  ? 'border-green-600 bg-green-600 accent-green-600 focus:ring-green-500'
                                  : 'border-gray-400 bg-white accent-gray-400 focus:ring-gray-400'
                              }`}
                            />
                            <span className={`text-sm font-medium ${
                              activo ? 'text-green-900' : 'text-gray-600'
                            }`}>
                              {modulo.label}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
            </div>
          )}
        </Dialog>

        <Dialog
          isOpen={mostrarModal && asesorSeleccionado !== null}
          onClose={() => {
            setMostrarModal(false);
            setAsesorSeleccionado(null);
            setClientesSeleccionadosAsesor([]);
            setFiltroClientesAsesor('');
          }}
          closeOnBackdrop= {false}
          closeOnEscape= {false}
          title={
            asesorSeleccionado && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{asesorSeleccionado.nombre}</h2>
                <p className="text-gray-600">{asesorSeleccionado.email}</p>
              </div>
            )
          }
          maxWidth="4xl"
          footer={
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setMostrarModal(false);
                  setAsesorSeleccionado(null);
                  setClientesSeleccionadosAsesor([]);
                  setFiltroClientesAsesor('');
                }}
                className="btn btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarClientesAsesor}
                className="btn btn-admin"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          }
        >
          {asesorSeleccionado && (() => {
            const stats = getAsesorEstadisticas(asesorSeleccionado.id);
            const clientesAsignados = clientes.filter(c => clientesSeleccionadosAsesor.includes(c.id));
            
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card">
                    <div className="text-sm text-gray-600">Clientes</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.clientes}</div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Documentos</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.documentos}</div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Pendientes</div>
                    <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.pendientes}</div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Incidencias</div>
                    <div className="text-2xl font-bold text-red-600 mt-1">{stats.incidencias}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Clientes Asignados ({clientesAsignados.length})</h3>
                  <div className="mb-3">
                    <input
                      type="text"
                      value={filtroClientesAsesor}
                      onChange={(e) => setFiltroClientesAsesor(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Buscar cliente por nombre o NIF"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                    {clientesFiltradosParaAsesor.map(cliente => (
                      <label
                        key={cliente.id}
                        className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={clientesSeleccionadosAsesor.includes(cliente.id)}
                          onChange={(e) => {
                            const clienteId = cliente.id;
                            if (e.target.checked) {
                              // Only add if not already in the list
                              if (!clientesSeleccionadosAsesor.includes(clienteId)) {
                                setClientesSeleccionadosAsesor([
                                  ...clientesSeleccionadosAsesor,
                                  clienteId,
                                ]);
                              }
                            } else {
                              // Remove the client from the list
                              setClientesSeleccionadosAsesor(
                                clientesSeleccionadosAsesor.filter(id => id !== clienteId)
                              );
                            }
                          }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{cliente.razonSocial}</p>
                          <p className="text-sm text-gray-600">{cliente.nif}</p>
                          <p className="text-xs text-gray-500 mt-1">{cliente.personaContacto}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </Dialog>
      </div>
    </Layout>
  );
}
