import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config(); // Fallback to .env

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const CHAMBER_API = 'https://dadosabertos.camara.leg.br/api/v2';
const TRANSPARENCIA_API = 'https://api.portaldatransparencia.gov.br/api-de-dados';
const TRANSPARENCIA_KEY = '7f71ac32b24290a20dd99a5733aec4c1';

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
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
      if (response.status === 429) {
          console.log(`   🟡 [429] Rate limit portal. Aguardando 10s...`);
          await new Promise(r => setTimeout(r, 10000));
          continue;
      }
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return null;
}

async function syncProfileDetails() {
  console.log('--- Iniciando Sincronização Massiva (Ranking + Emendas) ---');

  const { data: deputies, error } = await supabase
    .from('deputies')
    .select('id, name, cpf').eq('id', 160541);

  if (error) {
    console.error('Erro ao buscar deputados:', error);
    return;
  }

  for (const deputy of deputies) {
    try {
      console.log(`\n🔹 [${deputy.id}] ${deputy.name}`);

      // 1. Buscar Nome Civil e CPF (se não tiver)
      const detailRes = await fetchWithRetry(`${CHAMBER_API}/deputados/${deputy.id}`);
      let nome_civil = null;
      let cpf = deputy.cpf;
      if (detailRes) {
        const detail = await detailRes.json();
        nome_civil = detail.dados.nomeCivil;
        cpf = detail.dados.cpf;
        console.log(`   Nome Civil: ${nome_civil} | CPF: ${cpf}`);
      }

      // 2. Buscar Emendas Parlamentares (Portal da Transparência)
      // Usaremos o nome do parlamentar para buscar
      const emendasUrl = `${TRANSPARENCIA_API}/emendas?pagina=1&nomeAutor=${encodeURIComponent(deputy.name)}`;
      const emendasRes = await fetchWithRetry(emendasUrl, {
          headers: { 'chave-api-dados': TRANSPARENCIA_KEY }
      });

      if (emendasRes) {
          const emendasList = await emendasRes.json();
          if (Array.isArray(emendasList) && emendasList.length > 0) {
              console.log(`   Encontradas ${emendasList.length} emendas.`);
              const formattedEmendas = emendasList.map(e => ({
                  id: `${e.codigoEmenda}-${e.ano}`,
                  deputy_id: deputy.id,
                  ano: e.ano,
                  tipo_emenda: e.tipoEmenda,
                  numero_emenda: e.numeroEmenda,
                  localidade: e.localidadeDoGasto,
                  funcao: e.funcao,
                  valor_empenhado: parseFloat(e.valorEmpenhado.replace('.', '').replace(',', '.')),
                  valor_liquidado: parseFloat(e.valorLiquidado.replace('.', '').replace(',', '.')),
                  valor_pago: parseFloat(e.valorPago.replace('.', '').replace(',', '.'))
              }));
              await supabase.from('amendments').upsert(formattedEmendas);
          }
      }

      // 3. Scraping Ranking (Manteve-se o anterior para garantir)
      const rankingData = await scrapeRanking(deputy.name, nome_civil);

      // 4. Update Database
      await supabase.from('deputies').update({
        nome_civil,
        cpf,
        ...rankingData
      }).eq('id', deputy.id);

      await new Promise(r => setTimeout(r, 600));

    } catch (err) {
      console.error(`   ❌ Erro:`, err.message);
    }
  }
}

async function scrapeRanking(name, nomeCivil) {
    // Busca por slugs prováveis
    const slugs = [slugify(nomeCivil), slugify(name)];
    for (const slug of slugs) {
        if (!slug) continue;
        const res = await fetchWithRetry(`https://ranking.org.br/perfil/${slug}`);
        if (res) {
            const html = await res.text();
            const metrics = extractRankingMetrics(html);
            if (metrics.ranking_score) {
                metrics.ranking_slug = slug;
                return metrics;
            }
        }
    }
    return {};
}

function extractRankingMetrics(html) {
    const metrics = {
      ranking_score: null, ranking_pos_nacional: null, ranking_pos_estadual: null,
      ranking_votos: null, ranking_presenca: null, ranking_economia: null, ranking_processos: null
    };
    const getMatch = (reg, index = 1) => {
      const m = html.match(reg);
      return m ? m[index].replace(',', '.') : null;
    };
    metrics.ranking_score = parseFloat(getMatch(/class="score-value"[^>]*>([\d,.]+)</i) || "0");
    metrics.ranking_pos_nacional = parseInt(getMatch(/(\d+)º\s*no\s*Brasil/i) || "0");
    metrics.ranking_pos_estadual = parseInt(getMatch(/(\d+)º\s*n[oa]\s*[A-Z]{2}/i) || "0");
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
