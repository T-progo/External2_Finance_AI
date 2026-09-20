import React, { useState } from 'react';
import { Documento } from '@/types';

interface DocumentViewerProps {
  documento: Documento;
  onReportProblem?: (documentoId: string) => void;
}

export default function DocumentViewer({ documento, onReportProblem }: DocumentViewerProps) {
  const [viewMode, setViewMode] = useState<'info' | 'preview'>('info');

  const getFileIcon = (tipo?: string) => {
    if (!tipo) return '📄';
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('pdf')) return '📄';
    if (tipoLower.includes('image')) return '🖼️';
    if (tipoLower.includes('word') || tipoLower.includes('document')) return '📝';
    if (tipoLower.includes('excel') || tipoLower.includes('spreadsheet')) return '📊';
    if (tipoLower.includes('zip') || tipoLower.includes('rar')) return '📦';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'contabilizado':
      case 'validado':
        return 'text-green-600 bg-green-100';
      case 'procesado_ia':
        return 'text-blue-600 bg-blue-100';
      case 'incidencia':
        return 'text-red-600 bg-red-100';
      case 'pendiente':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <span className="mr-2">{getFileIcon(documento.tipo)}</span>
            {documento.nombre}
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('info')}
              className={`px-3 py-1 text-xs rounded-full ${
                viewMode === 'info' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-xs rounded-full ${
                viewMode === 'preview' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Vista
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'info' ? (
          <div className="p-4 space-y-4">
            {/* Basic Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Información del Documento</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {documento.tipo === 'emitida_pdf' || documento.tipo === 'emitida_excel' ? 'Factura Emitida' : 
                     documento.tipo === 'recibida_pdf' || documento.tipo === 'recibida_excel' ? 'Factura Recibida' :
                     'Otro'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(documento.estado || 'pendiente')}`}>
                    {(documento.estado || 'pendiente').replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tamaño:</span>
                  <span className="font-medium text-gray-900">{formatFileSize(documento.tamaño || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subido:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(documento.fechaSubida).toLocaleDateString('es-ES')}
                  </span>
                </div>
                {documento.nroAsientoERP && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Asiento ERP:</span>
                    <span className="font-medium text-gray-900">{documento.nroAsientoERP}</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Data */}
            {documento.datosIA && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">🤖</span>
                  Datos Procesados por IA
                </h4>
                <div className="space-y-2 text-sm">
                  {documento.datosIA.numeroFactura && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Nº Factura:</span>
                      <span className="font-medium text-gray-900">{documento.datosIA.numeroFactura}</span>
                    </div>
                  )}
                  {documento.datosIA.fechaFactura && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fecha:</span>
                      <span className="font-medium text-gray-900">{documento.datosIA.fechaFactura}</span>
                    </div>
                  )}
                  {documento.datosIA.totalFactura !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-bold text-green-600">
                        {documento.datosIA.totalFactura.toFixed(2)}€
                      </span>
                    </div>
                  )}
                  {documento.datosIA.razonSocialEmisor && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Emisor:</span>
                      <span className="font-medium text-gray-900">{documento.datosIA.razonSocialEmisor}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confianza IA:</span>
                    <span className={`font-medium ${
                      documento.datosIA.nivelConfianza > 0.8 ? 'text-green-600' :
                      documento.datosIA.nivelConfianza > 0.6 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(documento.datosIA.nivelConfianza * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={() => window.open(documento.urlArchivo, '_blank')}
                className="btn btn-sm btn-secondary w-full"
              >
                👁️ Ver Documento Completo
              </button>
              {onReportProblem && (
                <button
                  onClick={() => onReportProblem(documento.id)}
                  className="btn btn-sm btn-warning w-full"
                >
                  🚨 Reportar Problema
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="text-6xl mb-4">{getFileIcon(documento.tipo)}</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{documento.nombre}</h3>
              <p className="text-gray-600 mb-4">Vista previa no disponible</p>
              <button
                onClick={() => window.open(documento.urlArchivo, '_blank')}
                className="btn btn-primary"
              >
                Abrir en Nueva Pestaña
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}