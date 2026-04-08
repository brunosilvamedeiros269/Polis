import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function runPatch() {
    console.log("--- Starting Patch for Missing Proposition Titles ---");
    // Find unique votations that exist in our votes table
    const { data: votes } = await supabase.from('votes').select('uri_votacao').is('proposicao_titulo', null);
    
    if (!votes || votes.length === 0) {
        console.log("No votes found missing titles!");
        return;
    }

    const uniqueUris = [...new Set(votes.map(v => v.uri_votacao).filter(Boolean))];
    console.log(`Found ${uniqueUris.length} unique plenary sessions to patch...`);

    let count = 0;
    for (const uri of uniqueUris) {
        try {
            const res = await fetch(uri, { headers: { 'Accept': 'application/json' } });
            const jDetail = await res.json();
            
            if (jDetail.dados?.proposicoesAfetadas?.[0]) {
                const p = jDetail.dados.proposicoesAfetadas[0];
                const propTitle = `${p.siglaTipo} ${p.numero}/${p.ano}`;
                
                // Update all votes sharing this uri
                const { error } = await supabase.from('votes').update({ proposicao_titulo: propTitle }).eq('uri_votacao', uri);
                if (!error) {
                    count++;
                    console.log(`Patched session ${uri.split('/').pop()} with title: ${propTitle}`);
                } else {
                    console.error("Update error for URIs:", error);
                }
            } else {
                // Se a sessão não tiver nenhuma lei afiliada (ex: requerimentos verbais avulsos)
                await supabase.from('votes').update({ proposicao_titulo: "Requerimento/Avulso" }).eq('uri_votacao', uri);
            }
        } catch(err) {
             console.log(`Failed to fetch/patch ${uri}`);
        }
    }
    
    console.log(`\n✅ Patch completo! ${count} sessões atualizadas com sucesso no banco de dados.`);
}

runPatch();
