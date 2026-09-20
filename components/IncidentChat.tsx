import React, { useState, useRef, useEffect } from 'react';
import { Incidencia, MensajeIncidencia, UserRole, ArchivoAdjunto } from '@/types';
import { addMensajeIncidencia, uploadArchivoAdjunto } from '@/lib/supabaseService';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface IncidentChatProps {
  incidencia: Incidencia;
  currentUserRole: UserRole;
  onSendMessage?: (mensaje: string) => void;
  onChangeStatus?: (nuevoEstado: 'nueva' | 'en_revision' | 'resuelta' | 'cerrada') => void;
  onMessageAdded?: (mensaje: MensajeIncidencia) => void;
}

export default function IncidentChat({
  incidencia,
  currentUserRole,
  onSendMessage,
  onChangeStatus,
  onMessageAdded,
}: IncidentChatProps) {
  const { user } = useAuth();
  const [mensaje, setMensaje] = useState('');
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [incidencia.mensajes]);

  // Real-time subscription for new messages
  useEffect(() => {
    // Subscribe to new messages for this specific incidencia
    const channel = supabase
      .channel(`incidencia-${incidencia.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_incidencia',
          filter: `incidencia_id=eq.${incidencia.id}`,
        },
        async (payload) => {
          // Parse the new message from the database
          const newMessageData = payload.new;
          
          // Fetch additional data if needed (like archivos adjuntos)
          const { data: mensajeCompleto, error } = await supabase
            .from('mensajes_incidencia')
            .select('*')
            .eq('id', newMessageData.id)
            .single();

          if (error || !mensajeCompleto) {
            console.error('Error fetching complete message:', error);
            return;
          }

          // Convert to MensajeIncidencia format
          const nuevoMensaje: MensajeIncidencia = {
            id: mensajeCompleto.id,
            usuarioId: mensajeCompleto.usuario_id,
            rol: mensajeCompleto.rol,
            mensaje: mensajeCompleto.mensaje,
            fecha: new Date(mensajeCompleto.fecha),
            archivosAdjuntos: mensajeCompleto.archivos_adjuntos || [],
            esIA: mensajeCompleto.es_ia || false,
          };

          // Only notify if it's not from the current user
          if (mensajeCompleto.usuario_id !== user?.id) {
            onMessageAdded?.(nuevoMensaje);
            toast.success('Nuevo mensaje recibido');
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [incidencia.id, user?.id, onMessageAdded]);

  const getRoleColor = (rol: UserRole, esIA: boolean = false) => {
    if (esIA) return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
    
    switch (rol) {
      case 'admin':
        return 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      case 'asesor':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
      case 'cliente':
        return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white';
    }
  };

  const getRoleIcon = (rol: UserRole, esIA: boolean = false) => {
    if (esIA) return '🤖';
    
    switch (rol) {
      case 'admin':
        return '🛡️';
      case 'asesor':
        return '👔';
      case 'cliente':
        return '🧍';
      default:
        return '👤';
    }
  };

  const getRoleName = (rol: UserRole, esIA: boolean = false) => {
    if (esIA) return 'IA Asistente';
    
    switch (rol) {
      case 'admin':
        return 'Administrador';
      case 'asesor':
        return 'Tu Asesor';
      case 'cliente':
        return 'Tú';
      default:
        return 'Usuario';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (tipo: string) => {
    if (tipo.includes('pdf')) return '📄';
    if (tipo.includes('image')) return '🖼️';
    if (tipo.includes('word') || tipo.includes('document')) return '📝';
    if (tipo.includes('excel') || tipo.includes('spreadsheet')) return '📊';
    if (tipo.includes('zip') || tipo.includes('rar')) return '📦';
    return '📎';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setArchivosSeleccionados(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setArchivosSeleccionados(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim() && archivosSeleccionados.length === 0) return;
    if (!user?.id) return;

    setEnviando(true);
    try {
      // Create message
      const nuevoMensaje: Omit<MensajeIncidencia, 'id' | 'fecha'> = {
        usuarioId: user.id,
        rol: currentUserRole,
        mensaje: mensaje.trim() || '📎 Archivo adjunto',
        archivosAdjuntos: [],
        esIA: false,
      };

      // Upload files if any
      if (archivosSeleccionados.length > 0) {
        const archivosAdjuntos: ArchivoAdjunto[] = [];
        
        for (const file of archivosSeleccionados) {
          const mensajeId = await addMensajeIncidencia(incidencia.id, nuevoMensaje);
          const url = await uploadArchivoAdjunto(file, incidencia.id, mensajeId);
          
          archivosAdjuntos.push({
            id: `${mensajeId}_${file.name}`,
            nombre: file.name,
            url,
            tipo: file.type,
            tamaño: file.size,
            fechaSubida: new Date(),
          });
        }

        nuevoMensaje.archivosAdjuntos = archivosAdjuntos;
      }

      // Add message to database
      const mensajeId = await addMensajeIncidencia(incidencia.id, nuevoMensaje);
      
      const mensajeCompleto: MensajeIncidencia = {
        ...nuevoMensaje,
        id: mensajeId,
        fecha: new Date(),
      };

      // Notify parent component
      onMessageAdded?.(mensajeCompleto);
      
      // Clear form
      setMensaje('');
      setArchivosSeleccionados([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      toast.success('Mensaje enviado');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const isMyMessage = (msg: MensajeIncidencia) => {
    return msg.usuarioId === user?.id || (msg.esIA && currentUserRole === 'cliente');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {incidencia.mensajes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">💬</div>
            <p>No hay mensajes aún. ¡Inicia la conversación!</p>
          </div>
        ) : (
          incidencia.mensajes.map((msg: MensajeIncidencia, index) => {
            const isMine = isMyMessage(msg);
            const showAvatar = index === 0 || incidencia.mensajes[index - 1].usuarioId !== msg.usuarioId;
            
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[80%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar - Always reserve space */}
                  <div className={`flex-shrink-0 w-8 h-8 ${isMine ? 'ml-2' : 'mr-2'} flex items-center justify-center`}>
                    {showAvatar && (
                      <div className={`w-8 h-8 rounded-full ${getRoleColor(msg.rol, msg.esIA)} flex items-center justify-center text-sm`}>
                        {getRoleIcon(msg.rol, msg.esIA)}
                      </div>
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {/* Sender name */}
                    {showAvatar && (
                      <div className={`text-xs text-gray-500 mb-1 ${isMine ? 'text-right' : 'text-left'}`}>
                        {getRoleName(msg.rol, msg.esIA)}
                      </div>
                    )}
                    
                    {/* Message bubble */}
                    <div className={`rounded-2xl px-4 py-2 ${
                      isMine 
                        ? 'bg-blue-500 text-white rounded-br-md' 
                        : msg.esIA 
                          ? 'bg-purple-100 text-purple-900 border border-purple-200 rounded-bl-md'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.mensaje}</p>
                      
                      {/* File attachments */}
                      {msg.archivosAdjuntos && msg.archivosAdjuntos.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.archivosAdjuntos.map((archivo) => (
                            <div key={archivo.id} className="flex items-center space-x-2 p-2 bg-white bg-opacity-20 rounded-lg">
                              <span className="text-lg">{getFileIcon(archivo.tipo)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{archivo.nombre}</p>
                                <p className="text-xs opacity-75">{formatFileSize(archivo.tamaño)}</p>
                              </div>
                              <a
                                href={archivo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs underline hover:no-underline"
                              >
                                Ver
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Timestamp */}
                    <div className={`text-xs text-gray-400 mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.fecha).toLocaleTimeString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {(currentUserRole === 'admin' || currentUserRole === 'asesor' || currentUserRole === 'cliente') && (
        <div className="border-t border-gray-200 bg-white p-4">
          {/* Selected files */}
          {archivosSeleccionados.length > 0 && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Archivos seleccionados:</span>
                <button
                  type="button"
                  onClick={() => setArchivosSeleccionados([])}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Limpiar todo
                </button>
              </div>
              <div className="space-y-1">
                {archivosSeleccionados.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <span>{getFileIcon(file.type)}</span>
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-500">({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip,.rar"
            />
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Adjuntar archivos"
            >
              📎
            </button>
            
            <input
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={enviando}
            />
            
            <button
              type="submit"
              disabled={(!mensaje.trim() && archivosSeleccionados.length === 0) || enviando}
              className="flex-shrink-0 px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {enviando ? '⏳' : '➤'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
