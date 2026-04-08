import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseUrl.startsWith('https')) {
  console.error("❌ Erro Crítico: VITE_SUPABASE_URL é inválida ou não foi configurada na Vercel.");
} else {
  // Diagnóstico seguro: mostra apenas o início e o fim da URL no log para conferência
  console.log(`📡 Conectando ao Banco: ${supabaseUrl.substring(0, 12)}...${supabaseUrl.substring(supabaseUrl.length - 12)}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
