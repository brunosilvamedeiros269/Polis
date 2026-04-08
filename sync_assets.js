import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
const BASE_TSE_URL = 'https://divulgacandcontas.tse.jus.br/divulga/rest/v1';

async function getCandidateList(year, electionId, state) {
  try {
    // Padrão correto: /candidatura/listar/{ANO}/{UF}/{ID_ELEICAO}/{ID_CARGO}/candidatos
    const url = `${BASE_TSE_URL}/candidatura/listar/${year}/${state}/${electionId}/6/candidatos`;
    const res = await axios.get(url);
    return res.data && res.data.candidatos ? res.data.candidatos : [];
  } catch (err) {
    console.error(`   ❌ Erro ao listar candidatos (${year} - ${state}):`, err.message);
    return [];
  }
}

async function getAssets(year, electionId, state, sqCandidato) {
  try {
    // Padrão correto: /candidatura/buscar/{ANO}/{UF}/{ID_ELEICAO}/candidato/{SQ_CANDIDATO}
    const url = `${BASE_TSE_URL}/candidatura/buscar/${year}/${state}/${electionId}/candidato/${sqCandidato}`;
    const res = await axios.get(url);
    if (res.data && res.data.bens) {
      const total = res.data.totalDeBens || 0;
      return { total, details: res.data.bens };
    }
  } catch (err) {
    console.error(`   ❌ Erro ao buscar bens (${sqCandidato}):`, err.message);
  }
  return null;
}

async function run() {
  console.log('🛡️ Iniciando Sincronização de Evolução Patrimonial...');
  
  const { data: deputies } = await supabase.from('deputies').select('id, name, cpf, state');
  
  // Cache de listas por Estado/Ano para evitar excesso de requests
  const listCache = {};

  for (const deputy of deputies) {
    if (!deputy.cpf) continue;

    console.log(`\n🔹 [${deputy.id}] ${deputy.name} (${deputy.state})`);

    const yearsMap = [
      { year: 2022, electionId: '2040602022' },
      { year: 2018, electionId: '2022802018' }
    ];

    let total2022 = 0;
    let total2018 = 0;

    for (const config of yearsMap) {
      const cacheKey = `${config.year}_${deputy.state}`;
      if (!listCache[cacheKey]) {
        console.log(`   📂 Carregando lista de candidatos ${config.year} para ${deputy.state}...`);
        listCache[cacheKey] = await getCandidateList(config.year, config.electionId, deputy.state);
        await new Promise(r => setTimeout(r, 1000));
      }

      const normalize = (str) => {
        if (!str) return "";
        return str.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // Remove acentos
          .replace(/\b(DE|DA|DO|DOS|DAS)\b/g, "") // Remove conectores
          .replace(/\s+/g, " ") // Remove espaços duplos
          .toUpperCase()
          .trim();
      };

      const deputyNameNorm = normalize(deputy.name);

      const cand = listCache[cacheKey].find(c => {
        const tseNameNorm = normalize(c.nomeCompleto);
        const tseUrnaNorm = normalize(c.nomeUrna);
        
        // Match se forem idênticos após normalização OU se um estiver contido no outro (robustez)
        return tseNameNorm === deputyNameNorm || 
               tseUrnaNorm === deputyNameNorm ||
               tseNameNorm.includes(deputyNameNorm) ||
               deputyNameNorm.includes(tseNameNorm);
      });
      
      if (cand) {
        console.log(`   🔍 Encontrado via Nome: ${cand.nomeCompleto} (${config.year})`);
        const assets = await getAssets(config.year, config.electionId, deputy.state, cand.id);
        
        if (assets) {
          console.log(`   ✅ ${config.year}: R$ ${assets.total.toLocaleString('pt-BR')}`);
          if (config.year === 2022) total2022 = assets.total;
          if (config.year === 2018) total2018 = assets.total;

          await supabase.from('deputy_assets').upsert({
            deputy_id: deputy.id,
            election_year: config.year,
            total_value: assets.total,
            assets_detail: assets.details
          }, { onConflict: 'deputy_id, election_year' });
        }
      }
    }

    // Análise de Crescimento
    if (total2022 > 0 && total2018 > 0) {
      const growth = ((total2022 - total2018) / total2018) * 100;
      console.log(`   📈 Evolução: ${growth.toFixed(1)}%`);

      if (growth > 100) {
        console.log(`   🚨 ALERTA: Crescimento Suspeito Detectado!`);
        await supabase.from('integrity_alerts').upsert({
          deputy_id: deputy.id,
          title: 'Crescimento Patrimonial Suspeito',
          description: `O patrimônio declarado saltou de R$ ${total2018.toLocaleString('pt-BR')} (2018) para R$ ${total2022.toLocaleString('pt-BR')} (2022), um aumento de ${growth.toFixed(1)}%.`,
          alert_type: 'ASSET_GROWTH',
          severity: 'HIGH',
          net_value: total2022 - total2018
        }, { onConflict: 'deputy_id, alert_type' });
      }
    }

    // Delay anti-ban TSE
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n✅ Sincronização Patrimonial Concluída!');
}

run();
