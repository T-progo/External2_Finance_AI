import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import GuestGuard from '@/components/guards/GuestGuard';
import { UserRole } from '@/types';

const Home: NextPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rol, setRol] = useState<UserRole>('cliente');
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password, rol);
      // The auth context will handle the user state
      // Redirect will be handled by the useEffect when user is set
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GuestGuard>
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
        <Head>
          <title>Externaliza2 - Asesoría de Empresas</title>
          <meta name="description" content="Plataforma de asesoría empresarial con IA" />
          <link rel="icon" href="/logo.png" />
        </Head>

        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="Externaliza2" width={120} height={120}/>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">EXTERNALIZA2</h1>
          <p className="text-gray-600">Asesoría de Empresas</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="usuario@ejemplo.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="rol" className="block text-sm font-medium text-gray-700 mb-2">
              Rol con el que deseas acceder
            </label>
            <select
              id="rol"
              value={rol}
              onChange={(e) => setRol(e.target.value as UserRole)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="admin">Administrador</option>
              <option value="asesor">Asesor</option>
              <option value="cliente">Cliente</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Solo podrás entrar si tu cuenta tiene asignado el rol seleccionado.
            </p>
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full btn btn-primary py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

      </div>
      </div>
    </GuestGuard>
  );
};

export default Home;
