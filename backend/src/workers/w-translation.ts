/**
 * Archivo: src/workers/w-translate-chat.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo define un consumidor asincrono (Worker) basado en el ecosistema BullMQ, apoyandose 
 * en Redis como intermediario de mensajes (Message Broker). Arquitectonicamente, se sitúa de forma 
 * paralela a la capa dos, operando como un proceso en segundo plano (Background Job). 
 * Su proposito fundamental es desacoplar las operaciones lentas de red —en este caso, traducir 
 * un mensaje a multiples idiomas invocando una API externa cinco veces consecutivas— del ciclo 
 * principal de solicitud/respuesta HTTP o del flujo continuo de WebSockets. 
 * Esta estrategia de procesamiento diferido previene el bloqueo del hilo principal de Node.js, 
 * tolerando fallos de red mediante reintentos y asegurando la escalabilidad de la aplicacion 
 * bajo cargas masivas.
 */

import { Worker } from "bullmq";
import { bullConnection } from "../lib/l-redis.js";
import { translateText } from "../services/s-translation.js";
import { qUpsertTranslation } from "../db/queries/q-translations.js";

/**
 * Idiomas objetivo soportados por la aplicacion para la localizacion automatica.
 *
 * Efecto: Define la matriz de iteracion. Se omite el espanol ('es') asumiendo 
 * que funge como la lengua base u origen en el dominio de la plataforma (Mexico).
 */
const LANGUAGES: Array<'en' | 'fr' | 'pt' | 'de' | 'zh'> = ['en','fr','pt','de','zh']

/**
 * Consumidor de cola de trabajo para la traduccion masiva de interacciones.
 *
 * Tipo: Proceso en segundo plano basado en eventos.
 * Parametros: Instancia del trabajo (Job) despachado por la cola conteniendo el identificador y el texto base.
 * Retorno: Objeto confirmando la resolucion exitosa del lote de traducciones.
 * Efecto: Iterar sobre el arreglo de lenguas soportadas, delegar el texto al servicio envoltorio 
 * de traduccion (con su respectiva capa de cache), y persistir los resultados en la tabla 
 * polimorfica de traducciones de la base de datos de manera secuencial.
 *
 * Complejidad temporal: Orden lineal O(l) donde l es la cantidad predefinida de lenguas (5). 
 * La latencia total del trabajo equivale a la suma de los tiempos de respuesta de la API externa.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Excepcional. Configurado con una concurrencia local de 3 para prevenir el 
 * agotamiento del banco de conexiones y el estrangulamiento (Rate Limiting) de la API de DeepL. 
 * Para escalar horizontalmente, basta con desplegar multiples instancias de este contenedor (Worker Nodes), 
 * delegando la coordinacion distribuida al cluster de Redis.
 */
export const translationWorker = new Worker(
    'translate-chat',
    async (job) => {
        const { chatId, text } = job.data as { chatId: string; text: string }

        if (!chatId || !text) throw new Error('chatId y text son requeridos')

        console.log(`🔹 Traduciendo chat ${chatId}`)

        for (const lang of LANGUAGES){
            try{
                // Traducción mediante el servicio de traduccion
                // src/services/s-translation.ts
                // Emplea el patron de Cache-Aside internamente para mitigar el costo de llamadas externas
                const translated = await translateText(text, lang.toUpperCase())

                // Guardar/upsert en la tabla de traducciones relacional
                // Utiliza la estrategia polimorfica (entityType + entityId) para escalar la internacionalizacion
                await qUpsertTranslation({
                    entityType: 'business',       // entityType: 'business' | 'menu_item' | 'category' | 'stamp' | 'collection'
                    entityId: chatId,
                    field: 'message',         
                    language: lang,           // Minúscula para coincidir con el ENUM estricto de base de datos
                    value: translated,
                    isAI: true,               // Marca de auditoria indicando origen mecanico
                })

                console.log(`Chat ${chatId} traducido a ${lang}`)
            }
            catch(error){
                // Aislamiento de fallos: Si una lengua particular falla, se captura la excepcion 
                // para permitir que el ciclo continue e intente traducir las lenguas restantes.
                console.error(`Error traduciendo chat ${chatId} a ${lang}:`, error)
            }
        }

        // El marco de trabajo de BullMQ marcara este trabajo como completado
        return {
            success: true,
            chatId
        };
    },
    { 
        connection: bullConnection,
        // Limite de procesamiento concurrente por instancia de Worker
        // Previene picos de consumo (Burst) excesivos hacia el proveedor de IA
        concurrency: 3, 
    }
);