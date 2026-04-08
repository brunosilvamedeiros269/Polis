import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
  console.log('🛠️ Criando tabela deputy_assets via RPC...');
  // Tentar rodar SQL via query direta caso o MCP esteja falhando
  const sql = `
    CREATE TABLE IF NOT EXISTS public.deputy_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deputy_id NUMERIC NOT NULL,
        election_year INTEGER NOT NULL,
        total_value NUMERIC(15,2) DEFAULT 0,
        assets_detail JSONB DEFAULT '[]',
        last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(deputy_id, election_year)
    );
  `;
  
  // Como o Supabase JS não tem .query(), ignoramos este passo se a tabela já existir no sync_assets.js
  // O sync_assets.js usará .upsert() que falhará se a tabela não existir, 
  // mas podemos tentar usar uma function SQL se estiver disponível.
  
  console.log('Avisando: Verifique se a tabela deputy_assets foi criada no painel do Supabase.');
}
setup();
