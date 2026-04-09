/**
 * Archivo: src/lib/queue-translations.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura, referida a la logica y Api del ecosistema.
 * Su funcion arquitectonica es instanciar y configurar un canal de comunicacion asincrono 
 * utilizando la libreria de colas de mensajes, la cual se apoya en la conexion de Redis compartida 
 * para persistir los trabajos. Al delegar tareas dependientes de latencia externa, como las 
 * peticiones a servicios de inteligencia artificial o traduccion en la capa cuatro, hacia una cola de 
 * procesamiento en segundo plano, se garantiza que el hilo principal del servidor conserve su 
 * disponibilidad. Esto resulta en tiempos de respuesta optimos para el cliente web, cumpliendo 
 * con la restriccion de latencia inferior a doscientos milisegundos especificada en el flujo de arquitectura.
 */

import { Queue } from "bullmq"
import { bullConnection } from "../lib/l-redis.js"

/**
 * Cola de procesamiento asincrono dedicada a las traducciones dinamicas del chat.
 *
 * Rutas asociadas: Utilizada indirectamente por endpoints de mensajeria que requieren 
 * soporte multilingue sin penalizar el tiempo de respuesta de la solicitud original.
 * Tipo: Instancia de clase persistente.
 * Parametros: Cadena de texto identificadora de la cola y un objeto de configuracion que 
 * inyecta la conexion de red reutilizable.
 * Efecto: Registrar un conducto estructurado en el cluster de Redis para encolar, gestionar 
 * y monitorear tareas de traduccion en segundo plano.
 * * Complejidad temporal: Orden constante O(1). La inicializacion del objeto es inmediata y 
 * se ejecuta unicamente durante el arranque de la aplicacion, sin realizar operaciones 
 * de red bloqueantes.
 * Complejidad espacial: Orden constante O(1). La instancia mantiene en la memoria del servidor 
 * solo las referencias de configuracion y el descriptor de conexion hacia la base de datos en memoria.
 * Escalabilidad: Excepcionalmente alta y critica para la tolerancia a fallos. Al implementar 
 * un patron arquitectonico de productor y consumidor, el servidor puede absorber picos masivos 
 * de trafico. Si una gran cantidad de turistas envia mensajes simultaneamente, la cola actua 
 * como un amortiguador, almacenando los trabajos de forma segura. Los procesos secundarios 
 * consumiran estas tareas a un ritmo controlado, evitando la saturacion de limites de tasa 
 * correspondientes a los servicios externos de la capa cuatro.
 */
export const translationQueue = new Queue(
    'translate-chat',
    {
        connection: bullConnection,
    }
);