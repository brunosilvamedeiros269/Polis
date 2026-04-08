import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Regex based extraction used instead of cheerio to avoid external dependencies

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const CHAMBER_API = 'https://dadosabertos.camara.leg.br/api/v2';
const LEGISLATURES = [54, 55, 56, 57]; // Legislaturas mais recentes

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Removendo acentos
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 404) return null;
      console.log(`   🟡 [Retry ${i+1}] Status ${response.status} para ${url}`);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return null;
}

async function syncProfileDetails() {
  console.log('--- Iniciando Sincronização Massiva de Detalhes dos Perfis ---');

  const { data: deputies, error } = await supabase
    .from('deputies')
    .select('id, name, nome_civil').eq('id', 160541);

  if (error) {
    console.error('Erro ao buscar deputados:', error);
    return;
  }

  console.log(`Processando ${deputies.length} deputados...`);

  for (const deputy of deputies) {
    try {
      console.log(`\n🔹 [${deputy.id}] ${deputy.name}`);

      // 1. CPF (Fundamental para identificação única)
      const detailRes = await fetchWithRetry(`${CHAMBER_API}/deputados/${deputy.id}`);
      let cpf = null;
      if (detailRes) {
        const detail = await detailRes.json();
        cpf = detail.dados.cpf;
        console.log(`   CPF: ${cpf}`);
      }

      // 2. Histórico de Mandatos
      const mandates = [];
      for (const leg of LEGISLATURES) {
        const legRes = await fetchWithRetry(`${CHAMBER_API}/deputados?id=${deputy.id}&idLegislatura=${leg}`);
        if (legRes) {
          const legData = await legRes.json();
          if (legData.dados && legData.dados.length > 0) {
            mandates.push({
              deputy_id: deputy.id,
              legislature: leg,
              condition: legData.dados[0].condicaoEleitoral || 'Titular'
            });
          }
        }
      }
      if (mandates.length > 0) {
        await supabase.from('deputy_history').upsert(mandates, { onConflict: 'deputy_id,legislature' });
      }

      // 3. Scraping Avançado - Ranking dos Políticos
      // Tentativa 1: Slug pelo Nome Civil (mais preciso)
      // Tentativa 2: Slug pelo Nome Parlamentar
      const slugCivil = slugify(deputy.nome_civil || deputy.name);
      const slugParlamentar = slugify(deputy.name);
      
      let rankingData = null;
      for (const slug of [slugCivil, slugParlamentar]) {
        const url = `https://ranking.org.br/perfil/${slug}`;
        const res = await fetchWithRetry(url);
        if (res) {
          const html = await res.text();
          rankingData = extractRankingMetrics(html);
          if (rankingData.ranking_score !== null) {
            rankingData.ranking_slug = slug;
            break;
          }
        }
      }

      // 4. Update Database
      await supabase.from('deputies').update({
        cpf,
        ...rankingData
      }).eq('id', deputy.id);

      if (rankingData) {
          console.log(`   Ranking: Nota ${rankingData.ranking_score} | Pos: ${rankingData.ranking_pos_nacional}º`);
      }

      // Evitar Bloqueio (Rate limit amigável)
      await new Promise(r => setTimeout(r, 600));

    } catch (err) {
      console.error(`   ❌ Erro:`, err.message);
    }
  }
  console.log('\n✅ Processamento concluído!');
}

function extractRankingMetrics(html) {
  const metrics = {
    ranking_score: null,
    ranking_pos_nacional: null,
    ranking_pos_estadual: null,
    ranking_votos: null,
    ranking_presenca: null,
    ranking_economia: null,
    ranking_processos: null
  };

  // 1. Nota Geral
  const scoreMatch = html.match(/class="score-value"[^>]*>([\d,.]+)</i) || html.match(/score:\s*([\d,.]+)/i);
  if (scoreMatch) metrics.ranking_score = parseFloat(scoreMatch[1].replace(',', '.'));

  // 2. Ranking Nacional
  const nacMatch = html.match(/(\d+)º\s*no\s*Brasil/i);
  if (nacMatch) metrics.ranking_pos_nacional = parseInt(nacMatch[1]);

  // 3. Ranking Estadual
  const estMatch = html.match(/(\d+)º\s*n[oa]\s*[A-Z]{2}/i);
  if (estMatch) metrics.ranking_pos_estadual = parseInt(estMatch[1]);

  // 4. Pilares (Votos, Presença, Economia, Processos)
  // Procurando pelos cards de critérios
  const criteriaMatches = [...html.matchAll(/<div class="criteria-card"[^>]*>([\s\S]*?)<\/div>/gi)];
  criteriaMatches.forEach(match => {
      const card = match[1];
      const valMatch = card.match(/class="criteria-score"[^>]*>([\d,.]+)</i);
      const val = valMatch ? parseFloat(valMatch[1].replace(',', '.')) : 0;
      
      if (card.includes('votações')) metrics.ranking_votos = val;
      if (card.includes('presenças')) metrics.ranking_presenca = val;
      if (card.includes('economia')) metrics.ranking_economia = val;
      if (card.includes('processos')) metrics.ranking_processos = val;
  });

  return metrics;
}

syncProfileDetails();
