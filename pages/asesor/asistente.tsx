import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';
import {
  getConversacionesAsesor,
  getMensajesAsesor,
  createConversacionAsesor,
  sendMensajeAsesor,
  updateConversacionAsesorTitulo,
  deleteConversacionAsesor,
} from '@/lib/supabaseService';

interface Mensaje {
  id: string;
  rol: 'usuario' | 'asistente';
  contenido: string;
  timestamp: Date;
  fuentes?: string[];
}

interface Conversacion {
  id: string;
  titulo: string;
  fecha: Date;
  mensajes: Mensaje[];
}

export default function AsesorAsistente() {
  const { user } = useAuth();
  
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [conversacionActiva, setConversacionActiva] = useState<Conversacion | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [esperandoRespuesta, setEsperandoRespuesta] = useState(false);
  const [mostrandoSidebar, setMostrandoSidebar] = useState(false);
  const [editandoConversacionId, setEditandoConversacionId] = useState<string | null>(null);
  const [nuevoTitulo, setNuevoTitulo] = useState<string>('');
  const [mostrandoMenuId, setMostrandoMenuId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [conversacionAEliminar, setConversacionAEliminar] = useState<string | null>(null);

  // Load advisor conversations
  const loadAsesorData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setCargando(true);
      
      // Load conversations
      const convs = await getConversacionesAsesor(user.id);
      const conversacionesConMensajes = await Promise.all(
        convs.map(async (conv: any) => {
          const mensajes = await getMensajesAsesor(conv.id);
          return {
            id: conv.id,
            titulo: conv.titulo,
            fecha: conv.fechaCreacion,
            mensajes: mensajes.map((m: any) => ({
              id: m.id,
              rol: m.rol,
              contenido: m.contenido,
              timestamp: m.fecha,
              fuentes: m.metadatos?.fuentes || [],
            })),
          };
        })
      );

      setConversaciones(conversacionesConMensajes);
      if (conversacionesConMensajes.length > 0) {
        setConversacionActiva(conversacionesConMensajes[0]);
      }
    } catch (error) {
      console.error('Error loading advisor data:', error);
    } finally {
      setCargando(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAsesorData();
    }
  }, [user, loadAsesorData]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mostrandoMenuId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setMostrandoMenuId(null);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mostrandoMenuId]);

  const handleEnviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim() || !conversacionActiva || !user?.id) return;

    const textoMensaje = mensaje;
    setMensaje('');
    setEsperandoRespuesta(true);

    try {
      // Save user message to database
      const mensajeId = await sendMensajeAsesor(
        conversacionActiva.id,
        'usuario',
        textoMensaje
      );

      const nuevoMensaje: Mensaje = {
        id: mensajeId,
        rol: 'usuario',
        contenido: textoMensaje,
        timestamp: new Date(),
      };

      const conversacionActualizada = {
        ...conversacionActiva,
        mensajes: [...conversacionActiva.mensajes, nuevoMensaje],
      };

      setConversacionActiva(conversacionActualizada);
      setConversaciones(prev => prev.map(c => 
        c.id === conversacionActiva.id ? conversacionActualizada : c
      ));

      // Call OpenAI API for intelligent response
      const response = await fetch('/api/assistant/asesor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asesorId: user.id,
          conversacionId: conversacionActiva.id,
          mensaje: textoMensaje,
          historial: conversacionActiva.mensajes.map(m => ({
            rol: m.rol,
            contenido: m.contenido,
          })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        const respuestaTexto = data.respuesta;
        const fuentes = data.fuentes || ['Plan General Contable', 'Normativa fiscal vigente'];
        
        // Save assistant response to database
        const respuestaId = await sendMensajeAsesor(
          conversacionActiva.id,
          'asistente',
          respuestaTexto,
          { fuentes }
        );

        const respuestaIA: Mensaje = {
          id: respuestaId,
          rol: 'asistente',
          contenido: respuestaTexto,
          timestamp: new Date(),
          fuentes,
        };

        setConversacionActiva(prev => {
          if (!prev) return null;
          const actualizada = {
            ...prev,
            mensajes: [...prev.mensajes, respuestaIA],
          };
          setConversaciones(prevConv => prevConv.map(c => 
            c.id === prev.id ? actualizada : c
          ));
          return actualizada;
        });
      } else {
        throw new Error(data.error || 'Error al obtener respuesta');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show error message
      const errorMsg: Mensaje = {
        id: Date.now().toString(),
        rol: 'asistente',
        contenido: '❌ Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, intenta de nuevo.',
        timestamp: new Date(),
      };
      
      setConversacionActiva(prev => {
        if (!prev) return null;
        return {
          ...prev,
          mensajes: [...prev.mensajes, errorMsg],
        };
      });
    } finally {
      setEsperandoRespuesta(false);
    }
  };

  const handleNuevaConversacion = async () => {
    if (!user?.id) return;

    try {
      const nuevaId = await createConversacionAsesor(user.id, 'Nueva conversación');
      const nueva: Conversacion = {
        id: nuevaId,
        titulo: 'Nueva conversación',
        fecha: new Date(),
        mensajes: [],
      };
      setConversaciones([nueva, ...conversaciones]);
      setConversacionActiva(nueva);
      
      // Automatically enable editing for the new conversation
      setEditandoConversacionId(nuevaId);
      setNuevoTitulo('Nueva conversación');
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleIniciarEdicion = (conversacion: Conversacion) => {
    setEditandoConversacionId(conversacion.id);
    setNuevoTitulo(conversacion.titulo);
    setMostrandoMenuId(null);
  };

  const handleGuardarTitulo = async () => {
    if (!editandoConversacionId || !nuevoTitulo.trim()) return;

    try {
      await updateConversacionAsesorTitulo(editandoConversacionId, nuevoTitulo.trim());
      
      // Update local state
      setConversaciones(prev => 
        prev.map(c => c.id === editandoConversacionId ? { ...c, titulo: nuevoTitulo.trim() } : c)
      );
      
      if (conversacionActiva?.id === editandoConversacionId) {
        setConversacionActiva(prev => prev ? { ...prev, titulo: nuevoTitulo.trim() } : null);
      }
      
      setEditandoConversacionId(null);
      setNuevoTitulo('');
    } catch (error) {
      console.error('Error updating title:', error);
      alert('Error al actualizar el nombre de la conversación');
    }
  };

  const handleCancelarEdicion = () => {
    setEditandoConversacionId(null);
    setNuevoTitulo('');
  };

  const handleEliminarConversacion = async (conversacionId: string) => {
    setConversacionAEliminar(conversacionId);
    setMostrandoMenuId(null);
  };

  const confirmarEliminarConversacion = async () => {
    if (!conversacionAEliminar) return;

    try {
      await deleteConversacionAsesor(conversacionAEliminar);
      
      // Update local state
      setConversaciones(prev => prev.filter(c => c.id !== conversacionAEliminar));
      
      // If deleting the active conversation, select the first remaining one
      if (conversacionActiva?.id === conversacionAEliminar) {
        const remaining = conversaciones.filter(c => c.id !== conversacionAEliminar);
        setConversacionActiva(remaining.length > 0 ? remaining[0] : null);
      }
      
      setConversacionAEliminar(null);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Error al eliminar la conversación');
      setConversacionAEliminar(null);
    }
  };

  if (cargando) {
    return (
      <Layout rol="asesor">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-asesor mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando asistente...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="asesor">
      {/* Mobile sidebar toggle button */}
      <button
        onClick={() => setMostrandoSidebar(!mostrandoSidebar)}
        className="md:hidden fixed top-20 left-4 z-50 bg-asesor text-white p-2 rounded-lg shadow-lg"
      >
        {mostrandoSidebar ? '✕' : '☰'}
      </button>

      <div className="h-[calc(100vh-72px)] flex flex-col md:flex-row gap-4 md:gap-6 p-4 md:p-8">
        {/* Sidebar - Hidden on mobile unless toggled, always visible on desktop */}
        <div className={`
          fixed md:relative inset-0 md:inset-auto z-40 md:z-auto
          bg-white md:bg-transparent
          w-full md:w-80 md:flex-shrink-0
          flex flex-col space-y-4
          p-4 md:p-0
          transition-transform duration-300 ease-in-out
          ${mostrandoSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <button
            onClick={() => {
              handleNuevaConversacion();
              setMostrandoSidebar(false);
            }}
            className="btn btn-asesor w-full"
          >
            ➕ Nueva Conversación
          </button>

          <div className="card flex-1 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Historial</h3>
            <div className="space-y-2">
              {conversaciones.map(conv => (
                <div
                  key={conv.id}
                  className={`relative rounded-lg transition-colors ${
                    conversacionActiva?.id === conv.id
                      ? 'bg-asesor/10 border-2 border-asesor'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  {editandoConversacionId === conv.id ? (
                    <div className="p-3 space-y-2">
                      <input
                        type="text"
                        value={nuevoTitulo}
                        onChange={(e) => setNuevoTitulo(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleGuardarTitulo();
                          } else if (e.key === 'Escape') {
                            handleCancelarEdicion();
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-asesor rounded focus:outline-none focus:ring-2 focus:ring-asesor"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleGuardarTitulo}
                          className="flex-1 px-2 py-1 text-xs bg-asesor text-white rounded hover:bg-asesor/90"
                        >
                          ✓ Guardar
                        </button>
                        <button
                          onClick={handleCancelarEdicion}
                          className="flex-1 px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                          ✗ Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setConversacionActiva(conv);
                          setMostrandoSidebar(false);
                        }}
                        className="w-full text-left p-3"
                      >
                        <div className="font-medium text-sm text-gray-900 truncate pr-8">
                          {conv.titulo}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {conv.fecha.toLocaleDateString('es-ES')}
                        </div>
                      </button>
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={() => setMostrandoMenuId(mostrandoMenuId === conv.id ? null : conv.id)}
                          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                        >
                          ⋮
                        </button>
                        {mostrandoMenuId === conv.id && (
                          <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                            <button
                              onClick={() => handleIniciarEdicion(conv)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                            >
                              <span>✏️</span> Renombrar
                            </button>
                            <button
                              onClick={() => handleEliminarConversacion(conv.id)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                              <span>🗑️</span> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0 w-full">
          <div className="card hidden md:block mb-3 md:mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Asistente E2 - Asesor</h1>
                <p className="text-gray-600 text-xs md:text-sm mt-1">
                  Inteligencia operativa especializada en contabilidad y fiscalidad
                </p>
              </div>
              <div className="text-3xl md:text-4xl">🧠</div>
            </div>
          </div>

          {/* Chat messages - scrollable area with bottom padding for fixed input */}
          <div className="flex-1 card overflow-y-auto min-h-0 mb-20 md:mb-2">
            <div className="space-y-4">
              {conversacionActiva?.mensajes.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-3xl rounded-lg p-3 md:p-4 ${
                      msg.rol === 'usuario'
                        ? 'bg-asesor text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm md:text-base">{msg.contenido}</div>
                    {msg.fuentes && msg.fuentes.length > 0 && (
                      <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-300">
                        <div className="text-[10px] md:text-xs font-semibold mb-1">Fuentes:</div>
                        <div className="flex flex-wrap gap-2">
                          {msg.fuentes.map((fuente, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] md:text-xs bg-white/20 px-2 py-1 rounded"
                            >
                              📚 {fuente}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className={`text-[10px] md:text-xs mt-2 ${
                      msg.rol === 'usuario' ? 'text-white/70' : 'text-gray-500'
                    }`}>
                      {msg.timestamp.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
              
              {esperandoRespuesta && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3 md:p-4">
                    <div className="flex items-center space-x-2">
                      <div className="animate-bounce">●</div>
                      <div className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</div>
                      <div className="animate-bounce" style={{ animationDelay: '0.4s' }}>●</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input area - fixed at bottom above navbar */}
          <div className="fixed bottom-14 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-white p-2 mx-4 md:mx-0 md:p-0 border-t md:border-t-0 shadow-lg md:shadow-none z-30">
            <form onSubmit={handleEnviarMensaje} className="md:card max-w-4xl mx-auto md:max-w-none md:!px-4 md:!py-2">
              <div className="flex gap-2 md:gap-3">
                <input
                  type="text"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Pregúntame sobre contabilidad..."
                  className="input flex-1 text-sm md:text-base"
                  disabled={esperandoRespuesta}
                />
                <button
                  type="submit"
                  className="btn btn-asesor text-sm md:text-base px-3 md:px-4"
                  disabled={!mensaje.trim() || esperandoRespuesta}
                >
                  <span className="hidden sm:inline">Enviar</span>
                  <span className="sm:hidden">➤</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {conversacionAEliminar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Eliminar conversación
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar esta conversación? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConversacionAEliminar(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminarConversacion}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
