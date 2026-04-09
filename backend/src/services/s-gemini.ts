/**
 * Archivo: src/services/s-gemini.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura (Logica de Negocio), funcionando 
 * como el motor de integracion principal con la capa cuatro (Servicios de Inteligencia Artificial). 
 * Su proposito arquitectonico es gobernar el flujo de "incorporacion conversacional" (onboarding) 
 * para los propietarios de negocios. 
 * Implementa dos patrones clave:
 * 1. Agente Conversacional Orientado a Metas: Dirige una entrevista estructurada paso a paso 
 * hasta recopilar los puntos de datos obligatorios, terminando con una bandera de estado.
 * 2. Extraccion de Entidades Determinista: Utiliza esquemas estrictos de JSON y post-procesamiento 
 * defensivo para transformar el texto natural no estructurado del chat en un objeto 
 * relacional compatible con las restricciones de la capa tres (PostgreSQL).
 */

import { GoogleGenAI, Type } from "@google/genai";

interface Especialidad {
  nombre: string;
  precio: number | null;
}

/**
 * Estructura de datos canonica esperada por los controladores de red.
 */
interface DatosNegocio {
  nombre: string;
  descripcion: string;
  categoria: "food" | "crafts" | "tourism" | "entertainment" | "wellness" | "retail";
  horario?: {
    mon?: string[]; tue?: string[]; wed?: string[];
    thu?: string[]; fri?: string[]; sat?: string[];
    sun?: string[];
  };
  especialidades: Especialidad[];
}


const BASE_CONTEXT = `
Eres un sistema experto en extracción de datos estructurados para negocios locales en México.
Tu salida SIEMPRE debe ser precisa, consistente y sin ambigüedades.
No inventes información. Si no estás seguro, omite el campo.
`;


const EXTRACTION_PROMPT = (chatHistory: string) => `
${BASE_CONTEXT}

Analiza la conversación y extrae información del negocio.

CONVERSACIÓN:
${chatHistory}

OBJETIVO:
Generar un JSON estructurado con:
- nombre
- descripcion (atractiva y breve)
- categoria (SOLO LOS VALORES EXACTOS PERMITIDOS)
- especialidades (2-5 items con su precio en número. Si no hay precio, pon null)

CATEGORÍAS PERMITIDAS (DEBES USAR EXACTAMENTE UNA DE ESTAS):
food, crafts, tourism, entertainment, wellness, retail
(Ejemplo: Si es comida o bebida usa "food", si vende artículos usa "retail", si es hospedaje usa "tourism")

----------------------------------------
HORARIO (REGLAS ESTRICTAS)
----------------------------------------
1. EXPANSIÓN DE DÍAS (OBLIGATORIO):
- "todos los días" o "diario" → mon,tue,wed,thu,fri,sat,sun
- "lunes a viernes" → mon,tue,wed,thu,fri
- "lunes a sábado" → mon,tue,wed,thu,fri,sat
- "fines de semana" → sat,sun
- días individuales → solo esos

2. FORMATO:
Cada día debe ser: ["HH:MM","HH:MM"]

3. CONVERSIÓN:
- 9am → 09:00
- 3pm → 15:00
- 12am → 00:00
- 12pm → 12:00

4. EJEMPLOS DE HORARIO (OBLIGATORIOS):
Entrada: "lunes a viernes de 9am a 8pm"
Salida: { "mon": ["09:00","20:00"], "tue": ["09:00","20:00"], "wed": ["09:00","20:00"], "thu": ["09:00","20:00"], "fri": ["09:00","20:00"] }

5. VALIDACIÓN:
- EXACTAMENTE 2 valores por día
- NO inventar días
- Si es ambiguo → omitir horario completo
`;

/**
 * Traducir el historial de la entrevista en un objeto de datos estructurado.
 *
 * Tipo: Funcion de dominio asincrona.
 * Parametros: Cadena de texto que contiene la conversacion completa entre el dueno y el bot.
 * Retorno: Promesa que resuelve en la interfaz de DatosNegocio procesada.
 * Efecto: Invoca al modelo generativo imponiendo un esquema JSON estricto (`responseSchema`). 
 * Aplica una rutina de saneamiento manual posterior (post-procesamiento) para eliminar llaves de 
 * horarios malformadas que el modelo haya podido omitir en la validacion interna, asegurando 
 * la integridad de los datos antes de alcanzar la base de datos.
 *
 * Complejidad temporal: Orden constante O(1) para el servidor de Node; restringido por el tiempo de inferencia del LLM.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Dependiente de las cuotas del proveedor de inteligencia artificial. La arquitectura de extraccion 
 * delegada protege la memoria de la aplicacion de procesos computacionales pesados.
 */
// FUNCIÓN PRINCIPAL
export const extraerDatosNegocio = async (chatHistory: string): Promise<DatosNegocio> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: EXTRACTION_PROMPT(chatHistory),
      config: {
        temperature: 0, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nombre: { type: Type.STRING },
            descripcion: { type: Type.STRING },
            categoria: {
              type: Type.STRING,
              enum: ["food", "crafts", "tourism", "entertainment", "wellness", "retail"]
            },
            horario: {
              type: Type.OBJECT,
              properties: {
                mon: { type: Type.ARRAY, items: { type: Type.STRING } },
                tue: { type: Type.ARRAY, items: { type: Type.STRING } },
                wed: { type: Type.ARRAY, items: { type: Type.STRING } },
                thu: { type: Type.ARRAY, items: { type: Type.STRING } },
                fri: { type: Type.ARRAY, items: { type: Type.STRING } },
                sat: { type: Type.ARRAY, items: { type: Type.STRING } },
                sun: { type: Type.ARRAY, items: { type: Type.STRING } },
              }
            },
            especialidades: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nombre: { type: Type.STRING },
                  precio: { type: Type.NUMBER, description: "Precio numérico, usar 0 o null si no se menciona" }
                },
                required: ["nombre"]
              },
              description: "Lista de platillos o productos estrella con su precio"
            }
          },
          required: ["nombre", "descripcion", "categoria", "especialidades"]
        }
      }
    });

    const raw = JSON.parse(response.text || "{}");
    console.log('[gemini] Datos extraídos:', JSON.stringify(raw, null, 2));

    
    const days = ['mon','tue','wed','thu','fri','sat','sun'];

    if (raw.horario) {
  let validDays = 0;

  for (const day of days) {
    const val = raw.horario[day];
    if (Array.isArray(val) && val.length === 2) {
      validDays++;
      // día válido — lo dejamos como está
    } else {
      raw.horario[day] = null; // ← poner null en lugar de borrar
    }
  }

  // Si no quedó ni un solo día válido, borramos el objeto horario completo
  if (validDays === 0) {
    delete raw.horario;
  }
}

    return raw as DatosNegocio;

}catch (error) {
    console.error("Error extrayendo datos:", error);
    // Respuesta de reserva (fallback) para prevenir el colapso de la cadena de promesas
    return {
      nombre: "Pendiente",
      descripcion: "",
      categoria: "food",
      especialidades: []
    };
  }
};

/**
 * Determinar el estado de la recoleccion de datos y emitir la siguiente pregunta logica.
 *
 * Tipo: Funcion de dominio asincrona.
 * Parametros: Registro completo de la conversacion.
 * Retorno: Promesa que entrega la frase que el bot dirigira al usuario.
 * Efecto: Actua como una maquina de estados fluida basada en inferencia. Lee el contexto, evalua 
 * que ranuras de informacion (slots) siguen vacias y formula una peticion natural. Emite una 
 * senal exacta (REGISTRO_COMPLETO) para indicar al controlador de ruta que el ciclo ha concluido.
 *
 * Complejidad temporal: Orden constante O(1) de evaluacion en la capa local.
 * Complejidad espacial: Orden constante O(1).
 */
// GENERADOR DE PREGUNTAS (MEJORADO PARA PEDIR PRECIOS)
export const sGenerarSiguientePregunta = async (chatHistory: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
Eres un asistente conversacional experto de "La Ruta de la Garnacha". Tu objetivo es entrevistar al dueño para registrar su negocio.

OBJETIVO - Recolectar EXACTAMENTE estos 5 datos:
1. Nombre del negocio
2. Categoría (Comida/Bebida, Artesanías, Hospedaje/Turismo, Entretenimiento, Tienda/Retail)
3. Descripción breve del negocio (qué lo hace especial)
4. Horario completo (días de la semana, hora de apertura y hora de cierre)
5. Especialidades Y PRECIOS (2 a 4 platillos o productos estrella con su costo estimado)

HISTORIAL:
${chatHistory}

REGLAS DE ORO:
- Haz SOLO 1 pregunta a la vez. No abrume al usuario.
- Detecta qué dato falta.
- Sé natural, empático y muy amable.
- No repitas preguntas ya respondidas.
- NUNCA pidas dirección, ubicación exacta ni fotos (eso se pide en el siguiente paso de la app).

REGLA ESTRICTA PARA HORARIO:
- Deben darte días Y horas exactas. Si dicen "todo el día", pregunta amablemente de qué hora a qué hora. Formato esperado por ti: HH:MM.

REGLA ESTRICTA PARA ESPECIALIDADES:
- Al pedir el menú o productos estrella, pide EXPLÍCITAMENTE que te den el precio aproximado de cada cosa.
- Ejemplo: "¿Cuáles son tus 2 platillos estrella y qué precio tienen más o menos?"

CUANDO TERMINES Y TENGAS LOS 5 DATOS:
Responde SOLO con esta palabra exacta (sin puntos ni nada más):
REGISTRO_COMPLETO
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.3 // Ligera flexibilidad para sonar humano, pero enfocado.
      }
    });

    return (response.text || "").trim();

  } catch (error) {
    console.error("Error en asistente:", error);
    return "¿Me puedes repetir eso por favor? Tuve un problema de conexión.";
  }
};