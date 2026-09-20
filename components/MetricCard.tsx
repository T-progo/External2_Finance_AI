import React from 'react';
import Link from 'next/link';

interface MetricCardProps {
  titulo: string;
  valor: string | number;
  descripcion?: string;
  icono: string;
  trend?: {
    valor: number;
    positivo: boolean;
  };
  onClick?: () => void;
  href?: string;
}

export default function MetricCard({
  titulo,
  valor,
  descripcion,
  icono,
  trend,
  onClick,
  href,
}: MetricCardProps) {
  const CardContent = () => (
    <div className="metric-card h-full flex flex-col min-h-[140px]">
      <div className="flex items-start justify-between flex-1">
        <div className="flex-1 flex flex-col min-w-0">
          <p className="text-sm font-medium text-gray-600 mb-1">{titulo}</p>
          <p className="text-3xl font-bold text-gray-900 mb-2 leading-tight">{typeof valor === 'number' ? valor.toLocaleString() : valor}</p>
          <div className="mt-auto pt-2">
            {descripcion && (
              <p className="text-sm text-gray-500 leading-relaxed">{descripcion}</p>
            )}
            {trend && (
              <div className={`flex items-center mt-2 text-sm ${trend.positivo ? 'text-green-600' : 'text-red-600'}`}>
                <span>{trend.positivo ? '↑' : '↓'}</span>
                <span className="ml-1">{Math.abs(trend.valor)}%</span>
                <span className="ml-1 text-gray-500">vs mes anterior</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-4xl ml-4 flex-shrink-0 self-start">{icono}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <CardContent />
      </Link>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} className="cursor-pointer">
        <CardContent />
      </div>
    );
  }

  return <CardContent />;
}
