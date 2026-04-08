import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const ELECTION_2022 = "2040602022";
const ELECTION_2018 = "2022802018";

const normalize = (str) => {
  if (!str) return "";
  return str.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(DE|DA|DO|DOS|DAS)\b/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
};

async function syncOne(deputyId) {
  const { data: deputy } = await supabase.from('deputies').select('*').eq('id', deputyId).single();
  if (!deputy) return;

  const configs = [
    { year: 2022, electionId: ELECTION_2022 },
    { year: 2018, electionId: ELECTION_2018 }
  ];

  for (const config of configs) {
    const url = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/${config.year}/${deputy.state}/${config.electionId}/6/candidatos`;
    const res = await axios.get(url);
    const list = res.data.candidatos;

    const deputyNameNorm = normalize(deputy.name);
    const cand = list.find(c => {
      const tseNameNorm = normalize(c.nomeCompleto);
      const tseUrnaNorm = normalize(c.nomeUrna);
      return tseNameNorm === deputyNameNorm || tseUrnaNorm === deputyNameNorm || tseNameNorm.includes(deputyNameNorm) || deputyNameNorm.includes(tseNameNorm);
    });

    if (cand) {
      const detailUrl = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/${config.year}/${deputy.state}/${config.electionId}/candidato/${cand.id}`;
      const detailRes = await axios.get(detailUrl);
      const total = detailRes.data.totalDeBens || 0;

      await supabase.from('deputy_assets').upsert({
        deputy_id: deputy.id,
        election_year: config.year,
        total_value: total,
        assets_detail: detailRes.data.bens
      }, { onConflict: 'deputy_id, election_year' });

      console.log(`✅ ${config.year}: R$ ${total}`);
    }
  }
}

syncOne('160600');
