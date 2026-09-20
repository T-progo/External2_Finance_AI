'use client';

import AuthGuard from '@/components/guards/AuthGuard';

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <AuthGuard>
      {children}
    </AuthGuard>
  );
}
