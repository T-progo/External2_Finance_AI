'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { UserRole } from '@/types';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export default function AuthGuard({ 
  children, 
  allowedRoles,
  requireAuth = true 
}: AuthGuardProps) {
  const { user, loading } = useAuth();

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // If authentication is required and user is not logged in
    if (requireAuth && !user) {
      // Store the attempted URL to redirect back after login
      sessionStorage.setItem('redirectAfterLogin', pathname);
      router.push('/');
      return;
    }

    // If user is logged in and there are role restrictions
    if (user && allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.rol)) {
        // Redirect to the user's appropriate dashboard
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
    }
  }, [user, loading, router, pathname, requireAuth, allowedRoles]);

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

  // If auth is required but user is not logged in, show nothing (redirect will happen)
  if (requireAuth && !user) {
    return null;
  }

  // If role restrictions exist and user doesn't have permission, show nothing (redirect will happen)
  if (user && allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
    return null;
  }

  // User is authenticated and authorized
  return <>{children}</>;
}
