import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncVotes() {
    console.log("--- Syncing Nominal Votes (Deep Scan + Deputy Check) ---");
    try {
        const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=2024-01-01&ordem=DESC&ordenarPor=dataHoraRegistro&itens=200`, { headers: { 'Accept': 'application/json' }});
        const payload = await res.json();
        
        if (!payload || !payload.dados) return;
        
        console.log(`Scanning last ${payload.dados.length} sessions...`);
        let totalVotes = 0;

        for (const v of payload.dados) {
            try {
                const resV = await fetch(`${v.uri}/votos`, { headers: { 'Accept': 'application/json' }});
                const payloadV = await resV.json();
                
                if (payloadV && payloadV.dados && payloadV.dados.length > 0) {
                    console.log(`Processing Nominal Voting: ${v.id} (${payloadV.dados.length} votes)`);
                    
                    // 1. Ensure all deputies in these votes exist in our DB
                    const uniqueDeputies = payloadV.dados.map(vote => ({
                        id: vote.deputado_.id,
                        name: vote.deputado_.nome,
                        party: vote.deputado_.siglaPartido,
                        state: vote.deputado_.siglaUf,
                        avatar_url: vote.deputado_.urlFoto || ""
                    }));
                    
                    // Batch upsert deputies to avoid FK violations
                    const { error: depErr } = await supabase.from('deputies').upsert(uniqueDeputies, { onConflict: 'id' });
                    if (depErr) console.error("Error upserting deputies for FK:", depErr);

                    // 2. Determine description
                    let description = v.proposicaoObjeto || v.ementa || v.descricao;
                    if (!description || description === "null" || description === "undefined") {
                        const resDetail = await fetch(v.uri, { headers: { 'Accept': 'application/json' }});
                        const jDetail = await resDetail.json();
                        description = jDetail.dados?.proposicaoObjeto?.ementa || jDetail.dados?.descricao || 'Votação em Plenário';
                    }

                    const votesToSave = payloadV.dados.map((vote) => ({
                        id: `${v.id}-${vote.deputado_.id}`,
                        deputy_id: vote.deputado_.id,
                        data: v.dataHoraRegistro ? new Date(v.dataHoraRegistro).toISOString() : null,
                        proposicao_ementa: description,
                        voto: vote.tipoVoto,
                        sessao_nome: v.siglaOrgao,
                        uri_votacao: v.uri
                    }));
                    
                    if (votesToSave.length > 0) {
                        const { error } = await supabase.from('votes').upsert(votesToSave, { onConflict: 'id' });
                        if (!error) totalVotes += votesToSave.length;
                        else console.error("Upsert Error (Votes):", error);
                    }
                }
            } catch (err) {
                // Silently skip sessions without nominal votes or errors
            }
        }
        console.log(`Finished votes sync. Total: ${totalVotes}`);
    } catch (err) {
        console.error("Critical error syncing votes:", err);
    }
}

syncVotes();
