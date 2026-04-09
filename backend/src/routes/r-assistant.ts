/**
 * Archivo: src/routes/r-assistant.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura, que comprende la interfaz de programacion 
 * de aplicaciones y la logica de negocio. Su funcion es exponer un punto de acceso dedicado para el 
 * asistente virtual, facilitando la interaccion conversacional de los turistas. Al conectarse de 
 * forma asincrona con los servicios de inteligencia de la capa cuatro, esta ruta actua como un 
 * intermediario seguro que intercepta la peticion, valida los privilegios del cliente mediante 
 * el control de acceso y coordina la generacion de respuestas enriquecidas con el contexto geografico.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { mAuth } from '../middleware/m-auth.js';
import { mRequireRole } from '../middleware/m-rbac.js';
import { sResponderTurista } from '../services/s-assistant.js';
import type { ApiResponse, AppContext } from '../types/t-app.js';

export const rAssistant = new Hono<AppContext>();

/**
 * Esquema de validacion estructurada para las peticiones del asistente.
 *
 * Efecto: Asegurar que los datos suministrados por el cliente cumplan con los limites 
 * de longitud permitidos y correspondan a los tipos esperados, previniendo inyecciones 
 * maliciosas y garantizando la compatibilidad con los requerimientos del idioma.
 */
const rAssistantSchema = z.object({
  message: z.string().min(1).max(500),
  history: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  lang: z.enum(['es', 'en', 'fr', 'pt', 'de', 'zh']).optional(),
});

/**
 * Procesar la interaccion del usuario y emitir una respuesta inteligente.
 *
 * Ruta asociada: Metodo de envio en la ruta principal del chat interactivo.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red que transporta el cuerpo de la peticion validada, el cual 
 * incluye el texto del mensaje, la cadena del historial, las coordenadas espaciales y 
 * la preferencia idiomatica.
 * Retorno: Promesa que resuelve en un objeto con formato Json conteniendo la respuesta 
 * elaborada y una accion sugerida para guiar la aplicacion cliente.
 * Efecto: Delegar el procesamiento semantico al servicio especializado, pausar la 
 * ejecucion hasta obtener la inferencia del modelo externo y encapsular el resultado 
 * en una estructura estandarizada de exito o fallo.
 *
 * Complejidad temporal: Orden constante O(1) para el servidor local, dado que la 
 * validacion es lineal respecto al mensaje corto y la carga computacional profunda se 
 * traslada completamente al proveedor externo de la capa cuatro.
 * Complejidad espacial: Orden constante O(1). La retencion de datos en memoria se 
 * restringe a la cadena de texto del historial iterado y a la respuesta recibida.
 * Escalabilidad: Sobresaliente. La arquitectura libre de estado permite que el servidor 
 * mantenga multiples peticiones en espera de manera no bloqueante. El limite real de 
 * escalabilidad estara dictado por la cuota del modelo externo, lo cual justifica la 
 * capacidad de absorber picos de trafico sin comprometer el rendimiento general del sistema.
 */
rAssistant.post(
  '/chat',
  mAuth,
  mRequireRole('tourist'),
  zValidator('json', rAssistantSchema),
  async (ctx) => {
    const { message, history, lat, lng, lang } = ctx.req.valid('json');

    try {
      const assistantResponse = await sResponderTurista(message, history, lat, lng, lang);

      return ctx.json<ApiResponse>({
        data: {
          reply: assistantResponse.reply,
          action: assistantResponse.action,
        },
        error: null,
      });
    } catch (err) {
      console.error(err);
      return ctx.json<ApiResponse>({ data: null, error: 'Error interno del asistente' }, 500);
    }
  }
);