import { useState } from 'react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface FinancialAIAssistantProps {
  clienteId?: string;
  asesorView?: boolean;
}

export default function FinancialAIAssistant({ clienteId, asesorView = false }: FinancialAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: asesorView 
        ? '¡Hola! Soy tu asistente financiero. Puedo ayudarte a analizar datos financieros, calcular ratios, y responder preguntas sobre la situación económica de tus clientes.'
        : '¡Hola! Soy tu asistente financiero. Puedo ayudarte a entender tus números y responder preguntas sobre tu negocio.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/financial-ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          question: input,
          asesorView
        })
      });

      if (!response.ok) throw new Error('Error en la consulta');

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la consulta');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu pregunta. Por favor, inténtalo de nuevo.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = asesorView ? [
    '¿Cuál es el margen promedio de mis clientes?',
    '¿Qué clientes tienen riesgo financiero alto?',
    'Análisis de liquidez de todos los clientes',
    'Tendencia de facturación este trimestre'
  ] : [
    '¿Cuánto he facturado de enero a septiembre?',
    '¿Cuál es mi margen de beneficio?',
    'Análisis de mis gastos principales',
    '¿Cómo está mi flujo de caja?'
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="font-bold text-lg flex items-center space-x-2">
          <span>🤖</span>
          <span>Asistente Financiero IA</span>
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Pregunta sobre datos financieros y obtén análisis instantáneos
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-asesor text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs mt-2 opacity-70">
                {msg.timestamp.toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600 mb-2">Preguntas sugeridas:</p>
          <div className="space-y-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setInput(q)}
                className="w-full text-left text-sm p-2 bg-white border border-gray-200 rounded hover:border-asesor hover:bg-blue-50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe tu pregunta..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asesor"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="btn btn-asesor"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
