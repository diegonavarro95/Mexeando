/**
 * ARCHIVO: src/lib/supabase.ts
 * AUTOR: Patrick Pueblita (N5 - QA/Fullstack)
 * DESCRIPCIÓN: Configuración centralizada del cliente de Supabase.
 * Se utilizan variables de entorno (VITE_) para seguridad y portabilidad.
 */

import { createClient } from '@supabase/supabase-js';

// Extraemos las variables del archivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación de QA: Si faltan las llaves, la app debe avisar de inmediato
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("ERROR DE CONFIGURACIÓN: Revisa el archivo .env en la raíz del frontend.");
}

// Exportamos una única instancia del cliente para evitar conexiones duplicadas
export const supabase = createClient(supabaseUrl, supabaseAnonKey);