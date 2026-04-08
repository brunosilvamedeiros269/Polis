import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('📊 Iniciando Sincronização de Fidelidade Partidária...');

  // 1. Obter todas as votações únicas
  const { data: votes } = await supabase.from('votes').select('uri_votacao').not('uri_votacao', 'is', null);
  const uniqueUris = [...new Set(votes.map(v => v.uri_votacao))];
  console.log(`🔎 Total de votações únicas encontradas: ${uniqueUris.length}`);

  for (const uri of uniqueUris) {
    const votacaoId = uri.split('/').pop();
    console.log(`\n🔹 Processando votação: ${votacaoId}`);

    try {
      const res = await axios.get(`https://dadosabertos.camara.leg.br/api/v2/votacoes/${votacaoId}/orientacoes`);
      const orientacoes = res.data.dados;

      for (const orient of orientacoes) {
        await supabase.from('party_orientations').upsert({
          votacao_id: votacaoId,
          party_name: orient.siglaPartidoBloco,
          orientation: orient.orientacaoVoto
        }, { onConflict: 'votacao_id, party_name' });
      }
    } catch (err) {
      console.error(`   ❌ Erro ao buscar orientações para ${votacaoId}:`, err.message);
    }
    
    await new Promise(r => setTimeout(r, 500)); // Delay educado
  }

  // 2. Calcular fidelidade para cada deputado
  console.log('\n🧮 Calculando Scores de Fidelidade...');
  const { data: deputies } = await supabase.from('deputies').select('id, name, party');

  for (const deputy of deputies) {
    const { data: deputyVotes } = await supabase
      .from('votes')
      .select('uri_votacao, voto')
      .eq('deputy_id', deputy.id);

    if (!deputyVotes || deputyVotes.length === 0) continue;

    let matches = 0;
    let totalValid = 0;

    for (const v of deputyVotes) {
      const vid = v.uri_votacao.split('/').pop();
      const { data: ors } = await supabase
        .from('party_orientations')
        .select('party_name, orientation')
        .eq('votacao_id', vid);

      if (!ors) continue;

      const partyMapping = {
        'UNIÃO': ['Uni', 'União', 'UNIÃO'],
        'PP': ['Pp', 'PP'],
        'REPUBLICANOS': ['Rep', 'Republicanos'],
        'PODEMOS': ['Pode', 'Podemos'],
        'SOLIDARIEDADE': ['Solidaried'],
        'PSDB': ['Psdb'],
        'CIDADANIA': ['Cid'],
        'MDB': ['Mdb', 'MDB']
      };

      const searchTerms = partyMapping[deputy.party] || [deputy.party];

      // 1. Tentar Match Direto ou via Mapeamento
      let targetOrientation = ors.find(o => 
        searchTerms.some(term => o.party_name.toLowerCase() === term.toLowerCase())
      );

      // 2. Tentar Match via Bloco (se não houver direto)
      if (!targetOrientation) {
        targetOrientation = ors.find(o => 
          searchTerms.some(term => o.party_name.toLowerCase().includes(term.toLowerCase()))
        );
      }

      if (targetOrientation) {
        const dVote = v.voto.trim().toLowerCase();
        const pVote = targetOrientation.orientation.trim().toLowerCase();

        // Mapeamento Sim/Não
        if (['sim', 'não'].includes(dVote) && ['sim', 'não'].includes(pVote)) {
          totalValid++;
          if (dVote === pVote) matches++;
        }
      }
    }

    const score = totalValid > 0 ? (matches / totalValid) * 100 : 0;
    console.log(`👤 ${deputy.name} [${deputy.party}]: ${score.toFixed(1)}% (${matches}/${totalValid})`);

    await supabase.from('deputies').update({ loyalty_score: score }).eq('id', deputy.id);
  }

  console.log('\n✅ Sincronização de Fidelidade Concluída!');
}

run();
