import React, { ReactNode, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { UserRole } from '@/types';
import AuthGuard from './guards/AuthGuard';

interface LayoutProps {
  children: ReactNode;
  rol?: UserRole;
}

const menuItems = {
  admin: [
    { nombre: 'Dashboard', href: '/admin', icono: '📊' },
    { nombre: 'Usuarios y Roles', href: '/admin/usuarios', icono: '👥' },
    { nombre: 'Clientes y Asesores', href: '/admin/clientes-asesores', icono: '🤝' },
    { nombre: 'Documentos Globales', href: '/admin/documentos', icono: '📁' },
    // { nombre: 'Incidencias Globales', href: '/admin/incidencias', icono: '⚠️' },
    // { nombre: 'Panel Financiero', href: '/admin/panel-financiero', icono: '💰' },
    // { nombre: 'Contabilizador IA', href: '/admin/contabilizador-ia', icono: '🤖' },
    // { nombre: 'Asistente E2', href: '/admin/asistente', icono: '🧠' },
    { nombre: 'Configuración', href: '/admin/configuracion', icono: '⚙️' },
  ],
  asesor: [
    { nombre: 'Inicio', href: '/asesor', icono: '🏠' },
    { nombre: 'Clientes Asignados', href: '/asesor/clientes', icono: '👥' },
    { nombre: 'Docs Pendientes', href: '/asesor/documentos-pendientes', icono: '📄' },
    { nombre: 'Docs Contabilizados', href: '/asesor/documentos-contabilizados', icono: '✅' },
    { nombre: 'Contabilización Manual', href: '/asesor/contabilizacion-manual', icono: '✍️' },
    { nombre: 'Panel Financiero', href: '/asesor/panel-financiero', icono: '💰' },
    { nombre: 'Incidencias', href: '/asesor/incidencias', icono: '⚠️' },
    { nombre: 'Configuración', href: '/asesor/configuracion', icono: '⚙️' },
  ],
  cliente: [
    { nombre: 'Dashboard', href: '/cliente', icono: '🏠' },
    { nombre: 'Mis Documentos', href: '/cliente/documentos', icono: '📁' },
    { nombre: 'Panel Financiero', href: '/cliente/panel-financiero', icono: '💰' },
    { nombre: 'Incidencias', href: '/cliente/incidencias', icono: '💬' },
    // { nombre: 'Calendario Fiscal', href: '/cliente/calendario', icono: '📅' },
    { nombre: 'Mi Perfil', href: '/cliente/perfil', icono: '👤' },
    { nombre: 'Configuración', href: '/cliente/configuracion', icono: '⚙️' },
  ],
};

export default function Layout({ children, rol }: LayoutProps) {
  const { user, logout } = useAuth();
  const currentRole = rol || user?.rol;
  const menu = currentRole ? menuItems[currentRole] : [];
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getRoleColor = () => {
    switch (currentRole) {
      case 'admin': return 'bg-admin';
      case 'asesor': return 'bg-asesor';
      case 'cliente': return 'bg-cliente';
      default: return 'bg-primary-500';
    }
  };

  const layoutContent = (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white text-gray-900 shadow-lg">
        <div className="w-full px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Toggle button for md-lg breakpoint */}
              {user && menu.length > 0 && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hidden md:block lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Toggle sidebar"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <Image src="/logo.png" alt="Externaliza2" width={40} height={40} className="h-10 w-auto" />
              <div className="hidden sm:block">
                <h1 className="text-[15px] font-bold">EXTERNALIZA2</h1>
                <p className="text-[11px] opacity-90">Asesoría de Empresas</p>
              </div>
            </div>
            {user && (
              <div className="flex items-center space-x-4">
                <div className="text-right hidden md:block">
                  <p className="font-[12px]">{user.nombre}</p>
                  <p className="text-[10px] opacity-90 capitalize">{user.rol}</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await logout();
                    } catch (error) {
                      console.error('Logout error:', error);
                    }
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-lg transition-colors"
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="block md:flex relative">
        {/* Overlay for md-lg breakpoint when sidebar is open */}
        {user && menu.length > 0 && (
          <div
            className={`fixed inset-0 bg-black/50 z-40 hidden md:block lg:hidden transition-opacity duration-300 ${
              sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        {user && menu.length > 0 && (
          <aside
            className={`w-64 bg-white shadow-lg h-[calc(100vh-72px)] overflow-y-auto transition-transform duration-300 z-50
              hidden
              md:block md:fixed md:top-[72px] 
              lg:relative lg:top-0 lg:left-auto
              ${sidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-full'} lg:translate-x-0
            `}
          >
            <nav className="p-4">
              <ul className="space-y-2">
                {menu.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-2xl">{item.icono}</span>
                      <span className="font-medium">{item.nombre}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div className="container mx-auto ">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      {user && menu.length > 0 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg overflow-y-auto">
          <div className="flex justify-around p-2">
            {menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center px-2 text-xs"
              >
                <span className="text-2xl">{item.icono}</span>
                {/* <span className="mt-1 text-gray-600">{item.nombre.split(' ')[0]}</span> */}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );

  // If a specific role is required, wrap with AuthGuard
  if (rol) {
    return (
      <AuthGuard allowedRoles={[rol]}>
        {layoutContent}
      </AuthGuard>
    );
  }

  // Otherwise, return the layout without authentication (for public pages)
  return layoutContent;
}
