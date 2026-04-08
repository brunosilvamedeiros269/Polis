import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncDeputies() {
    console.log("Forcing deputies sync...");
    const now = new Date();
    
    try {
        const res = await fetch("https://dadosabertos.camara.leg.br/api/v2/deputados?itens=1000");
        const payload = await res.json();
        
        if (!payload || !payload.dados) throw Error("Failed to extract data payload.");

        const deputies = payload.dados.map((d: any) => ({
            id: d.id,
            name: d.nome,
            party: d.siglaPartido,
            state: d.siglaUf,
            avatar_url: d.urlFoto,
            email: d.email,
            last_sync: now.toISOString()
        }));

        const { error: upsertErr } = await supabase
            .from('deputies')
            .upsert(deputies, { onConflict: 'id' });
            
        if (!upsertErr) {
             await supabase
                .from('sync_configs')
                .update({ last_execution: now.toISOString() })
                .eq('entity_type', 'deputies');
                
             return `Successfully synced ${deputies.length} deputies.`;
        } else {
             return "Error upserting deputies: " + JSON.stringify(upsertErr);
        }
    } catch (err) {
        return "Critical error during sync: " + err;
    }
}

// Deno Cron to check and sync data automatically
Deno.cron("Sync Camara Configuration Check", "0 * * * *", async () => {
    // Standard cron verification logic was bypassed inside syncDeputies to allow 100% force update!
    await syncDeputies();
});

Deno.serve(async (req) => {
    if (req.method === 'POST') {
        const res = await syncDeputies();
        return new Response(res, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Sync Function is active. POST to force sync.", { status: 200, headers: { "Content-Type": "text/plain" } });
});
