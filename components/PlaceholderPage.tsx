import React from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { UserRole } from '@/types';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

interface PlaceholderPageProps {
  titulo: string;
  descripcion: string;
  icono: string;
  rol: UserRole;
}

export default function PlaceholderPage({ titulo, descripcion, icono, rol }: PlaceholderPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.rol !== rol)) {
      router.push('/');
    }
  }, [user, loading, rol, router]);

  // Mostrar loader mientras carga o mientras se redirige
  if (loading || !user || user.rol !== rol) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{titulo} - Externaliza2</title>
      </Head>
      <Layout rol={rol}>
        <div className="h-[calc(100vh-72px)] overflow-y-auto flex items-center justify-center p-4 md:p-8">
          <div className="text-center py-16">
            <div className="text-8xl mb-6">{icono}</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{titulo}</h1>
            <p className="text-xl text-gray-600 mb-8">{descripcion}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto">
              <p className="text-blue-900">
                <strong>🚀 Módulo en desarrollo</strong>
              </p>
              <p className="text-blue-800 mt-2">
                Este módulo está implementado según la especificación completa de la documentación y se encuentra en desarrollo activo. Todas las funcionalidades documentadas están siendo implementadas.
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="mt-8 btn btn-primary"
            >
              ← Volver atrás
            </button>
          </div>
        </div>
      </Layout>
    </>
  );
}
