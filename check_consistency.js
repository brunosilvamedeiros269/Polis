import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkConsistency() {
  console.log("⚖️ Iniciando Análise de Coerência Ética (Discursos vs. Votos)...");

  // Pega alertas antigos para não duplicar
  const { data: existingAlerts } = await supabase.from('integrity_alerts').select('description');
  const alertSet = new Set(existingAlerts?.map(a => a.description) || []);

  // Pega discursos que tenham palavras-chave
  const { data: speeches } = await supabase
    .from('deputy_speeches')
    .select('deputy_id, keywords, transcription, date_time, summary')
    .not('keywords', 'is', null)
    .order('date_time', { ascending: false });

  if (!speeches) return;

  for (const speech of speeches) {
    const keys = speech.keywords.split(',').map(k => k.trim());
    
    // Busca votos do mesmo deputado em temas similares (ementa da proposição)
    for (const key of keys) {
      if (key.length < 4) continue; // Pula palavras muito curtas

      const { data: relatedVotes } = await supabase.rpc('get_related_votes_by_keyword', { 
        dep_id: parseInt(speech.deputy_id), 
        keyword: `%${key}%` 
      });

      if (relatedVotes && relatedVotes.length > 0) {
        for (const vote of relatedVotes) {
          // Lógica de Sentimento Heurístico
          const text = speech.transcription?.toUpperCase() || "";
          const isProSpeaking = text.includes("APOIO") || text.includes("FAVORÁVEL") || text.includes("VOTO SIM") || text.includes("DEFENDO");
          const isAgainstSpeaking = text.includes("CONTRA") || text.includes("REJEIÇÃO") || text.includes("VOTO NÃO") || text.includes("ABSURDO");

          let alertMsg = null;
          
          if (isProSpeaking && vote.voto === "Não") {
            alertMsg = `Incoerência Ética: O parlamentar discursou favoravelmente a "${key}" em ${new Date(speech.date_time).toLocaleDateString()}, mas votou "Não" na proposição ${vote.proposicao_sigla} (Votação ${vote.votacao_id})`;
          } else if (isAgainstSpeaking && vote.voto === "Sim") {
            alertMsg = `Incoerência Ética: O parlamentar discursou contra "${key}" em ${new Date(speech.date_time).toLocaleDateString()}, mas votou "Sim" na proposição ${vote.proposicao_sigla} (Votação ${vote.votacao_id})`;
          }

          if (alertMsg && !alertSet.has(alertMsg)) {
            console.log(`🚩 ALERTA: ${alertMsg}`);
            await supabase.from('integrity_alerts').insert({
              deputy_id: speech.deputy_id,
              alert_type: 'INCONSISTENCY',
              title: 'Incoerência Ética Detectada',
              severity: 'HIGH',
              description: alertMsg,
              created_at: speech.date_time
            });
            alertSet.add(alertMsg);

            // NOVO: Notificar Seguidores
            const deputyIdInt = parseInt(speech.deputy_id);
            const { data: followers } = await supabase
              .from('profiles')
              .select('id')
              .contains('following', [deputyIdInt]);

            if (followers && followers.length > 0) {
              console.log(`🔔 Notificando ${followers.length} seguidores...`);
              for (const follower of followers) {
                await supabase.from('notifications').insert({
                  user_id: follower.id,
                  deputy_id: speech.deputy_id,
                  title: 'Alerta de Coerência Ética ⚖️',
                  message: `Detectamos uma contradição entre o discurso e o voto de um parlamentar que você segue. Veja o Duelo no Radar Ético.`,
                  created_at: new Date().toISOString()
                });

                // Trigger Push Service (Placeholder para estrutura futura)
                // await triggerPushService(follower.id, alertMsg); 
                // console.log(`[PUSH PREPARED] Disparo pronto para usuário: ${follower.id}`);
              }
            }
          }
        }
      }
    }
  }

  console.log("\n🏁 Análise de Coerência Finalizada!");
}

checkConsistency();
