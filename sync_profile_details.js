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

function normalizeName(text) {
  if (!text) return '';
  return text
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 404) return null;
      if (response.status === 429) {
          console.log(`   🟡 [429] Limite excedido no Portal. Aguardando 15s...`);
          await new Promise(r => setTimeout(r, 15000));
          continue;
      }
      console.log(`   🔴 [${response.status}] Erro na requisição: ${url}`);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 3000 * (i + 1)));
    }
  }
  return null;
}

async function syncProfileDetails() {
  console.log('--- Iniciando Sincronização de Emendas (Normalizado) ---');

  const { data: deputies, error } = await supabase
    .from('deputies')
    .select('id, name, cpf, nome_civil');

  if (error) {
    console.error('Erro ao buscar deputados:', error);
    return;
  }

  for (const deputy of deputies) {
    try {
      console.log(`\n🔹 [${deputy.id}] ${deputy.name}`);
      
      // Nome para busca no Portal (Maiúsculo e sem acentos)
      // Tentamos o Nome Civil primeiro (mais preciso), depois o Nome Parlamentar
      const searchNames = [
          normalizeName(deputy.nome_civil),
          normalizeName(deputy.name)
      ].filter(n => n && n.length > 3);

      let allEmendas = [];
      const START_YEAR = 2023;
      const END_YEAR = 2027;

      for (const nameToSearch of [...new Set(searchNames)]) {
          console.log(`   🔎 Buscando por: "${nameToSearch}"...`);
          
          for (let year = START_YEAR; year <= END_YEAR; year++) {
              const emendasUrl = `${TRANSPARENCIA_API}/emendas?pagina=1&ano=${year}&nomeAutor=${encodeURIComponent(nameToSearch)}`;
              const emendasRes = await fetchWithRetry(emendasUrl, {
                  headers: { 'chave-api-dados': TRANSPARENCIA_KEY }
              });

              if (emendasRes) {
                  const emendasList = await emendasRes.json();
                  if (Array.isArray(emendasList) && emendasList.length > 0) {
                      allEmendas = allEmendas.concat(emendasList);
                  }
              }
              await new Promise(r => setTimeout(r, 100));
          }
          
          // Se achou emendas com o primeiro nome, não precisa tentar o segundo
          if (allEmendas.length > 0) break;
      }

      if (allEmendas.length > 0) {
          console.log(`   ✅ Sucesso! ${allEmendas.length} emendas encontradas.`);
          const formattedEmendas = allEmendas.map(e => ({
              id: `${e.codigoEmenda}-${e.ano}`,
              deputy_id: deputy.id,
              ano: e.ano,
              tipo_emenda: e.tipoEmenda,
              numero_emenda: e.numeroEmenda,
              localidade: e.localidadeDoGasto,
              funcao: e.funcao,
              // Limpeza robusta de valores (remove qualquer coisa que não seja dígito ou vírgula)
              valor_empenhado: parseFloat((e.valorEmpenhado || "0").replace(/[^\d,]/g, '').replace(',', '.')),
              valor_liquidado: parseFloat((e.valorLiquidado || "0").replace(/[^\d,]/g, '').replace(',', '.')),
              valor_pago: parseFloat((e.valorPago || "0").replace(/[^\d,]/g, '').replace(',', '.'))
          }));
          
          const { error: upsertErr } = await supabase.from('amendments').upsert(formattedEmendas);
          if (upsertErr) console.error(`   ❌ Erro no banco:`, upsertErr.message);
      } else {
          console.log(`   ⚠️ Nenhuma emenda oficial no Portal para este mandato.`);
      }

      // Pequena pausa entre parlamentares para não ser bloqueado
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`   ❌ Erro fatal:`, err.message);
    }
  }
  console.log('\n--- Sincronização Finalizada ---');
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
