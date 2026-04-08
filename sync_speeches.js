import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function syncSpeeches() {
  console.log("🗣️ Iniciando Sincronização de Discursos (2024)...");

  const { data: deputies } = await supabase.from('deputies').select('id, name');
  if (!deputies) return;

  for (const deputy of deputies) {
    try {
      console.log(`\n🔹 [${deputy.id}] ${deputy.name}`);
      
      const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${deputy.id}/discursos?dataInicio=2024-01-01&ordem=DESC&itens=10`;
      const res = await axios.get(url);
      const speeches = res.data.dados;

      if (!speeches || speeches.length === 0) {
        console.log("   - Nenhum discurso recente.");
        continue;
      }

      for (const s of speeches) {
        const { error } = await supabase.from('deputy_speeches').upsert({
          deputy_id: deputy.id.toString(),
          date_time: s.dataHoraInicio,
          tipo_discurso: s.tipoDiscurso,
          keywords: s.keywords,
          summary: s.sumario,
          transcription: s.transcricao,
          uri_evento: s.uriEvento
        }, { onConflict: 'deputy_id, date_time' });

        if (error) console.error(`   ❌ Erro no discurso de ${s.dataHoraInicio}:`, error.message);
      }

      console.log(`   ✅ ${speeches.length} discursos sincronizados.`);
      
      // Pequeno delay para evitar rate limit
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.error(`   ❌ Erro ao processar ${deputy.name}:`, err.message);
    }
  }

  console.log("\n🏁 Sincronização de Discursos Finalizada!");
}

syncSpeeches();
