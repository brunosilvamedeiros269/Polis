require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-client');
const axios = require('axios');
const cheerio = require('cheerio');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeRanking(name) {
  const slug = slugify(name);
  const url = `https://ranking.org.br/perfil/${slug}`;
  console.log(`   🔎 Scrape: ${url}`);
  try {
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    
    // Exttrair Score
    const score = $('.perfil-pontuacao-total').first().text().replace(/[^\d]/g, '');
    const rankBrasil = $('.perfil-ranking-posicao').first().text().replace(/[^\d]/g, '');
    const rankEstado = $('.perfil-ranking-posicao').eq(1).text().replace(/[^\d]/g, '');

    // Pilares
    let pillars = {};
    $('.perfil-pontuacao-item').each((i, el) => {
        const label = $(el).find('.perfil-pontuacao-label').text().trim();
        const value = $(el).find('.perfil-pontuacao-valor').text().trim();
        if (label.includes('Anticorrupção')) pillars.anticorrupcao = value;
        if (label.includes('Presença')) pillars.presenca = value;
        if (label.includes('Economia')) pillars.economia = value;
        if (label.includes('Votações')) pillars.votacoes = value;
        if (label.includes('Poder Judiciário')) pillars.judiciario = value;
    });

    return {
      ranking_score: parseInt(score) || 0,
      ranking_pos_brasil: parseInt(rankBrasil) || 0,
      ranking_pos_estado: parseInt(rankEstado) || 0,
      ranking_pillars: pillars
    };
  } catch (e) {
    return null;
  }
}

async function syncAll() {
  const { data: deputies } = await supabase
    .from('deputies')
    .select('id, name')
    .is('ranking_score', null);

  console.log(`🚀 Iniciando sincronização de ranking para ${deputies.length} deputados...`);

  for (const dep of deputies) {
    console.log(`🔹 [${dep.id}] ${dep.name}`);
    const data = await scrapeRanking(dep.name);
    if (data) {
      const { error } = await supabase.from('deputies').update(data).eq('id', dep.id);
      if (!error) console.log(`   ✅ Nota: ${data.ranking_score}`);
      else console.error(`   ❌ Erro DB:`, error.message);
    } else {
      console.log(`   ⚠️ Não encontrado no Ranking.`);
    }
    // Pausa para evitar 429
    await new Promise(r => setTimeout(r, 800));
  }
  console.log('✅ Finalizado!');
}

syncAll();
