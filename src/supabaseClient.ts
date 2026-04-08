import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseUrl.startsWith('https')) {
  console.error("❌ Erro Crítico: VITE_SUPABASE_URL é inválida ou não foi configurada na Vercel.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
