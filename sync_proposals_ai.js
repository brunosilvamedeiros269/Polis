import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Configuração Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração Gemini (Opcional - se não houver, o script apenas lista)
const geminiApiKey = process.env.GOOGLE_GENAI_API_KEY;

async function generateSummary(proposta) {
  if (!geminiApiKey) {
    console.log(`⚠️ Sem API Key do Gemini. Pulando resumo para: ${proposta.numero}/${proposta.ano}`);
    return null;
  }

  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const prompt = `
        Você é um especialista em política brasileira. 
        Resuma a seguinte proposição legislativa de forma simples para um cidadão comum (linguagem de boteco/viral).
        Destaque o impacto real na vida das pessoas.
        
        Título: ${proposta.siglaTipo} ${proposta.numero}/${proposta.ano}
        Ementa: ${proposta.ementa}
        
        Retorne em JSON:
        {
          "summary_plain": "Explicação simples em 1 ou 2 frases",
          "impact_analysis": "O que muda na vida do povo em 1 frase",
          "area_tags": ["Tag1", "Tag2"]
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
      return result;
    } catch (error) {
      if (error.response?.status === 429 || error.response?.status === 503) {
        const waitTime = Math.pow(2, retries) * 10000; // 10s, 20s, 40s
        console.warn(`⏳ Quota ou Instabilidade (Erro ${error.response.status}). Aguardando ${waitTime/1000}s para tentar novamente...`);
        await new Promise(r => setTimeout(r, waitTime));
        retries++;
      } else if (error.response) {
        console.error(`❌ Erro Gemini [${error.response.status}]:`, JSON.stringify(error.response.data, null, 2));
        return null;
      } else {
        console.error(`❌ Erro ao gerar resumo IA:`, error.message);
        return null;
      }
    }
  }
  return null;
}

async function syncAll() {
  console.log('🚀 Iniciando Sincronização de Inteligência Artificial...');

  // 1. Buscar todos os deputados
  const { data: deputies, error: depError } = await supabase
    .from('deputies')
    .select('id, name');

  if (depError) return console.error(depError);

  for (const deputy of deputies) {
    console.log(`\n🔹 Processando: ${deputy.name} [${deputy.id}]`);
    
    try {
      // 2. Buscar proposições recentes na Câmara
      const res = await axios.get(`https://dadosabertos.camara.leg.br/api/v2/proposicoes?idDeputadoAutor=${deputy.id}&ordem=DESC&ordenarPor=id`);
      const proposicoes = res.data.dados.slice(0, 3); // Top 3 recentes

      for (const prop of proposicoes) {
        // Verificar se já existe resumo
        const { data: existing } = await supabase
          .from('proposals_summaries')
          .select('proposal_id')
          .eq('proposal_id', prop.id)
          .single();

        if (existing) {
          console.log(`   ✅ ${prop.siglaTipo} ${prop.numero}/${prop.ano} já tem resumo.`);
          continue;
        }

        // 3. Gerar resumo com IA
        const aiResult = await generateSummary(prop);
        
        if (aiResult) {
          // 4. Salvar no Supabase
          const { error: insError } = await supabase
            .from('proposals_summaries')
            .upsert({
              proposal_id: prop.id,
              summary_plain: aiResult.summary_plain,
              impact_analysis: aiResult.impact_analysis,
              area_tags: aiResult.area_tags
            });

          if (!insError) {
            console.log(`   ✨ Resumo gerado para ${prop.siglaTipo} ${prop.numero}/${prop.ano}`);
          }
        }
      }
    } catch (e) {
      console.error(`   ❌ Falha ao processar ${deputy.name}:`, e.message);
    }
    
    // Pequeno delay para evitar rate limit da API da Câmara
    // Delay maior para evitar rate limit (1.5s entre políticos)
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n✅ Sincronização finalizada!');
}

syncAll();
