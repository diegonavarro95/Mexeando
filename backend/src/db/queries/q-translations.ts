/**
 * Archivo: src/db/queries/q-translations.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo forma parte de la capa dos de la arquitectura, correspondiente a la logica y Api del servidor.
 * Actua como la capa de acceso a datos exclusiva para el modulo de traducciones multilingues del sistema.
 * Su responsabilidad es persistir en la capa tres de almacenamiento relacional los resultados de 
 * traducciones generadas de manera dinamica, las cuales son proveidas habitualmente por servicios 
 * externos de inteligencia artificial ubicados en la capa cuatro.
 * Al separar esta logica en un modulo dedicado, los controladores de rutas y los servicios mantienen 
 * su responsabilidad unica sin acoplarse directamente a la sintaxis del motor de base de datos.
 */

import { lSupabase } from "../../lib/l-supabase.js";

/**
 * Interfaz de entrada para la insercion o actualizacion de traducciones.
 * Define de manera estricta las entidades soportadas y los metadatos requeridos para estructurar el modelo.
 */
export interface qUpsertTranslationInput{
    entityType: 'business' | 'menu_item' | 'category' | 'stamp' | 'collection'
    entityId: string
    field: string
    language: string
    value: string
    isAI?: boolean
}

/**
 * Insertar o actualizar una traduccion especifica en el repositorio de datos principal.
 * Rutas asociadas: Frecuentemente consumido de manera indirecta por peticiones de tipo Get que 
 * solicitan contenido en idiomas extranjeros y disparan una traduccion en tiempo de ejecucion.
 * Tipo: Funcion asincrona.
 * Parametros: Objeto estructurado especificando el tipo de entidad, el identificador respectivo, 
 * el campo traducido, el codigo de idioma seleccionado y el texto resultante.
 * Retorno: Promesa vacia que indica la finalizacion exitosa de la transaccion.
 * Efecto: Ejecutar una operacion de insercion con reemplazo ante conflictos en la tabla 
 * de traducciones, garantizando que no existan registros duplicados para la misma combinacion 
 * de entidad, campo e idioma.
 *
 * Complejidad temporal: Orden constante O(1). El gestor de base de datos resuelve el conflicto 
 * utilizando un indice compuesto de manera directa mediante arboles de busqueda balanceados.
 * Complejidad espacial: Orden constante O(1). No se requiere almacenamiento temporal adicional 
 * en la memoria del servidor mas alla del propio objeto a insertar.
 * Escalabilidad: Altamente escalable. Al delegar la resolucion del conflicto de duplicidad directamente 
 * al motor relacional mediante su restriccion de unicidad nativa, se eliminan condiciones de carrera 
 * en escenarios de alta concurrencia y se minimiza la latencia de red. Este diseno hace que el proceso 
 * sea optimo y robusto para un ecosistema global con multiples turistas solicitando traducciones simultaneas.
 */
export async function qUpsertTranslation(
    input: qUpsertTranslationInput
): Promise<void> {
    const { error } = await lSupabase
        .from('translations')
        .upsert(
            {
                entity_type: input.entityType,
                entity_id: input.entityId,
                field: input.field,
                language: input.language,
                value: input.value,
                is_ai: input.isAI ?? true
            },
            {
                onConflict: 'entity_type,entity_id,field,language'
            }
        )
    if (error) {
        throw new Error(`Error al guarar traducción: ${error.message}`)
    }
}