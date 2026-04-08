import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncExpenses() {
    console.log("Starting rotational sync for expenses...");
    
    // Fetch 5 deputies ordered by last_expense_sync ASC (oldest first or null)
    const { data: deputies, error: depErr } = await supabase
        .from('deputies')
        .select('id, name, last_expense_sync')
        .order('last_expense_sync', { ascending: true, nullsFirst: true })
        .limit(5);
        
    if (depErr || !deputies || deputies.length === 0) {
        return `Error fetching deputies: ${JSON.stringify(depErr)}`;
    }

    console.log(`Processing ${deputies.length} deputies:`, deputies.map(d => d.name).join(', '));
    let totalSaved = 0;

    for (const deputy of deputies) {
        try {
            // Fetch the last 100 recent expenses for this deputy 
            const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados/${deputy.id}/despesas?itens=100&ordem=DESC&ordenarPor=ano`);
            const payload = await res.json();

            if (payload && payload.dados) {
                const expensesToUpsert = payload.dados.map((e: any, index: number) => {
                    const uniqueId = `${deputy.id}-${e.codDocumento || '0'}-${e.numDocumento || '0'}-${e.ano}-${e.mes}-${e.valorDocumento || '0'}`;
                    return {
                        id: uniqueId,
                        deputy_id: deputy.id,
                        year: e.ano,
                        month: e.mes,
                        expense_type: e.tipoDespesa,
                        document_url: e.urlDocumento,
                        provider_name: e.nomeFornecedor,
                        net_value: e.valorLiquido,
                        document_date: e.dataDocumento ? new Date(e.dataDocumento).toISOString() : null
                    };
                });

                if (expensesToUpsert.length > 0) {
                    const { error: upsertErr } = await supabase
                        .from('expenses')
                        .upsert(expensesToUpsert, { onConflict: 'id' });
                        
                    if (!upsertErr) {
                        totalSaved += expensesToUpsert.length;
                    }
                }
            }
            
            // Mark the deputy as synced to rotate to the next ones!
            await supabase
                .from('deputies')
                .update({ last_expense_sync: new Date().toISOString() })
                .eq('id', deputy.id);
                
        } catch (err) {
            console.error(`Error syncing expenses for deputy ${deputy.id} (${deputy.name}):`, err);
        }
    }
    
    return `Finished processing. Total new or overwritten expenses saved: ${totalSaved}`;
}

// Deno Cron running every 5 minutes
Deno.cron("Sync Camara Expenses", "*/5 * * * *", async () => {
    await syncExpenses();
});

Deno.serve(async (req) => {
    if (req.method === 'POST') {
        const result = await syncExpenses();
        return new Response(result, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Sync Expenses Function active. POST to force sync.", { status: 200, headers: { "Content-Type": "text/plain" } });
});
