import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Cliente, Documento, DatosFinancieros } from '@/types';
import DataTable from '@/components/DataTable';
import FilterBar, { Filter } from '@/components/FilterBar';
import { useAuth } from '@/lib/authContext';
import Dialog from '@/components/Dialog';
import toast from 'react-hot-toast';
import { createClienteWithUser, getClientes, getDocumentos, getDatosFinancieros } from '@/lib/supabaseService';

export default function AsesorClientes() {
  const { user, signup } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [datosFinancieros, setDatosFinancieros] = useState<Record<string, DatosFinancieros>>({});
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch clients and related data from database
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      
      try {
        setLoadingData(true);
        
        // Fetch clients assigned to this asesor
        const clientesData = await getClientes(user.id);
        setClientes(clientesData);
        
        // Fetch all documents for these clients
        const clienteIds = clientesData.map(c => c.id);
        const allDocs: Documento[] = [];
        for (const clienteId of clienteIds) {
          const docs = await getDocumentos(clienteId);
          allDocs.push(...docs);
        }
        setDocumentos(allDocs);
        
        // Fetch financial data for each client
        const financialData: Record<string, DatosFinancieros> = {};
        for (const clienteId of clienteIds) {
          const datos = await getDatosFinancieros(clienteId);
          if (datos) {
            financialData[clienteId] = datos;
          }
        }
        setDatosFinancieros(financialData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error al cargar los datos');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const filterConfig: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'Razón social, NIF...',
    },
    {
      key: 'activo',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'activo', label: 'Activo' },
        { value: 'inactivo', label: 'Inactivo' },
      ],
    },
  ];

  const clientesFiltrados = clientes.filter(c => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      if (!c.razonSocial.toLowerCase().includes(busqueda) && 
          !c.nif.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.activo === 'activo' && c.estado !== 'activo') return false;
    if (filtros.activo === 'inactivo' && c.estado !== 'inactivo') return false;
    return true;
  });

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros({ ...filtros, [key]: value });
  };

  const handleLimpiarFiltros = () => {
    setFiltros({});
  };

  const handleVerDetalle = (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    setMostrarDetalle(true);
  };

  const handleCrearCliente = () => {
    setNuevoCliente({
      razonSocial: '',
      nif: '',
      email: '',
      tipoCliente: 'empresa',
      personaContacto: '',
      telefono: '',
      nombreComercial: '',
      direccionFiscal: '',
      modulosActivos: {
        subidaDocumentos: true,
        incidencias: true,
        asistenteE2: false,
        panelFinanciero: false,
        facturacion: false,
      }
    });
    setPassword('');
    setMostrarModalCrear(true);
  };

  const handleGuardarNuevoCliente = async () => {
    if (!nuevoCliente) return;

    // Validate required fields
    if (!nuevoCliente.razonSocial || !nuevoCliente.nif || !nuevoCliente.email) {
      toast.error('Razón social, NIF y email son requeridos');
      return;
    }
    if (!password || password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create client user with authentication
      const userId = await signup(nuevoCliente.email, password, nuevoCliente.personaContacto || nuevoCliente.razonSocial, 'cliente');
      
      if (!userId) {
        throw new Error('No se pudo crear el usuario');
      }

      // Step 2: Create cliente record in database with user_id
      const clienteData: Omit<Cliente, 'id' | 'fechaAlta'> = {
        nif: nuevoCliente.nif,
        razonSocial: nuevoCliente.razonSocial,
        nombreComercial: nuevoCliente.nombreComercial || '',
        tipoCliente: nuevoCliente.tipoCliente || 'empresa',
        personaContacto: nuevoCliente.personaContacto || '',
        telefono: nuevoCliente.telefono || '',
        email: nuevoCliente.email,
        direccionFiscal: nuevoCliente.direccionFiscal || '',
        estado: 'activo',
        asesoresAsignados: [user?.id || ''],
        modulosActivos: nuevoCliente.modulosActivos,
      };

      const clienteId = await createClienteWithUser(userId, clienteData, user?.id || '');
      
      toast.success('Cliente creado exitosamente');
      
      // Refresh data from database
      const clientesData = await getClientes(user?.id || '');
      setClientes(clientesData);
      
      setMostrarModalCrear(false);
      setNuevoCliente(null);
      setPassword('');
    } catch (error: any) {
      console.error('Error creating cliente:', error);
      toast.error(error.message || 'Error al crear cliente');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentosCliente = (clienteId: string) => {
    return documentos.filter(d => d.clienteId === clienteId);
  };

  const getDatosFinancierosCliente = (clienteId: string) => {
    return datosFinancieros[clienteId];
  };

  const columns = [
    {
      key: 'razonSocial',
      header: 'Cliente',
      sortable: true,
      render: (cliente: Cliente) => (
        <div>
          <div className="font-medium text-gray-900">{cliente.razonSocial}</div>
          <div className="text-xs text-gray-500">{cliente.nif}</div>
        </div>
      ),
    },
    {
      key: 'tipoCliente',
      header: 'Tipo Cliente',
      sortable: true,
      render: (cliente: Cliente) => (
        <span className={`badge ${cliente.tipoCliente === 'empresa' ? 'badge-primary' : 'badge-info'}`}>
          {cliente.tipoCliente === 'empresa' ? '🏢 Empresa' : cliente.tipoCliente === 'personal' ? '👤 Personal' : '-'}
        </span>
      ),
    },
    {
      key: 'contacto',
      header: 'Contacto',
      render: (cliente: Cliente) => (
        <div>
          <div className="text-sm text-gray-900">{cliente.personaContacto || '-'}</div>
          <div className="text-xs text-gray-500">{cliente.email}</div>
        </div>
      ),
    },
    {
      key: 'documentos',
      header: 'Documentos',
      render: (cliente: Cliente) => {
        const docs = getDocumentosCliente(cliente.id);
        const pendientes = docs.filter(d => d.estado === 'pendiente' || d.estado === 'procesado_ia').length;
        return (
          <div className="text-sm">
            <div className="text-gray-900">{docs.length} total</div>
            {pendientes > 0 && <div className="text-yellow-600">{pendientes} pendientes</div>}
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
          {cliente.estado === 'activo' ? '✓ Activo' : '○ Inactivo'}
        </span>
      ),
    },
    {
      key: 'fechaAlta',
      header: 'Alta',
      sortable: true,
      render: (cliente: Cliente) => new Date(cliente.fechaAlta).toLocaleDateString('es-ES'),
    },
  ];

  const estadisticas = {
    total: clientes.length,
    activos: clientes.filter(c => c.estado === 'activo').length,
    totalDocumentos: clientes.reduce((sum, c) => sum + getDocumentosCliente(c.id).length, 0),
    documentosPendientes: clientes.reduce((sum, c) => 
      sum + getDocumentosCliente(c.id).filter(d => d.estado === 'pendiente' || d.estado === 'procesado_ia').length, 0),
  };

  if (loadingData) {
    return (
      <Layout rol="asesor">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="asesor">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clientes Asignados</h1>
            <p className="text-gray-600 mt-1">Gestión y supervisión de tus clientes</p>
          </div>
          <button onClick={handleCrearCliente} className="btn btn-asesor">
            ➕ Nuevo Cliente
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total Clientes</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{estadisticas.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Activos</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticas.activos}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Documentos Total</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{estadisticas.totalDocumentos}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{estadisticas.documentosPendientes}</div>
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
            data={clientesFiltrados}
            columns={columns}
            onRowClick={handleVerDetalle}
            actions={(cliente) => (
              <button
                onClick={() => handleVerDetalle(cliente)}
                className="text-asesor hover:text-blue-900"
                title="Ver detalle"
              >
                📋
              </button>
            )}
          />
        </div>

        <Dialog
          isOpen={mostrarDetalle}
          onClose={() => {
            setMostrarDetalle(false);
            setClienteSeleccionado(null);
          }}
          title={clienteSeleccionado ? `${clienteSeleccionado.razonSocial} - ${clienteSeleccionado.nif}` : ''}
          maxWidth="4xl"
        >
          {clienteSeleccionado && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Información General</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">NIF:</span>
                      <span className="font-medium text-gray-900">{clienteSeleccionado.nif}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Persona Contacto:</span>
                      <span className="font-medium text-gray-900">{clienteSeleccionado.personaContacto || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tipo Cliente:</span>
                      <span className="font-medium text-gray-900">{clienteSeleccionado.tipoCliente === 'empresa' ? 'Empresa' : 'Personal'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium text-gray-900">{clienteSeleccionado.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Teléfono:</span>
                      <span className="font-medium text-gray-900">{clienteSeleccionado.telefono || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fecha Alta:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(clienteSeleccionado.fechaAlta).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estado:</span>
                      <span className={`badge ${clienteSeleccionado.estado === 'activo' ? 'badge-success' : 'badge-secondary'}`}>
                        {clienteSeleccionado.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Estadísticas</h3>
                  <div className="space-y-3">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-xs text-blue-700">Documentos</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {getDocumentosCliente(clienteSeleccionado.id).length}
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <div className="text-xs text-yellow-700">Pendientes</div>
                      <div className="text-2xl font-bold text-yellow-900">
                        {getDocumentosCliente(clienteSeleccionado.id)
                          .filter(d => d.estado === 'pendiente' || d.estado === 'procesado_ia').length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {getDatosFinancierosCliente(clienteSeleccionado.id) && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Situación Financiera</h3>
                  {(() => {
                    const datos = getDatosFinancierosCliente(clienteSeleccionado.id)!;
                    return (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-xs text-green-700">Ingresos</div>
                          <div className="text-lg font-bold text-green-900">
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(datos.ingresos)}
                          </div>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg">
                          <div className="text-xs text-red-700">Gastos</div>
                          <div className="text-lg font-bold text-red-900">
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(datos.gastos)}
                          </div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-xs text-blue-700">Resultado</div>
                          <div className={`text-lg font-bold ${datos.resultado >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(datos.resultado)}
                          </div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <div className="text-xs text-purple-700">Margen</div>
                          <div className={`text-lg font-bold ${datos.margen >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                            {datos.margen.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Módulos Activados</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'documentos', label: 'Documentos', icon: '📁' },
                    { key: 'incidencias', label: 'Incidencias', icon: '⚠️' },
                    { key: 'panelFinanciero', label: 'Panel Financiero', icon: '💰' },
                    { key: 'calendario', label: 'Calendario', icon: '📅' },
                    { key: 'asistente', label: 'Asistente E2', icon: '🤖' },
                  ].map((modulo) => (
                    <div
                      key={modulo.key}
                      className={`p-3 rounded-lg border-2 ${
                        clienteSeleccionado.modulosActivos?.[modulo.key as keyof typeof clienteSeleccionado.modulosActivos]
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{modulo.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{modulo.label}</div>
                          <div className={`text-xs ${
                            clienteSeleccionado.modulosActivos?.[modulo.key as keyof typeof clienteSeleccionado.modulosActivos]
                              ? 'text-green-600'
                              : 'text-gray-500'
                          }`}>
                            {clienteSeleccionado.modulosActivos?.[modulo.key as keyof typeof clienteSeleccionado.modulosActivos]
                              ? 'Activo'
                              : 'Inactivo'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Dialog>

        <Dialog
          isOpen={mostrarModalCrear}
          onClose={() => {
            setMostrarModalCrear(false);
            setNuevoCliente(null);
            setPassword('');
          }}
          title="Crear Nuevo Cliente"
          maxWidth="2xl"
          closeOnBackdrop={false}
          footer={
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setMostrarModalCrear(false);
                  setNuevoCliente(null);
                  setPassword('');
                }}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarNuevoCliente}
                className="btn btn-asesor"
                disabled={loading}
              >
                {loading ? 'Creando...' : 'Crear Cliente'}
              </button>
            </div>
          }
        >
          {nuevoCliente && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    value={nuevoCliente.razonSocial}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, razonSocial: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre de la empresa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIF *
                  </label>
                  <input
                    type="text"
                    value={nuevoCliente.nif}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, nif: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="B12345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Cliente *
                  </label>
                  <select
                    value={nuevoCliente.tipoCliente || 'empresa'}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, tipoCliente: e.target.value as 'personal' | 'empresa'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="empresa">Empresa</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={nuevoCliente.email}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="cliente@ejemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    value={nuevoCliente.personaContacto}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, personaContacto: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del contacto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={nuevoCliente.telefono}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Módulos Activos
                </h3>
                <div className="space-y-2">
                  {[
                    { key: 'subidaDocumentos', label: 'Subida de Documentos' },
                    { key: 'incidencias', label: 'Gestión de Incidencias' },
                    { key: 'asistenteE2', label: 'Asistente E2 (IA)' },
                    { key: 'panelFinanciero', label: 'Panel Financiero' },
                    { key: 'facturacion', label: 'Facturación' },
                  ].map((modulo) => (
                    <label key={modulo.key} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={nuevoCliente.modulosActivos?.[modulo.key] || false}
                        onChange={(e) => setNuevoCliente({
                          ...nuevoCliente,
                          modulosActivos: {
                            ...nuevoCliente.modulosActivos,
                            [modulo.key]: e.target.checked,
                          },
                        })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{modulo.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </Layout>
  );
}
