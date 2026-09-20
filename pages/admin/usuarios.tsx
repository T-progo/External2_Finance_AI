import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { User, UserRole } from '@/types';
import DataTable from '@/components/DataTable';
import FilterBar, { Filter } from '@/components/FilterBar';
import Dialog from '@/components/Dialog';
import { useAuth } from '@/lib/authContext';
import toast from 'react-hot-toast';
import { getAllUsers, updateUserProfile, createUser, deleteUser } from '@/lib/supabaseService';

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [filtros, setFiltros] = useState<Record<string, any>>({});
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<User | null>(null);
  const [modoEdicion, setModoEdicion] = useState<'crear' | 'editar'>('crear');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<User | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [loadingClienteData, setLoadingClienteData] = useState(false);
  const [lastFetchedCodigo, setLastFetchedCodigo] = useState<string>('');

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const data = await getAllUsers();
        setUsuarios(data);
      } catch (error: any) {
        console.error('Error cargando usuarios:', error);
        toast.error('Error al cargar usuarios');
      }
    };

    cargarUsuarios();
  }, []);

  const filterConfig: Filter[] = [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'Nombre, email...',
    },
    {
      key: 'rol',
      label: 'Rol',
      type: 'select',
      options: [
        { value: 'admin', label: 'Admin' },
        { value: 'asesor', label: 'Asesor' },
        { value: 'cliente', label: 'Cliente' },
      ],
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

  const usuariosFiltrados = usuarios.filter(usuario => {
    if (filtros.buscar) {
      const busqueda = filtros.buscar.toLowerCase();
      if (!usuario.nombre.toLowerCase().includes(busqueda) && 
          !usuario.email.toLowerCase().includes(busqueda)) {
        return false;
      }
    }
    if (filtros.rol && usuario.rol !== filtros.rol) return false;
    if (filtros.estado && usuario.estado !== filtros.estado) return false;
    return true;
  });

  const handleFiltroChange = (key: string, value: any) => {
    setFiltros({ ...filtros, [key]: value });
  };

  const handleLimpiarFiltros = () => {
    setFiltros({});
  };

  const handleCrearUsuario = () => {
    setModoEdicion('crear');
    setUsuarioSeleccionado({
      id: '',
      nombre: '',
      email: '',
      rol: 'cliente',
      estado: 'activo',
      telefono: '',
      fechaAlta: new Date(),
      modulosActivos: {
        subidaDocumentos: true,
        incidencias: true,
        asistenteE2: false,
        panelFinanciero: false,
        facturacion: false,
      },
      codigo: '',
      tipoEmpresa: '',
      provincia: '',
      nombreFiscal: '',
      cif: '',
    });
    setMostrarModal(true);
  };

  const fetchClienteDataByCodigo = async (codigo: string) => {
    if (!usuarioSeleccionado) return;

    const trimmed = (codigo || '').trim();
    if (!trimmed) return;

    // Avoid refetching the same code repeatedly
    if (trimmed === lastFetchedCodigo) return;

    setLoadingClienteData(true);
    try {
      const response = await fetch('/api/external/cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: trimmed }),
      });

      const result = await response.json();

      if (response.ok && result.success && result.data) {
        const clienteData = result.data;

        // Auto-populate all fields with fetched data
        setUsuarioSeleccionado({
          ...usuarioSeleccionado,
          nombre: clienteData.nombre || '',
          email: clienteData.email || '',
          telefono: clienteData.telefonos,
          codigo: clienteData.codigo?.toString() || trimmed,
          nombreFiscal: clienteData.nombre || '',
          cif: clienteData.nifCif || '',
          provincia: clienteData.provincia || '',
          tipoEmpresa: clienteData.tipoEmpresa || '',
        });

        setLastFetchedCodigo(trimmed);
        toast.success('Datos del cliente cargados correctamente');
      } else {
        // If cliente not found, allow manual entry
        if (result.error) {
          toast.error(result.error || 'Cliente no encontrado');
        } else {
          console.warn('Cliente no encontrado, se pueden ingresar los datos manualmente');
        }
      }
    } catch (error: any) {
      console.error('Error fetching cliente data:', error);
      // Allow manual entry; do not block the flow
    } finally {
      setLoadingClienteData(false);
    }
  };

  const handleCodigoChange = (codigo: string) => {
    if (!usuarioSeleccionado) return;
    setUsuarioSeleccionado({
      ...usuarioSeleccionado,
      codigo,
    });
  };

  const handleEditarUsuario = (usuario: User) => {
    setModoEdicion('editar');
    // Ensure modulosActivos are initialized for cliente users
    const usuarioParaEditar: User = {
      ...usuario,
      modulosActivos: usuario.rol === 'cliente' 
        ? (usuario.modulosActivos || {
            subidaDocumentos: false,
            incidencias: false,
            asistenteE2: false,
            panelFinanciero: false,
            facturacion: false,
          })
        : usuario.modulosActivos,
    };
    setUsuarioSeleccionado(usuarioParaEditar);
    setMostrarModal(true);
  };

  const handleEliminarUsuario = (usuario: User) => {
    setUsuarioAEliminar(usuario);
  };

  const handleConfirmarEliminar = async () => {
    if (!usuarioAEliminar) return;
    
    setEliminando(true);
    try {
      console.log('[handleConfirmarEliminar] Deleting user:', usuarioAEliminar.id);
      
      // Delete user via API route
      await deleteUser(usuarioAEliminar.id);

      console.log('[handleConfirmarEliminar] User deleted successfully, reloading users...');

      // Reload users to get the latest data
      const data = await getAllUsers();
      setUsuarios(data);
      toast.success('Usuario eliminado correctamente');
      setUsuarioAEliminar(null);
    } catch (error: any) {
      console.error('[handleConfirmarEliminar] Error deleting user:', error);
      toast.error(error.message || 'Error al eliminar usuario');
    } finally {
      setEliminando(false);
    }
  };

  const handleGuardarUsuario = async () => {
    if (!usuarioSeleccionado) return;

    if (modoEdicion === 'crear') {
      // Validate required fields
      if (!usuarioSeleccionado.nombre || !usuarioSeleccionado.email) {
        toast.error('Nombre y email son requeridos');
        return;
      }
      if (!password || password.length < 6) {
        toast.error('La contraseña debe tener al menos 6 caracteres');
        return;
      }

      setLoading(true);
      try {
        console.log('[handleGuardarUsuario] Creating user:', usuarioSeleccionado.email);
        
        // Create user via API route
        await createUser({
          email: usuarioSeleccionado.email,
          password: password,
          nombre: usuarioSeleccionado.nombre,
          rol: usuarioSeleccionado.rol,
          telefono: usuarioSeleccionado.telefono || undefined,
          estado: usuarioSeleccionado.estado,
          modulosActivos: usuarioSeleccionado.rol === 'cliente' 
            ? usuarioSeleccionado.modulosActivos 
            : undefined,
          codigo: usuarioSeleccionado.codigo || undefined,
          tipoEmpresa: usuarioSeleccionado.tipoEmpresa || undefined,
          provincia: usuarioSeleccionado.provincia || undefined,
          nombreFiscal: usuarioSeleccionado.nombreFiscal || undefined,
          cif: usuarioSeleccionado.cif || undefined,
        });

        console.log('[handleGuardarUsuario] User created successfully, reloading users...');

        // Reload users to get the latest data
        const data = await getAllUsers();
        setUsuarios(data);
        toast.success('Usuario creado exitosamente');
        setMostrarModal(false);
        setUsuarioSeleccionado(null);
        setPassword('');
      } catch (error: any) {
        console.error('[handleGuardarUsuario] Error creating user:', error);
        toast.error(error.message || 'Error al crear usuario');
      } finally {
        setLoading(false);
      }
    } else {
      if (!usuarioSeleccionado.id) {
        toast.error('Usuario sin identificador válido');
        return;
      }

      setLoading(true);
      try {
        const updateData: Partial<User> = {
          nombre: usuarioSeleccionado.nombre,
          telefono: usuarioSeleccionado.telefono,
          estado: usuarioSeleccionado.estado,
          notasInternas: usuarioSeleccionado.notasInternas,
          rol: usuarioSeleccionado.rol,
          codigo: usuarioSeleccionado.codigo,
          tipoEmpresa: usuarioSeleccionado.tipoEmpresa,
          provincia: usuarioSeleccionado.provincia,
          nombreFiscal: usuarioSeleccionado.nombreFiscal,
          cif: usuarioSeleccionado.cif,
        };

        // Include modulosActivos for cliente users
        if (usuarioSeleccionado.rol === 'cliente' && usuarioSeleccionado.modulosActivos) {
          updateData.modulosActivos = usuarioSeleccionado.modulosActivos;
        }

        console.log('[handleGuardarUsuario] Updating user:', usuarioSeleccionado.id);
        console.log('[handleGuardarUsuario] Update data:', updateData);

        await updateUserProfile(usuarioSeleccionado.id, updateData);

        console.log('[handleGuardarUsuario] Update successful, reloading users...');

        // Reload users to get the latest data
        const data = await getAllUsers();
        setUsuarios(data);
        setMostrarModal(false);
        setUsuarioSeleccionado(null);
        toast.success('Usuario actualizado correctamente');
      } catch (error: any) {
        console.error('[handleGuardarUsuario] Error actualizando usuario:', error);
        toast.error(error.message || 'Error al actualizar usuario');
      } finally {
        setLoading(false);
      }
    }
  };

  const getRolBadge = (rol: UserRole) => {
    switch (rol) {
      case 'admin':
        return <span className="badge badge-admin">Admin</span>;
      case 'asesor':
        return <span className="badge badge-asesor">Asesor</span>;
      case 'cliente':
        return <span className="badge badge-cliente">Cliente</span>;
    }
  };

  const getEstadoBadge = (estado: string) => {
    return estado === 'activo' 
      ? <span className="badge badge-success">Activo</span>
      : <span className="badge badge-secondary">Inactivo</span>;
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      render: (usuario: User) => (
        <div>
          <div className="font-medium text-gray-900">{usuario.nombre}</div>
          <div className="text-sm text-gray-500">{usuario.email}</div>
        </div>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      sortable: true,
      render: (usuario: User) => getRolBadge(usuario.rol),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (usuario: User) => getEstadoBadge(usuario.estado),
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (usuario: User) => usuario.telefono || '-',
    },
    {
      key: 'ultimoAcceso',
      header: 'Último Acceso',
      sortable: true,
      render: (usuario: User) => 
        usuario.ultimoAcceso 
          ? new Date(usuario.ultimoAcceso).toLocaleDateString('es-ES')
          : '-',
    },
    {
      key: 'fechaAlta',
      header: 'Fecha Alta',
      sortable: true,
      render: (usuario: User) => new Date(usuario.fechaAlta).toLocaleDateString('es-ES'),
    },
  ];

  const estadisticas = {
    total: usuarios.length,
    admins: usuarios.filter(u => u.rol === 'admin').length,
    asesores: usuarios.filter(u => u.rol === 'asesor').length,
    clientes: usuarios.filter(u => u.rol === 'cliente').length,
    activos: usuarios.filter(u => u.estado === 'activo').length,
  };

  return (
    <Layout rol="admin">
      <div className="h-[calc(100vh-72px)] overflow-y-auto space-y-6 p-4 md:p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Usuarios y Roles</h1>
            <p className="text-gray-600 mt-1">Gestión completa de usuarios, roles y permisos</p>
          </div>
          <button onClick={handleCrearUsuario} className="btn btn-admin">
            ➕ Nuevo Usuario
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total Usuarios</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{estadisticas.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Admins</div>
            <div className="text-2xl font-bold text-admin mt-1">{estadisticas.admins}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Asesores</div>
            <div className="text-2xl font-bold text-asesor mt-1">{estadisticas.asesores}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Clientes</div>
            <div className="text-2xl font-bold text-cliente mt-1">{estadisticas.clientes}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Activos</div>
            <div className="text-2xl font-bold text-success mt-1">{estadisticas.activos}</div>
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
            data={usuariosFiltrados}
            columns={columns}
            actions={(usuario) => (
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() => handleEditarUsuario(usuario)}
                  className="text-blue-600 hover:text-blue-900"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleEliminarUsuario(usuario)}
                  className="text-red-600 hover:text-red-900"
                  title="Eliminar"
                >
                  🗑️
                </button>
              </div>
            )}
          />
        </div>

        <Dialog
          isOpen={mostrarModal && usuarioSeleccionado !== null}
          onClose={() => {
            setMostrarModal(false);
            setUsuarioSeleccionado(null);
          }}
          closeOnBackdrop={false}
          closeOnEscape={false}
          title={modoEdicion === 'crear' ? 'Crear Nuevo Usuario' : 'Editar Usuario'}
          maxWidth="2xl"
          footer={
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setMostrarModal(false);
                  setUsuarioSeleccionado(null);
                  setPassword('');
                }}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarUsuario}
                className="btn btn-admin"
                disabled={loading}
              >
                {loading ? 'Guardando...' : (modoEdicion === 'crear' ? 'Crear Usuario' : 'Guardar Cambios')}
              </button>
            </div>
          }
        >
          {usuarioSeleccionado && (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={usuarioSeleccionado.nombre}
                      onChange={(e) => setUsuarioSeleccionado({
                        ...usuarioSeleccionado,
                        nombre: e.target.value,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: María García López"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={usuarioSeleccionado.email}
                      onChange={(e) => setUsuarioSeleccionado({
                        ...usuarioSeleccionado,
                        email: e.target.value,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="usuario@ejemplo.com"
                      disabled={modoEdicion === 'editar'}
                    />
                  </div>

                  {modoEdicion === 'crear' && (
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
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={usuarioSeleccionado.telefono || ''}
                      onChange={(e) => setUsuarioSeleccionado({
                        ...usuarioSeleccionado,
                        telefono: e.target.value,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+34 600 000 000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rol *
                    </label>
                    <select
                      value={usuarioSeleccionado.rol}
                      onChange={(e) => setUsuarioSeleccionado({
                        ...usuarioSeleccionado,
                        rol: e.target.value as UserRole,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="asesor">Asesor</option>
                      <option value="cliente">Cliente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado *
                    </label>
                    <select
                      value={usuarioSeleccionado.estado}
                      onChange={(e) => setUsuarioSeleccionado({
                        ...usuarioSeleccionado,
                        estado: e.target.value as 'activo' | 'inactivo',
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>

                {usuarioSeleccionado.rol === 'cliente' && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Información Adicional del Cliente
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Código
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={usuarioSeleccionado.codigo || ''}
                            onChange={(e) => handleCodigoChange(e.target.value)}
                            onBlur={() => fetchClienteDataByCodigo(usuarioSeleccionado.codigo || '')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ingrese código para buscar datos"
                          />
                          {loadingClienteData && (
                            <div className="absolute right-3 top-2.5">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Ingrese el código para cargar automáticamente los datos, o complete los campos manualmente
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo de empresa
                        </label>
                        <input
                          type="text"
                          value={usuarioSeleccionado.tipoEmpresa || ''}
                          onChange={(e) => setUsuarioSeleccionado({
                            ...usuarioSeleccionado,
                            tipoEmpresa: e.target.value,
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Tipo de empresa"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Provincia
                        </label>
                        <input
                          type="text"
                          value={usuarioSeleccionado.provincia || ''}
                          onChange={(e) => setUsuarioSeleccionado({
                            ...usuarioSeleccionado,
                            provincia: e.target.value,
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Provincia"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nombre fiscal
                        </label>
                        <input
                          type="text"
                          value={usuarioSeleccionado.nombreFiscal || ''}
                          onChange={(e) => setUsuarioSeleccionado({
                            ...usuarioSeleccionado,
                            nombreFiscal: e.target.value,
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Nombre fiscal"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CIF
                        </label>
                        <input
                          type="text"
                          value={usuarioSeleccionado.cif || ''}
                          onChange={(e) => setUsuarioSeleccionado({
                            ...usuarioSeleccionado,
                            cif: e.target.value,
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="CIF"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {usuarioSeleccionado.rol === 'cliente' && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Módulos Activos
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { key: 'subidaDocumentos', label: 'subida Documentos' },
                        { key: 'incidencias', label: 'incidencias' },
                        { key: 'asistenteE2', label: 'asistente E2' },
                        { key: 'panelFinanciero', label: 'panel Financiero' },
                        { key: 'facturacion', label: 'facturacion' },
                      ].map((modulo) => {
                        const activo = usuarioSeleccionado.modulosActivos?.[modulo.key as keyof typeof usuarioSeleccionado.modulosActivos] || false;
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
                                  const currentModulos = usuarioSeleccionado.modulosActivos || {
                                    subidaDocumentos: false,
                                    incidencias: false,
                                    asistenteE2: false,
                                    panelFinanciero: false,
                                    facturacion: false,
                                  };
                                  setUsuarioSeleccionado({
                                    ...usuarioSeleccionado,
                                    modulosActivos: {
                                      ...currentModulos,
                                      [modulo.key]: e.target.checked,
                                    },
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
                )}

                {usuarioSeleccionado.rol === 'asesor' && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Clientes Asignados
                    </h3>
                    <div className="text-sm text-gray-600">
                      {usuarioSeleccionado.clientesAsignados?.length || 0} clientes asignados
                    </div>
                  </div>
                )}
              </div>
          )}
        </Dialog>

        <Dialog
          isOpen={usuarioAEliminar !== null}
          onClose={() => setUsuarioAEliminar(null)}
          title="Eliminar Usuario"
          maxWidth="md"
          closeOnBackdrop={false}
          closeOnEscape={false}
          footer={
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setUsuarioAEliminar(null)}
                className="btn btn-secondary"
                disabled={eliminando}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEliminar}
                className="btn btn-danger"
                disabled={eliminando}
              >
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          }
        >
          {usuarioAEliminar && (
            <div className="space-y-4">
              <p className="text-gray-700">
                ¿Estás seguro de que deseas eliminar el usuario <strong>{usuarioAEliminar.nombre}</strong>?
              </p>
              <p className="text-sm text-gray-500">
                Esta acción no se puede deshacer.
              </p>
            </div>
          )}
        </Dialog>
      </div>
    </Layout>
  );
}
