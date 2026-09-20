import { useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/authContext';

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

export default function AdminAsistente() {
  const { user } = useAuth();
  
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([
    {
      id: '1',
      titulo: 'Estadísticas de procesamiento IA',
      fecha: new Date(2025, 9, 20),
      mensajes: [
        {
          id: '1',
          rol: 'usuario',
          contenido: '¿Cuántos documentos se han procesado este mes?',
          timestamp: new Date(2025, 9, 20, 10, 30),
        },
        {
          id: '2',
          rol: 'asistente',
          contenido: 'Este mes se han procesado 347 documentos mediante IA, con una tasa de éxito del 94.2%. El resto (20 documentos) requirieron revisión manual.',
          timestamp: new Date(2025, 9, 20, 10, 30),
          fuentes: ['Sistema de Contabilización IA', 'Dashboard Global'],
        },
      ],
    },
  ]);
  
  const [conversacionActiva, setConversacionActiva] = useState<Conversacion | null>(conversaciones[0]);
  const [mensaje, setMensaje] = useState('');
  const [esperandoRespuesta, setEsperandoRespuesta] = useState(false);

  const preguntasSugeridas = [
    '¿Cuál es el estado actual del sistema de IA?',
    '¿Qué clientes tienen incidencias abiertas?',
    '¿Cómo puedo optimizar el procesamiento de documentos?',
    '¿Cuáles son las métricas clave de este mes?',
    'Muéstrame un resumen de actividad por asesor',
  ];

  const handleEnviarMensaje = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim() || !conversacionActiva) return;

    const nuevoMensaje: Mensaje = {
      id: Date.now().toString(),
      rol: 'usuario',
      contenido: mensaje,
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
    
    setMensaje('');
    setEsperandoRespuesta(true);

    setTimeout(() => {
      const respuestaIA: Mensaje = {
        id: (Date.now() + 1).toString(),
        rol: 'asistente',
        contenido: generarRespuestaIA(mensaje),
        timestamp: new Date(),
        fuentes: ['Base de conocimiento E2', 'Datos del sistema'],
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
      
      setEsperandoRespuesta(false);
    }, 1500);
  };

  const generarRespuestaIA = (pregunta: string): string => {
    const preguntaLower = pregunta.toLowerCase();
    
    if (preguntaLower.includes('cliente') || preguntaLower.includes('clientes')) {
      return 'Actualmente tienes 45 clientes activos en la plataforma. 38 tienen al menos un asesor asignado. 3 clientes tienen incidencias abiertas que requieren atención inmediata.';
    }
    if (preguntaLower.includes('documento') || preguntaLower.includes('documentos')) {
      return 'Este mes se han subido 347 documentos. El 94.2% se procesaron correctamente con IA. El tiempo medio de procesamiento es de 2.3 segundos por documento.';
    }
    if (preguntaLower.includes('incidencia') || preguntaLower.includes('incidencias')) {
      return 'Hay 12 incidencias abiertas en total. 5 son de origen IA, 4 fueron creadas manualmente por asesores, y 3 fueron reportadas por clientes. El tiempo medio de resolución es de 1.8 días.';
    }
    if (preguntaLower.includes('asesor') || preguntaLower.includes('asesores')) {
      return 'Tienes 8 asesores activos. Marta García lidera con 15 clientes asignados y 120 documentos procesados este mes. Carlos Ruiz tiene la mejor tasa de resolución de incidencias (2.1 días).';
    }
    
    return 'Entiendo tu consulta. Como administrador, puedes acceder a toda la información del sistema a través de los módulos específicos. ¿Hay algo concreto sobre clientes, documentos, asesores o incidencias que quieras revisar?';
  };

  const handleNuevaConversacion = () => {
    const nueva: Conversacion = {
      id: Date.now().toString(),
      titulo: 'Nueva conversación',
      fecha: new Date(),
      mensajes: [],
    };
    setConversaciones([nueva, ...conversaciones]);
    setConversacionActiva(nueva);
  };

  const handlePreguntaSugerida = (pregunta: string) => {
    setMensaje(pregunta);
  };

  return (
    <Layout rol="admin">
      <div className="h-[calc(100vh-72px)] flex gap-6 p-4 md:p-8">
        <div className="w-80 flex-shrink-0 space-y-4">
          <button
            onClick={handleNuevaConversacion}
            className="btn btn-admin w-full"
          >
            ➕ Nueva Conversación
          </button>

          <div className="card h-[calc(100%-4rem)] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Historial</h3>
            <div className="space-y-2">
              {conversaciones.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setConversacionActiva(conv)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    conversacionActiva?.id === conv.id
                      ? 'bg-admin/10 border-2 border-admin'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {conv.titulo}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {conv.fecha.toLocaleDateString('es-ES')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="card mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Asistente E2 - Admin</h1>
                <p className="text-gray-600 text-sm mt-1">
                  Consultor inteligente con acceso a toda la base de conocimiento
                </p>
              </div>
              <div className="text-4xl">🧠</div>
            </div>
          </div>

          {conversacionActiva && conversacionActiva.mensajes.length === 0 && (
            <div className="card mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">Preguntas sugeridas:</h3>
              <div className="grid grid-cols-1 gap-2">
                {preguntasSugeridas.map((pregunta, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePreguntaSugerida(pregunta)}
                    className="text-left p-3 bg-admin/5 hover:bg-admin/10 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    💬 {pregunta}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 card overflow-y-auto mb-4">
            <div className="space-y-4">
              {conversacionActiva?.mensajes.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3xl rounded-lg p-4 ${
                      msg.rol === 'usuario'
                        ? 'bg-admin text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.contenido}</div>
                    {msg.fuentes && msg.fuentes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <div className="text-xs font-semibold mb-1">Fuentes:</div>
                        <div className="flex flex-wrap gap-2">
                          {msg.fuentes.map((fuente, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-white/20 px-2 py-1 rounded"
                            >
                              📚 {fuente}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className={`text-xs mt-2 ${
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
                  <div className="bg-gray-100 rounded-lg p-4">
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

          <form onSubmit={handleEnviarMensaje} className="card">
            <div className="flex gap-3">
              <input
                type="text"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribe tu consulta..."
                className="input flex-1"
                disabled={esperandoRespuesta}
              />
              <button
                type="submit"
                className="btn btn-admin"
                disabled={!mensaje.trim() || esperandoRespuesta}
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
