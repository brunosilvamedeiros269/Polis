import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hyqzzsadaxuqnxkhwbyt.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cXp6c2FkYXh1cW54a2h3Ynl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTA5OTYsImV4cCI6MjA5MTA2Njk5Nn0.hhZGPRa3dx7w9USU8y-STN24r3x61FmWj4Do0EVx87s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncDeputies() {
    console.log("Forcing deputies sync locally...");
    const now = new Date();
    
    try {
        const res = await fetch("https://dadosabertos.camara.leg.br/api/v2/deputados?itens=1000", { headers: { 'Accept': 'application/json' }});
        const payload = await res.json();
        
        if (!payload || !payload.dados) throw Error("Failed to extract data payload.");

        const deputies = payload.dados.map((d) => ({
            id: d.id,
            name: d.nome,
            party: d.siglaPartido,
            state: d.siglaUf,
            avatar_url: d.urlFoto,
            email: d.email,
            last_sync: now.toISOString()
        }));

        const { error: upsertErr } = await supabase.from('deputies').upsert(deputies, { onConflict: 'id' });
            
        if (!upsertErr) {
             console.log(`Successfully synced ${deputies.length} deputies.`);
        } else {
             console.log("Error upserting deputies: " + JSON.stringify(upsertErr));
        }
    } catch (err) {
        console.log("Critical error during sync: " + err);
    }
}

async function syncExpenses() {
    console.log("Starting rotational sync for expenses locally...");
    const { data: deputies, error: depErr } = await supabase
        .from('deputies')
        .select('id, name')
        .order('id', { ascending: true });
        
    if (depErr || !deputies || deputies.length === 0) {
        return console.log(`Error fetching deputies: ${JSON.stringify(depErr)}`);
    }

    console.log(`Processing ${deputies.length} deputies...`);
    let totalSaved = 0;

    for (const deputy of deputies) {
        try {
            const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados/${deputy.id}/despesas?itens=100&ordem=DESC&ordenarPor=ano`, { headers: { 'Accept': 'application/json' }});
            const payload = await res.json();

            if (payload && payload.dados) {
                const expensesMap = new Map();
                payload.dados.forEach((e) => {
                    const uniqueId = `${deputy.id}-${e.codDocumento || '0'}-${e.numDocumento || '0'}-${e.ano}-${e.mes}-${e.valorDocumento || '0'}`;
                    expensesMap.set(uniqueId, {
                        id: uniqueId,
                        deputy_id: deputy.id,
                        year: e.ano,
                        month: e.mes,
                        expense_type: e.tipoDespesa,
                        document_url: e.urlDocumento,
                        provider_name: e.nomeFornecedor,
                        net_value: e.valorLiquido,
                        document_date: e.dataDocumento ? new Date(e.dataDocumento).toISOString() : null
                    });
                });
                const expensesToUpsert = Array.from(expensesMap.values());

                if (expensesToUpsert.length > 0) {
                    const { error: upsertErr } = await supabase.from('expenses').upsert(expensesToUpsert, { onConflict: 'id' });
                    if (!upsertErr) {
                        totalSaved += expensesToUpsert.length;
                    } else {
                        console.log(upsertErr)
                    }
                }
            }
        } catch (err) {
            console.error(`Error syncing expenses for deputy ${deputy.id} (${deputy.name}):`, err);
        }
    }
    
    console.log(`Finished processing. Total new or overwritten expenses saved: ${totalSaved}`);
}

async function run() {
    await syncDeputies();
    await syncExpenses();
}

run();
