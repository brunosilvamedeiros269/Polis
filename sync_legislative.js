import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncProposals() {
    console.log("--- Syncing Proposals (2024-2025) ---");
    const { data: deputies } = await supabase.from('deputies').select('id, name');
    if (!deputies) return;

    let total = 0;
    for (const deputy of deputies) {
        try {
            console.log(`Fetching proposals for ${deputy.name}...`);
            const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes?idDeputadoAutor=${deputy.id}&dataInicio=2024-01-01&ordem=DESC&ordenarPor=id`, { headers: { 'Accept': 'application/json' }});
            const payload = await res.json();
            
            if (payload && payload.dados) {
                const proposals = payload.dados.map((p) => ({
                    id: p.id,
                    deputy_id: deputy.id,
                    sigla_tipo: p.siglaTipo,
                    numero: p.numero,
                    ano: p.ano,
                    ementa: p.ementa,
                    data_apresentacao: p.dataApresentacao ? new Date(p.dataApresentacao).toISOString() : null,
                    uri: p.uri
                }));
                
                if (proposals.length > 0) {
                    const { error } = await supabase.from('proposals').upsert(proposals, { onConflict: 'id' });
                    if (!error) total += proposals.length;
                    else console.error(error);
                }
            }
        } catch (err) {
            console.error(`Error syncing proposals for ${deputy.id}:`, err);
        }
    }
    console.log(`Finished proposals sync. Total: ${total}`);
}

async function syncVotes() {
    console.log("--- Syncing Votes (2024-2025) ---");
    // Step 1: Fetch all votations
    try {
        const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=2024-01-01&ordem=DESC&ordenarPor=dataHoraRegistro`, { headers: { 'Accept': 'application/json' }});
        const payload = await res.json();
        
        if (!payload || !payload.dados) return;
        
        console.log(`Found ${payload.dados.length} votations. Fetching individual votes...`);
        let totalVotes = 0;

        for (const v of payload.dados) {
            try {
                // Fetch votes for this session
                const resV = await fetch(`${v.uri}/votos`, { headers: { 'Accept': 'application/json' }});
                const payloadV = await resV.json();
                
                if (payloadV && payloadV.dados) {
                    const votesToSave = payloadV.dados.map((vote) => ({
                        id: `${v.id}-${vote.deputado_.id}`,
                        deputy_id: vote.deputado_.id,
                        data: v.dataHoraRegistro ? new Date(v.dataHoraRegistro).toISOString() : null,
                        proposicao_ementa: v.proposicaoObjeto || v.ementa,
                        voto: vote.tipoVoto,
                        sessao_nome: v.siglaOrgao,
                        uri_votacao: v.uri
                    }));
                    
                    if (votesToSave.length > 0) {
                        const { error } = await supabase.from('votes').upsert(votesToSave, { onConflict: 'id' });
                        if (!error) totalVotes += votesToSave.length;
                    }
                }
            } catch (err) {
                console.error(`Error syncing votes for votation ${v.id}:`, err);
            }
        }
        console.log(`Finished votes sync. Total: ${totalVotes}`);
    } catch (err) {
        console.error("Critical error syncing votes:", err);
    }
}

async function run() {
    await syncProposals();
    await syncVotes();
}

run();
