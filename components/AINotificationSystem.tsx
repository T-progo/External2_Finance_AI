import React, { useState, useEffect } from 'react';
import { Incidencia } from '@/types';
import { addMensajeIncidencia } from '@/lib/supabaseService';

interface AINotificationSystemProps {
  incidencias: Incidencia[];
  onIncidenciaUpdated?: (incidencia: Incidencia) => void;
}

export default function AINotificationSystem({ 
  incidencias, 
  onIncidenciaUpdated 
}: AINotificationSystemProps) {
  const [notificationsSent, setNotificationsSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkInactiveIncidents = async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      for (const incidencia of incidencias) {
        // Skip if already sent notification for this incident
        if (notificationsSent.has(incidencia.id)) continue;
        
        // Skip closed incidents
        if (incidencia.estado === 'cerrada') continue;

        const lastActivity = incidencia.fechaUltimaRespuesta || incidencia.fechaCreacion;
        const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

        let shouldNotify = false;
        let notificationMessage = '';

        if (daysSinceActivity >= 7) {
          shouldNotify = true;
          notificationMessage = `🤖 Hola! He notado que esta incidencia lleva ${daysSinceActivity} días sin actividad. ¿Necesitas ayuda adicional o hay algo más que pueda hacer por ti?`;
        } else if (daysSinceActivity >= 3 && incidencia.estado === 'nueva') {
          shouldNotify = true;
          notificationMessage = `🤖 Hola! Tu incidencia lleva ${daysSinceActivity} días sin respuesta. Tu asesor debería revisarla pronto. ¿Hay algo más que pueda ayudarte mientras tanto?`;
        }

        if (shouldNotify) {
          try {
            // Add AI message to the incident
            await addMensajeIncidencia(incidencia.id, {
              usuarioId: 'ai-system',
              rol: 'cliente', // AI messages appear as if from the system
              mensaje: notificationMessage,
              archivosAdjuntos: [],
              esIA: true,
            });

            // Mark notification as sent
            setNotificationsSent(prev => new Set([...prev, incidencia.id]));

            // Notify parent component
            const updatedIncidencia = {
              ...incidencia,
              mensajes: [
                ...incidencia.mensajes,
                {
                  id: `ai-${Date.now()}`,
                  usuarioId: 'ai-system',
                  rol: 'cliente' as const,
                  mensaje: notificationMessage,
                  fecha: new Date(),
                  archivosAdjuntos: [],
                  esIA: true,
                }
              ],
              fechaUltimaRespuesta: new Date(),
            };

            onIncidenciaUpdated?.(updatedIncidencia);

            console.log(`AI notification sent for incident ${incidencia.id}`);
          } catch (error) {
            console.error('Error sending AI notification:', error);
          }
        }
      }
    };

    // Check for inactive incidents every hour
    const interval = setInterval(checkInactiveIncidents, 60 * 60 * 1000);
    
    // Also check immediately
    checkInactiveIncidents();

    return () => clearInterval(interval);
  }, [incidencias, notificationsSent, onIncidenciaUpdated]);

  // This component doesn't render anything visible
  return null;
}

// Hook for manual AI notifications
export const useAINotifications = (incidencias: Incidencia[]) => {
  const [isChecking, setIsChecking] = useState(false);

  const sendManualNotification = async (incidenciaId: string, message: string) => {
    setIsChecking(true);
    try {
      await addMensajeIncidencia(incidenciaId, {
        usuarioId: 'ai-system',
        rol: 'cliente',
        mensaje: `🤖 ${message}`,
        archivosAdjuntos: [],
        esIA: true,
      });
      return true;
    } catch (error) {
      console.error('Error sending manual AI notification:', error);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const getInactiveIncidents = () => {
    const now = new Date();
    return incidencias.filter(inc => {
      if (inc.estado === 'cerrada') return false;
      
      const lastActivity = inc.fechaUltimaRespuesta || inc.fechaCreacion;
      const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysSinceActivity >= 3;
    });
  };

  return {
    sendManualNotification,
    getInactiveIncidents,
    isChecking,
  };
};
