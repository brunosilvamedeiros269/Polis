import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Atenção: Configuração do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) não encontrada no seu .env.local.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
