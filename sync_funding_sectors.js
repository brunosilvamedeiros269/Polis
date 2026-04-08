import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
const geminiApiKey = process.env.GOOGLE_GENAI_API_KEY;

async function classifySector(donors) {
  if (!geminiApiKey) return null;

  try {
    const prompt = `
      Classifique os seguintes doadores de campanhas políticas brasileiras por setor econômico simplificado.
      Use categorias curtas como: 'Setor Financeiro', 'Agronegócio', 'Construção Civil', 'Educação', 'Saúde', 'Mineração', 'Energia', 'Comércio', 'Tecnologia' ou 'Pessoa Física' (se for nome de pessoa).
      
      Doadores:
      ${donors.join('\n')}
      
      Retorne APENAS um objeto JSON no formato:
      {
        "classifications": [
          {"name": "Doador A", "sector": "Setor X", "score": 0.9},
          ...
        ]
      }
    `;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      }
    );

    const result = JSON.parse(response.data.candidates[0].content.parts[0].text);
    return result.classifications;
  } catch (error) {
    console.error(`❌ Erro na classificação:`, error.message);
    return null;
  }
}

async function run() {
  console.log('📊 Iniciando Classificação de Setores de Doadores...');

  // 1. Buscar doadores únicos sem setor que NÃO sejam PF ou PARTIDO (para economizar IA)
  const { data: donorsData } = await supabase
    .from('campaign_donations')
    .select('donor_name, donor_type')
    .is('sector', null)
    .not('donor_type', 'in', '("PF", "PARTIDO", "PROPRIO")')
    .limit(500);

  // 2. Classificação Automática Grátis (PF, etc)
  console.log('⚡ Auto-classificando PF, Partidos e Recursos Próprios...');
  await supabase.from('campaign_donations').update({ sector: 'Pessoa Física', sector_score: 1 }).eq('donor_type', 'PF').is('sector', null);
  await supabase.from('campaign_donations').update({ sector: 'Partidos / Fundo', sector_score: 1 }).eq('donor_type', 'PARTIDO').is('sector', null);
  await supabase.from('campaign_donations').update({ sector: 'Recursos Próprios', sector_score: 1 }).eq('donor_type', 'PROPRIO').is('sector', null);

  if (!donorsData || donorsData.length === 0) {
    console.log('✅ Nenhum doador PJ (Empresa) pendente de classificação.');
    return;
  }

  const uniqueNames = [...new Set(donorsData.map(d => d.donor_name))];
  console.log(`🔍 Processando ${uniqueNames.length} doadores únicos...`);

  // Processar em lotes de 10
  for (let i = 0; i < uniqueNames.length; i += 10) {
    const batch = uniqueNames.slice(i, i + 10);
    console.log(`   🔸 Lote ${Math.floor(i/10) + 1}...`);
    
    const classifications = await classifySector(batch);
    
    if (classifications) {
      for (const cls of classifications) {
        await supabase
          .from('campaign_donations')
          .update({ sector: cls.sector, sector_score: cls.score })
          .eq('donor_name', cls.name);
      }
    }
    
    // Pequeno delay
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('✅ Classificação finalizada!');
}

run();
