import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';

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

async function scrapeRanking(name, nomeCivil) {
  const slugs = [...new Set([slugify(name), slugify(nomeCivil)])].filter(s => s && s.length > 5);
  
  for (const slug of slugs) {
    const url = `https://ranking.org.br/perfil/${slug}`;
    try {
      const { data } = await axios.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000 
      });
      const $ = cheerio.load(data);
      
      const score = $('.perfil-pontuacao-total').first().text().replace(/[^\d]/g, '');
      if (!score) continue; 

      const rankBrasil = $('.perfil-ranking-posicao').first().text().replace(/[^\d]/g, '');
      const rankEstado = $('.perfil-ranking-posicao').eq(1).text().replace(/[^\d]/g, '');

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
        ranking_score: parseFloat(score) / 100 || 0, // Ajuste se o site retornar valor cheio (ex: 715 -> 7.15)
        ranking_pos_nacional: parseInt(rankBrasil) || 0,
        ranking_pos_estadual: parseInt(rankEstado) || 0,
        ranking_votos: parseFloat(pillars.votacoes) || 0,
        ranking_presenca: parseFloat(pillars.presenca) || 0,
        ranking_economia: parseFloat(pillars.economia) || 0,
        ranking_processos: parseFloat(pillars.anticorrupcao) || 0,
        ranking_outros: parseFloat(pillars.judiciario) || 0
      };
    } catch (e) {
      continue;
    }
  }
  return null;
}

async function syncAll() {
  const { data: deputies, error } = await supabase
    .from('deputies')
    .select('id, name, nome_civil')
    .or('ranking_score.is.null,id.eq.160569');

  if (error) {
    console.error('Erro ao buscar deputados:', error);
    return;
  }

  console.log(`🚀 Iniciando sincronização de ranking para ${deputies.length} deputados...`);

  for (const dep of deputies) {
    process.stdout.write(`🔹 [${dep.id}] ${dep.name}... `);
    const data = await scrapeRanking(dep.name, dep.nome_civil);
    if (data) {
      const { error: updateErr } = await supabase.from('deputies').update(data).eq('id', dep.id);
      if (!updateErr) console.log(`✅ Nota: ${data.ranking_score}`);
      else console.log(`❌ Erro DB: ${updateErr.message}`);
    } else {
      console.log(`⚠️ Não encontrado.`);
    }
    // Pausa dinâmica para evitar bloqueios
    await new Promise(r => setTimeout(r, 600));
  }
  console.log('🏁 Finalizado!');
}

syncAll();
