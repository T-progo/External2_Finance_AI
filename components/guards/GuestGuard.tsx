'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

interface GuestGuardProps {
  children: React.ReactNode;
}

/**
 * GuestGuard - Protects routes that should only be accessible to non-authenticated users
 * (e.g., login, forgot-password pages)
 * 
 * If a user is already authenticated, they will be redirected to their role-appropriate dashboard
 */
export default function GuestGuard({ children }: GuestGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // If user is authenticated, redirect to their dashboard
    if (user) {
      // Check if there's a stored redirect URL
      const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
      
      if (redirectUrl) {
        // Clear the stored URL and redirect to it
        sessionStorage.removeItem('redirectAfterLogin');
        router.push(redirectUrl);
        return;
      }

      // Otherwise, redirect to role-appropriate dashboard
      switch (user.rol) {
        case 'admin':
          router.push('/admin');
          break;
        case 'asesor':
          router.push('/asesor');
          break;
        case 'cliente':
          router.push('/cliente');
          break;
        default:
          router.push('/');
      }
    }
  }, [user, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cliente mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, show nothing (redirect will happen)
  if (user) {
    return null;
  }

  // User is not authenticated, show the page
  return <>{children}</>;
}
