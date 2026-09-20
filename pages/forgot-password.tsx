import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import GuestGuard from '@/components/guards/GuestGuard';

const ForgotPassword: NextPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Error al enviar el correo de recuperación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GuestGuard>
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <Head>
        <title>Recuperar Contraseña - Externaliza2</title>
        <meta name="description" content="Recupera tu contraseña de Externaliza2" />
        <link rel="icon" href="/logo.png" />
      </Head>

      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="Externaliza2" width={100} height={100}/>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Recuperar Contraseña</h1>
          <p className="text-gray-600">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-lg">
            <div className="font-semibold mb-2">¡Correo enviado!</div>
            <p className="text-sm">
              Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
              Si no recibes el correo en unos minutos, revisa tu carpeta de spam.
            </p>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
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

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full btn btn-primary py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar Correo de Recuperación'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center space-y-2">
          <Link href="/" className="block text-sm text-primary-600 hover:text-primary-700 font-semibold">
            ← Volver al inicio de sesión
          </Link>
          <p className="text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <Link href="/signup" className="text-primary-600 hover:text-primary-700 font-semibold">
              Registrarse
            </Link>
          </p>
        </div>

        {success && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setSuccess(false)}
              className="w-full text-sm text-primary-600 hover:text-primary-700 font-semibold"
            >
              ¿No recibiste el correo? Intentar de nuevo
            </button>
          </div>
        )}
      </div>
      </div>
    </GuestGuard>
  );
};

export default ForgotPassword;

