import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function updateCivilNames() {
  const { data: deputies, error } = await supabase
    .from('deputies')
    .select('id, name')
    .or('nome_civil.is.null,nome_civil.eq.""');

  if (error) {
    console.error('Erro ao buscar deputados:', error);
    return;
  }

  console.log(`🚀 Buscando nomes civis para ${deputies.length} deputados...`);

  for (const dep of deputies) {
    try {
      const response = await axios.get(`https://dadosabertos.camara.leg.br/api/v2/deputados/${dep.id}`);
      const nomeCivil = response.data.dados.nomeCivil;

      if (nomeCivil) {
        const { error: updateErr } = await supabase
          .from('deputies')
          .update({ nome_civil: nomeCivil })
          .eq('id', dep.id);

        if (!updateErr) {
          console.log(`✅ [${dep.id}] ${dep.name} -> ${nomeCivil}`);
        } else {
          console.log(`❌ Erro DB [${dep.id}]: ${updateErr.message}`);
        }
      }
    } catch (e) {
      console.log(`⚠️ Erro API [${dep.id}]: ${e.message}`);
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }
  console.log('🏁 Atualização de nomes civis finalizada!');
}

updateCivilNames();
