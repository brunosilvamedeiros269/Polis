import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

// Define a data de corte inicial (ex: início do último mandato completo)
const START_DATE = '2019-01-01';

async function syncAllProposals() {
    console.log(`\n--- Starting FULL Proposals Sync (Since ${START_DATE}) ---`);
    const { data: deputies } = await supabase.from('deputies').select('id, name');
    if (!deputies) return;

    let totalSaved = 0;

    for (const deputy of deputies) {
        try {
            console.log(`Fetching historical proposals for ${deputy.name} (${deputy.id})...`);
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                const res = await fetch(
                    `https://dadosabertos.camara.leg.br/api/v2/proposicoes?idDeputadoAutor=${deputy.id}&dataInicio=${START_DATE}&ordem=DESC&ordenarPor=id&itens=100&pagina=${page}`, 
                    { headers: { 'Accept': 'application/json' }}
                );
                const payload = await res.json();

                if (payload && payload.dados && payload.dados.length > 0) {
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
                    
                    const { error } = await supabase.from('proposals').upsert(proposals, { onConflict: 'id' });
                    if (!error) {
                        totalSaved += proposals.length;
                    }

                    // Check if there are more pages
                    const nextLink = payload.links?.find((l) => l.rel === 'next');
                    if (nextLink) {
                        page++;
                    } else {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }
        } catch (err) {
            console.error(`Error syncing proposals for ${deputy.id}:`, err);
        }
    }
    console.log(`Finished full proposals sync. Total saved: ${totalSaved}`);
}

async function syncAllVotes() {
    console.log(`\n--- Starting FULL Nominal Votes Sync (Deep Scan Since ${START_DATE}) ---`);
    try {
        // Fetch up to 2000 votations (captures years of plenary sessions)
        const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=${START_DATE}&ordem=DESC&ordenarPor=dataHoraRegistro&itens=2000`, { headers: { 'Accept': 'application/json' }});
        const payload = await res.json();
        
        if (!payload || !payload.dados) {
             console.log("No votations found in payload.");
             return;
        }
        
        console.log(`Scanning up to ${payload.dados.length} historical sessions... (This will take a while)`);
        let totalVotes = 0;

        for (const [index, v] of payload.dados.entries()) {
            if (index % 50 === 0) console.log(`Progress: Configured ${index} of ${payload.dados.length} sessions...`);
            
            try {
                const resV = await fetch(`${v.uri}/votos`, { headers: { 'Accept': 'application/json' }});
                const payloadV = await resV.json();
                
                if (payloadV && payloadV.dados && payloadV.dados.length > 0) {
                    console.log(`Processing Historical Nominal Voting: ${v.id} (${payloadV.dados.length} votes)`);
                    
                    const uniqueDeps = payloadV.dados.map((vote) => ({
                        id: vote.deputado_.id,
                        name: vote.deputado_.nome,
                        party: vote.deputado_.siglaPartido,
                        state: vote.deputado_.siglaUf,
                        avatar_url: vote.deputado_.urlFoto || ""
                    }));
                    await supabase.from('deputies').upsert(uniqueDeps, { onConflict: 'id' });

                    let description = v.proposicaoObjeto || v.ementa || v.descricao;
                    let propTitle = null;

                    const resDetail = await fetch(v.uri, { headers: { 'Accept': 'application/json' }});
                    const jDetail = await resDetail.json();

                    if (!description || description === "null" || description === "undefined") {
                        description = jDetail.dados?.proposicaoObjeto?.ementa || jDetail.dados?.descricao || 'Votação em Plenário';
                    }

                    if (jDetail.dados?.proposicoesAfetadas?.[0]) {
                        const p = jDetail.dados.proposicoesAfetadas[0];
                        propTitle = `${p.siglaTipo} ${p.numero}/${p.ano}`;
                    }

                    const votesToSave = payloadV.dados.map((vote) => ({
                        id: `${v.id}-${vote.deputado_.id}`,
                        deputy_id: vote.deputado_.id,
                        data: v.dataHoraRegistro ? new Date(v.dataHoraRegistro).toISOString() : null,
                        proposicao_ementa: description,
                        proposicao_titulo: propTitle,
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
                // Silently skip corrupted or empty sessions
            }
        }
        console.log(`Finished full votes sync. Total: ${totalVotes}`);
    } catch (err) {
        console.error("Critical error syncing votes:", err);
    }
}

async function run() {
    await syncAllProposals();
    await syncAllVotes();
    console.log("\n✅ Histórico Legislativo Completo Sincronizado!");
}

run();
