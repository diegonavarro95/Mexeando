/**
 * Archivo: src/routes/r-translate.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se posiciona en la capa dos de la arquitectura, conformando la interfaz de 
 * programacion de aplicaciones. Su proposito arquitectonico es exponer un punto de acceso 
 * dedicado y seguro para el servicio de traduccion multilingue. Actua como un canalizador 
 * que intercepta las peticiones del cliente, valida rigurosamente los parametros de entrada 
 * y delega el procesamiento computacional pesado a la capa de servicios, la cual interactua 
 * con los proveedores de inteligencia en la capa externa.
 */

// N5 - Patrick
// Endpoint representacional para la ruta api de traduccion

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { translateText } from '../services/s-translation.js'; // Asegura la extensión correcta según tu tsconfig

// Instanciamos el enrutador para este bloque específico
const translate = new Hono();

/**
 * Establecer las reglas estructurales para la validacion de entrada.
 *
 * Efecto: Actuar como un escudo protector en el perimetro de la red. Si el cliente 
 * envia datos incompletos o solicita idiomas no soportados por el sistema, el validador 
 * interrumpe el flujo y rechaza la peticion automaticamente con un codigo de error por 
 * solicitud incorrecta, evitando consumir ciclos de procesamiento en el servicio externo.
 */
const translateSchema = z.object({
  text: z.string().min(1, "El texto no puede estar vacío"), // Obliga a que envíen al menos una letra
  target_lang: z.enum(['EN', 'ES', 'FR', 'DE', 'PT', 'ZH']) // Restringe estrictamente a los 6 idiomas del proyecto
});

/**
 * Procesar la solicitud de traduccion de texto hacia un idioma objetivo.
 *
 * Ruta asociada: Metodo Post en la raiz del recurso de traducciones.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red incluyendo un cuerpo estructurado con el texto a traducir 
 * y la nomenclatura del idioma deseado.
 * Retorno: Promesa que resuelve en un objeto Json confirmando el exito de la operacion 
 * y adjuntando la cadena de texto resultante.
 * Efecto: Extraer los datos saneados por el interceptor de validacion, invocar la logica 
 * de negocio delegada al servicio de traducciones y envolver la respuesta en un formato 
 * estandar, capturando y reportando cualquier anomalia interna.
 *
 * Complejidad temporal: Orden lineal O(t) donde t representa la longitud de la cadena de 
 * texto provista. El procesamiento local es practicamente instantaneo, recayendo la carga 
 * temporal sobre la latencia de red del proveedor de servicios externo.
 * Complejidad espacial: Orden lineal O(t) necesario para instanciar en la memoria del 
 * servidor tanto la cadena original como el resultado devuelto antes de su serializacion.
 * Escalabilidad: Sobresaliente en el entorno local. La arquitectura no bloqueante y libre 
 * de estado permite procesar peticiones concurrentes eficientemente. El limite de escalabilidad 
 * estara dictaminado exclusivamente por las cuotas de consumo y los limites de tasa 
 * impuestos por el proveedor de traduccion utilizado.
 */
translate.post('/', zValidator('json', translateSchema), async (c) => {
  // Extrae los datos ya limpios y seguros
  const { text, target_lang } = c.req.valid('json');

  try {
    //  Procesar la traducción a través de nuestro servicio
    const result = await translateText(text, target_lang);
    
    //  Responder al cliente con un objeto en formato Json 
    return c.json({ 
      success: true,
      data: { 
        original: text,
        translated: result,
        lang: target_lang
      } 
    });
    
  } catch (error) {
    // Capturar fallos internos
    console.error("[Error de ruta de traduccion]:", error);
    
    // Responder con codigo de error interno del servidor
    return c.json({ 
      success: false, 
      message: "Falló el proceso de traducción interno" 
    }, 500);
  }
});

// Se exporta para registrarlo en el archivo principal correspondiente
export default translate;