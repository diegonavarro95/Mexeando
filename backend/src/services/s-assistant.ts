/**
 * Archivo: src/services/s-assistant.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo opera dentro de la capa dos de la arquitectura (Logica de Negocio), funcionando 
 * como un servicio delegado. Su funcion arquitectonica es intermediar la comunicacion entre los 
 * controladores de red de la aplicacion y los modelos de inteligencia de la capa cuatro. 
 * Aplica el patron RAG (Retrieval-Augmented Generation) para dotar al modelo fundacional con 
 * contexto veridico y determinista extraido de la base de datos local de la capa tres, evitando 
 * asi las alucinaciones del modelo y garantizando que las recomendaciones de negocios existan 
 * en el inventario actual de la aplicacion.
 */

import { GoogleGenAI, Type } from '@google/genai';

import { lSupabase } from '../lib/l-supabase.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Tipos estructurados para gobernar las decisiones del motor de analisis de intenciones.
type AssistantIntent =
  | 'BUSCAR_MEJORES'
  | 'BUSCAR_CERCANOS'
  | 'VER_MENU'
  | 'INFO_SISTEMA'
  | 'FUERA_DE_TEMA';

type AssistantLang = 'es' | 'en' | 'fr' | 'pt' | 'de' | 'zh';

interface IntentResult {
  intent: AssistantIntent;
  parametros?: { categoria?: string; nombre_negocio?: string };
}

export interface AssistantReply {
  reply: string;
  action?: { url: string; label: string };
}

const LANGUAGE_NAMES: Record<AssistantLang, string> = {
  es: 'Spanish',
  en: 'English',
  fr: 'French',
  pt: 'Portuguese',
  de: 'German',
  zh: 'Simplified Chinese',
};

// Coleccion inmutable de respuestas de contingencia controladas para garantizar una experiencia multilingue sin fallos.
const ASSISTANT_COPY: Record<
  AssistantLang,
  {
    offTopic: string;
    needLocation: string;
    technicalIssue: string;
    transientError: string;
  }
> = {
  es: {
    offTopic:
      '¡Híjole! Me encantaría platicar de eso, pero mi especialidad es La Ruta de la Garnacha. Mejor pregúntame sobre tacos, negocios locales o tu pasaporte del Mundial.',
    needLocation:
      '¡Claro que te recomiendo lugares cerquita! Pero primero necesito permiso para ver tu ubicación en el mapa.',
    technicalIssue: 'Tuve un pequeño problema técnico, ¿me repites?',
    transientError: 'Ups, se me fue el internet por un segundo. ¿Me lo repites?',
  },
  en: {
    offTopic:
      'I would love to chat about that, but my specialty is La Ruta de la Garnacha. Ask me about tacos, local businesses, or your World Cup passport instead.',
    needLocation:
      'I can definitely recommend nearby places, but first I need permission to access your location on the map.',
    technicalIssue: 'I hit a small technical issue. Could you ask me again?',
    transientError: 'Oops, my connection dropped for a second. Could you repeat that?',
  },
  fr: {
    offTopic:
      "J'aimerais bien en parler, mais ma spécialité est La Ruta de la Garnacha. Demandez-moi plutôt des tacos, des commerces locaux ou votre passeport du Mondial.",
    needLocation:
      "Je peux vous recommander des endroits proches, mais j'ai d'abord besoin de l'autorisation d'utiliser votre position sur la carte.",
    technicalIssue: "J'ai eu un petit souci technique. Vous pouvez répéter ?",
    transientError: "Oups, ma connexion a coupé un instant. Vous pouvez répéter ?",
  },
  pt: {
    offTopic:
      'Eu adoraria falar sobre isso, mas minha especialidade é a La Ruta de la Garnacha. Melhor me perguntar sobre tacos, negócios locais ou seu passaporte da Copa.',
    needLocation:
      'Posso recomendar lugares próximos, mas primeiro preciso de permissão para usar sua localização no mapa.',
    technicalIssue: 'Tive um pequeno problema técnico. Pode repetir?',
    transientError: 'Ops, perdi a conexão por um segundo. Pode repetir?',
  },
  de: {
    offTopic:
      'Darüber würde ich gern sprechen, aber meine Spezialität ist La Ruta de la Garnacha. Frag mich lieber nach Tacos, lokalen Geschäften oder deinem WM-Pass.',
    needLocation:
      'Ich kann dir gern Orte in der Nähe empfehlen, brauche dafür aber zuerst die Erlaubnis für deinen Standort auf der Karte.',
    technicalIssue: 'Ich hatte ein kleines technisches Problem. Kannst du das wiederholen?',
    transientError: 'Ups, meine Verbindung war kurz weg. Kannst du das wiederholen?',
  },
  zh: {
    offTopic:
      '我很想聊那个话题，但我的专长是 La Ruta de la Garnacha。更适合问我玉米饼、本地商家或你的世界杯护照。',
    needLocation: '我当然可以推荐附近的地方，但首先需要你允许我读取地图上的位置。',
    technicalIssue: '我遇到了一点技术问题，可以再说一次吗？',
    transientError: '哎呀，我刚刚断网了一下。可以再重复一次吗？',
  },
};

/**
 * Inferir la peticion logica del usuario mediante analisis de procesamiento de lenguaje natural.
 *
 * Tipo: Funcion asincrona privativa del servicio.
 * Parametros: Cadena del mensaje nuevo y cadena que representa la conversacion historica.
 * Retorno: Promesa resolviendo en un objeto con tipado seguro que define la categoria de la intencion.
 * Efecto: Canalizar el texto hacia la interfaz del modelo externo instruyendo una clasificacion 
 * forzada. Esta operacion transforma el caos de la conversacion natural en enumeradores rigidos, 
 * permitiendo ejecutar busquedas de bases de datos predecibles.
 *
 * Complejidad temporal: Orden constante O(1) de procesamiento local; dictaminada por la latencia 
 * de red del proveedor del modelo (aproximadamente 300-800ms).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Limitada a la cuota concurrente del proveedor de la Api. Funcional mediante 
 * el enrutador en entorno distribuido sin agotar memoria.
 */
async function analizarIntencion(mensaje: string, historial: string): Promise<IntentResult> {
  const prompt = `
  Analiza el mensaje del usuario y clasificalo en una de estas intenciones:
  - BUSCAR_MEJORES: El usuario pide recomendaciones generales, mejores lugares, restaurantes, taquerias, comida o lugares turisticos.
  - BUSCAR_CERCANOS: Quiere saber que hay cerca de su ubicacion.
  - VER_MENU: Pregunta por platillos, precios o el menu de un negocio especifico.
  - INFO_SISTEMA: Pregunta sobre el pasaporte, album de estampas, check-ins o como funciona la app.
  - FUERA_DE_TEMA: Solo si el tema no tiene nada que ver con comida, turismo, el Mundial o Mexico.

  HISTORIAL: ${historial}
  MENSAJE ACTUAL: ${mensaje}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: {
            type: Type.STRING,
            enum: ['BUSCAR_MEJORES', 'BUSCAR_CERCANOS', 'VER_MENU', 'INFO_SISTEMA', 'FUERA_DE_TEMA'],
          },
          parametros: {
            type: Type.OBJECT,
            properties: {
              categoria: { type: Type.STRING },
              nombre_negocio: { type: Type.STRING },
            },
          },
        },
        required: ['intent'],
      },
    },
  });

  return JSON.parse(response.text || '{"intent":"FUERA_DE_TEMA"}');
}

/**
 * Construir dinamicamente la intervencion del asistente integrando contexto validado.
 *
 * Tipo: Funcion asincrona principal del servicio.
 * Parametros: Mensaje de entrada, historial de dialogo opcional, coordenadas del turista y preferencia de idioma.
 * Retorno: Promesa que entrega una estructura de respuesta compuesta de texto presentable y posibles rutas accionables de aplicacion.
 * Efecto: Dirigir el ciclo de RAG completo. Primero extrae la intencion y determina que bloque 
 * de consulta relacional disparar. Ejecuta la lectura sobre el repositorio local, inyecta los 
 * resultados como contexto en el prompt final, y demanda al modelo una construccion literaria 
 * con matices linguisticos acordes.
 *
 * Complejidad temporal: Orden lineal O(n) donde n es el costo de extraccion de los negocios. El 
 * costo total involucra dos puentes de latencia externa hacia el modelo sumados a la busqueda relacional, 
 * resultando en tiempos esperados superiores al segundo, lo cual es tolerable en interfaces de conversacion interactivas.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Eficaz, pero exige un alto rendimiento del motor de base de datos debido al filtrado 
 * cruzado con las busquedas ilike o espaciales antes de la composicion en la nube.
 */
export async function sResponderTurista(
  mensaje: string,
  historial = '',
  lat?: number,
  lng?: number,
  lang: AssistantLang = 'es'
): Promise<AssistantReply> {
  const safeLang = lang ?? 'es';
  const copy = ASSISTANT_COPY[safeLang];

  try {
    const analisis = await analizarIntencion(mensaje, historial);

    // Abortar tempranamente procesamientos costosos si la intencion evade los dominios del modelo.
    if (analisis.intent === 'FUERA_DE_TEMA') {
      return { reply: copy.offTopic };
    }

    let contextoBD = '';

    // Recuperacion de contexto aumentado en base a la clasificacion de la fase anterior.
    if (analisis.intent === 'BUSCAR_MEJORES') {
      const { data } = await lSupabase
        .from('businesses')
        .select('id, name, avg_rating, description, city, categories(slug)')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('avg_rating', { ascending: false })
        .limit(5);

      contextoBD = `Negocios disponibles para recomendar: ${JSON.stringify(data)}.`;
    } else if (analisis.intent === 'BUSCAR_CERCANOS') {
      if (!lat || !lng) {
        return { reply: copy.needLocation };
      }

      const { data } = await lSupabase
        .from('businesses')
        .select('id, name, lat, lng, categories(slug)')
        .is('deleted_at', null);

      const ordenados = (data || [])
        .sort(
          (a, b) =>
            Math.pow((a.lat ?? 0) - lat, 2) +
            Math.pow((a.lng ?? 0) - lng, 2) -
            (Math.pow((b.lat ?? 0) - lat, 2) + Math.pow((b.lng ?? 0) - lng, 2))
        )
        .slice(0, 3);

      contextoBD = `Negocios mas cercanos a la ubicacion del usuario: ${JSON.stringify(ordenados)}.`;
    } else if (analisis.intent === 'VER_MENU') {
      const nombre = analisis.parametros?.nombre_negocio;

      if (!nombre) {
        const { data } = await lSupabase.from('businesses').select('name').limit(5);
        contextoBD = `El usuario no especifico el negocio. Sugiere algunos de estos: ${JSON.stringify(data)}.`;
      } else {
        const { data: biz } = await lSupabase
          .from('businesses')
          .select('id, name')
          .ilike('name', `%${nombre}%`)
          .single();

        if (biz) {
          const { data: menu } = await lSupabase
            .from('menu_items')
            .select('name, price')
            .eq('business_id', biz.id);

          contextoBD = `Negocio encontrado: ID ${biz.id}, Nombre ${biz.name}. Menu: ${JSON.stringify(menu)}.`;
        } else {
          contextoBD = 'NO ENCONTRADO en la base de datos.';
        }
      }
    } else if (analisis.intent === 'INFO_SISTEMA') {
      contextoBD = `
      Reglas del sistema "La Ruta de la Garnacha":
      - El Pasaporte o Album de estampas se llena haciendo check-in con codigos QR en negocios fisicos.
      - Al hacer check-in ganas puntos y recibes sobres virtuales.
      - Abres los sobres en la app para coleccionar estampas exclusivas de CDMX, Monterrey y Guadalajara.
      `;
    }

    // Formulacion directiva del comportamiento del motor conversacional con la inyeccion de los datos.
    const promptFinal = `
    You are Ola, the charismatic assistant of "La Ruta de la Garnacha".
    Always answer in ${LANGUAGE_NAMES[safeLang]}.
    Keep a warm, helpful tone and, when appropriate, a light Mexican flavor.

    User question: "${mensaje}"
    Detected intent: ${analisis.intent}

    STRICT DATABASE INFORMATION:
    ${contextoBD}

    GOLDEN RULES:
    1. Base your answer only on the strict information above. Do not invent names, prices or rules.
    2. If the strict information says "NO ENCONTRADO", be honest about it.
    3. If the user asks what to do today, recommend only what appears in the strict information.
    4. You may suggest only one action button if it applies:
       - If you mention a specific business, use url "/business/{id}" and button text matching the response language.
       - If you talk about the passport or stickers, use url "/passport".
       - If you talk about exploring, use url "/explore".
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptFinal,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mensaje: { type: Type.STRING },
            accion: {
              type: Type.OBJECT,
              properties: {
                url: { type: Type.STRING },
                texto_boton: { type: Type.STRING },
              },
            },
          },
          required: ['mensaje'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');

    return {
      reply: result.mensaje || copy.technicalIssue,
      action: result.accion?.url
        ? { url: result.accion.url, label: result.accion.texto_boton }
        : undefined,
    };
  } catch (error) {
    // Retorno seguro en caso de interrupciones abruptas del servicio de generacion.
    console.error('Error en Asistente Global:', error);
    return { reply: copy.transientError };
  }
}