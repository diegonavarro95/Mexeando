/**
 * Archivo: src/socket/chatHandler.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo consolida la integracion de la mensajeria interactiva en tiempo real 
 * basada en eventos (WebSockets) dentro del ecosistema de Hono. Pertenece a la capa 
 * dos de la arquitectura (Logica de Negocio), funcionando de forma adyacente a las 
 * rutas HTTP estandar. Su proposito arquitectonico es mantener conexiones de red 
 * persistentes, permitiendo que turistas y comercios locales establezcan un puente 
 * de comunicacion asistida (con la capa cuatro - Inteligencia Artificial) en 
 * donde la latencia de conexion-desconexion inherente del protocolo HTTP desaparece.
 */

// src/socket/chatHandler.ts
import type { Server, Socket } from 'socket.io'
import { sVerifyAccessToken } from '../services/s-auth.js'
import { lSupabase } from '../lib/l-supabase.js'
import { GoogleGenAI } from '@google/genai';

/**
 * Traducir el objeto estructurado de horarios a un formato comprensible.
 *
 * Tipo: Funcion utilitaria sincronica.
 * Parametros: Objeto serializado conteniendo arreglos de horas agrupadas por dia.
 * Retorno: Cadena de texto formateada para el consumo del modelo de lenguaje.
 *
 * Complejidad temporal: Orden constante O(1). Iteracion acotada sobre los 7 dias.
 * Complejidad espacial: Orden constante O(1).
 */
const formatearHorario = (horario: any) => {
    if (!horario) return "No Especificado";

    return `
    Lunes: ${horario.mon?.join(" a ") || "Cerrado"}
    Martes: ${horario.tue?.join(" a ") || "Cerrado"}
    Miércoles: ${horario.wed?.join(" a ") || "Cerrado"}
    Jueves: ${horario.thu?.join(" a ") || "Cerrado"}
    Viernes: ${horario.fri?.join(" a ") || "Cerrado"}
    Sábado: ${horario.sat?.join(" a ") || "Cerrado"}
    Domingo: ${horario.sun?.join(" a ") || "Cerrado"}
    ${horario.nota_adicional ? `Nota adicional: ${horario.nota_adicional}` : ""}
    `.trim();
};

// Contexto que se carga al iniciar la sesión de chat y se adjunta al socket
interface ChatContext {
  userId: string
  businessId: string
  businessName: string
  businessDescription: string | null
  businessHours: any         
  menuSummary: string        
  preferredLang: string      
}

/**
 * Instanciar el contexto operativo de un comercio extrayendo datos relacionales.
 *
 * Tipo: Funcion de integracion asincrona.
 * Parametros: Identificador del comercio.
 * Retorno: Promesa resolviendo en el estado contextual del negocio.
 * Efecto: Ejecutar una lectura directa sobre el motor relacional (Capa 3) para 
 * recuperar descripcion, horarios y filtrar la disponibilidad activa del menu, 
 * inyectando dichos datos en una estructura de memoria consumible por el socket.
 *
 * Complejidad temporal: Orden constante O(1). Consultas eficientes sobre claves unicas.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Optima. Resuelve la inicializacion de la conexion (Handshake) con 
 * latencia minima.
 */
// Consulta el perfil del negocio para construir el contexto del prompt
async function sLoadBusinessContext(businessId: string): Promise<Omit<ChatContext, 'userId' | 'preferredLang'> | null> {
  const { data, error } = await lSupabase
    .from('businesses')
    .select(`
      id, name, description, schedule,
      menu_items ( name, price, icon, is_available )
    `)
    .eq('id', businessId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single()

  if (error || !data) return null

  const items = (data.menu_items ?? []) as Array<{ name: string; price: number | null; icon: string | null; is_available: boolean }>
  const availableItems = items.filter(i => i.is_available)

  const menuSummary = availableItems.length > 0
    ? availableItems.map(i => `${i.icon ?? ''} ${i.name}${i.price != null ? ` ($${i.price} MXN)` : ''}`).join(', ')
    : 'Menú no disponible'

  return {
    businessId,
    businessName:        data.name,
    businessDescription: data.description,
    businessHours:       data.schedule,
    menuSummary,
  }
}

/**
 * Formular las directivas estructurales para regir el comportamiento del asistente virtual.
 *
 * Tipo: Funcion utilitaria sincronica.
 * Parametros: Contexto instanciado con los datos operativos del comercio.
 * Retorno: Cadena literaria estandarizada (Prompt).
 * Efecto: Establece los limites logicos y el tono de respuesta que el modelo fundacional 
 * debe adoptar, obligando a la maquina a funcionar como una extension del local fisico, 
 * sin desviar su atencion (evitando alucinaciones) ni emitir recomendaciones sobre la competencia.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 */
// Construye el system prompt para Gemini con el contexto del negocio
function sBuildSystemPrompt(ctx: ChatContext): string {
  return `Eres el asistente virtual de "${ctx.businessName}", un negocio local mexicano registrado en La Ruta de la Garnacha para el Mundial FIFA 2026.

Descripción del negocio: ${ctx.businessDescription ?? 'No disponible'}

Horarios de atención:
${formatearHorario(ctx.businessHours)}

Menú disponible: ${ctx.menuSummary}

Instrucciones:
- Responde SIEMPRE en el mismo idioma que usa el turista. Si escribe en inglés, responde en inglés. Si escribe en francés, responde en francés.
- Sé amable, conciso y útil. Máximo 3 oraciones por respuesta.
- Puedes responder preguntas sobre el menú, precios, horarios, cómo llegar o qué hace especial a este negocio.
- Si te preguntan algo que no sabes, di que no tienes esa información y sugiere llamar directamente al negocio.
- No inventes precios ni información que no tengas. No hagas promesas de reservas o pagos.
- Nunca menciones a otros negocios ni hagas comparaciones.`
}

/**
 * Orquestar el ciclo de vida, eventos de red y seguridad para las conexiones por WebSockets.
 *
 * Tipo: Funcion registradora de eventos.
 * Parametros: Instancia del servidor Socket.io en ejecucion.
 * Retorno: Ausencia de retorno.
 * Efecto: Inicializa el ecosistema conversacional. Aplica un interceptor de autenticacion al 
 * momento de establecer el canal TCP (Handshake), validando criptograficamente el testigo de sesion 
 * (JWT). Una vez autorizada la conexion persistente, suscribe al socket del cliente a las ranuras de 
 * emision y recepcion logica (eventos on('chat:...')) para canalizar la mensajeria hacia la interfaz de Gemini.
 *
 * Complejidad temporal: Orden constante O(1) de asignacion en memoria durante el despliegue del servidor.
 * Las transacciones posteriores de mensajeria operan en un orden constante, penalizadas unicamente por el tiempo de generacion de inferencia.
 * Complejidad espacial: Orden lineal O(c) donde c es la cantidad de conexiones websocket concurrentes activas 
 * alojadas en la memoria operativa (RAM) de la aplicacion.
 * Escalabilidad: Moderada a Alta. La arquitectura orientada a eventos bidireccionales previene la sobrecarga de 
 * encabezados HTTP por cada mensaje enviado (polling), reduciendo el consumo de ancho de banda. 
 * Sin embargo, las conexiones persistentes agotan los descriptores de archivos (File Descriptors) del sistema 
 * anfitrion; para soportar decenas de miles de turistas interconectados durante el mundial, este nodo requeriria 
 * conectarse a un adaptador distribuido (Redis Adapter) para orquestar la mensajeria entre multiples nucleos o servidores paralelos.
 */
export function registerChatHandler(io: Server): void {
  // Inicializamos el SDK de Google solo una vez para mejor rendimiento y reutilizacion de la conexion
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Interceptor de autenticación ejecutado estrictamente en la fase inicial (handshake) del conducto.
  io.use(async (socket, next) => {
    const rawToken = (socket.handshake.auth?.token || socket.handshake.headers.authorization) as string | undefined
    
    if (!rawToken?.startsWith('Bearer ')) {
      return next(new Error('AUTH_REQUIRED'))
    }

    try {
      const payload = await sVerifyAccessToken(rawToken.slice(7))
      // Incorporar en la memoria efimera del conducto la identidad del emisor.
      ;(socket as Socket & { userId: string }).userId = payload.sub
      next()
    } catch {
      next(new Error('TOKEN_INVALID'))
    }
  })

  // Resolucion exitosa de conexion y apertura de lineas de escucha.
  io.on('connection', (socket) => {
    const userId = (socket as Socket & { userId: string }).userId
    // Mantener un contexto encapsulado para la iteracion actual del usuario
    let chatCtx: ChatContext | null = null

    // Suscripcion a un canal de transmision aislado por entidad comercial.
    socket.on('chat:join', async (payload: { businessId: string; preferredLang?: string }) => {
      if (!payload?.businessId) {
        socket.emit('chat:error', { code: 'MISSING_BUSINESS_ID' })
        return
      }

      const bizCtx = await sLoadBusinessContext(payload.businessId)

      if (!bizCtx) {
        socket.emit('chat:error', { code: 'BUSINESS_NOT_FOUND' })
        return
      }

      chatCtx = {
        ...bizCtx,
        userId,
        preferredLang: payload.preferredLang ?? 'es',
      }

      // Unificacion del canal; aislando logicamente las conversaciones simultaneas
      const roomName = `chat:${userId}:${payload.businessId}`
      await socket.join(roomName)

      // Confirmacion asincrona hacia la interfaz frontal (UI)
      socket.emit('chat:joined', {
        businessName: chatCtx.businessName,
        roomName,
      })
    })

    // Transmision y resolucion logica del cuerpo del mensaje interactivo.
    socket.on('chat:message', async (payload: { message: string }) => {
      if (!chatCtx) {
        socket.emit('chat:error', { code: 'JOIN_REQUIRED', message: 'Emite chat:join primero' })
        return
      }

      const userMessage = payload?.message?.trim()
      if (!userMessage || userMessage.length > 500) {
        socket.emit('chat:error', { code: 'INVALID_MESSAGE' })
        return
      }

      // Emision tactica para simular retroalimentacion mecanica (Human-like presence)
      socket.emit('chat:typing', { typing: true })

      try {
        // Comunicacion en segundo plano con el proveedor de IA delegando el contexto
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userMessage, 
            config: {
                systemInstruction: sBuildSystemPrompt(chatCtx), 
                temperature: 0.7,
                maxOutputTokens: 256,
            }
        });

        const aiText = response.text || 'Lo siento, no pude generar una respuesta.';

        // Finalizacion de interaccion tactica y entrega transaccional
        socket.emit('chat:typing', { typing: false });
        socket.emit('chat:response', {
          message: aiText,
          businessId: chatCtx.businessId,
          timestamp: new Date().toISOString(),
        });

      } catch (err) {
        // Tolerancia a fallos: mitigar panico del conducto enviando senal de interrupcion limpia.
        socket.emit('chat:typing', { typing: false });
        socket.emit('chat:error', {
          code: 'AI_ERROR',
          message: 'El asistente no está disponible en este momento',
        });
        console.error('[chat:message] Error de resolucion en la capa cuatro:', err);
      }
    })

    // Limpieza de memoria (Garbage Collection) y recesion del estado.
    socket.on('disconnect', () => {
      chatCtx = null
    })
  })
}