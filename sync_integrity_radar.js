import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
const geminiApiKey = process.env.GOOGLE_GENAI_API_KEY;

async function runAnalysis() {
  console.log('🛡️ Iniciando Análise do Radar de Integridade...');

  // 1. Obter médias globais por tipo de despesa
  const { data: stats } = await supabase.rpc('get_expense_stats'); 
  // Nota: se a RPC não existir, calcularemos no braço
  
  const { data: allStats } = await supabase.from('expenses').select('expense_type, net_value');
  const averages = {};
  allStats.forEach(ex => {
    if (!averages[ex.expense_type]) averages[ex.expense_type] = { total: 0, count: 0 };
    averages[ex.expense_type].total += parseFloat(ex.net_value);
    averages[ex.expense_type].count += 1;
  });

  Object.keys(averages).forEach(type => {
    averages[type].avg = averages[type].total / averages[type].count;
  });

  console.log('✅ Médias calculadas.');

  // 2. Buscar despesas para analisar
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('net_value', { ascending: false })
    .limit(5000); // Focar nas maiores primeiro

  const alerts = [];

  for (const ex of expenses) {
    const val = parseFloat(ex.net_value);
    const avg = averages[ex.expense_type]?.avg || 0;

    // Alerta de Gasto Excessivo (> 5x a média)
    if (val > avg * 5 && val > 500) {
      alerts.push({
        deputy_id: ex.deputy_id,
        title: 'Gasto Muito Acima da Média',
        description: `Esta despesa de R$ ${val.toLocaleString('pt-BR')} em "${ex.expense_type}" está ${(val/avg).toFixed(1)}x acima da média nacional para esta categoria.`,
        alert_type: 'EXCESSIVE_EXPENSE',
        severity: val > avg * 10 ? 'HIGH' : 'MEDIUM',
        net_value: val,
        provider_name: ex.provider_name,
        reference_id: ex.id
      });
    }

    // Alerta de Luxo (Aeronaves / Embarcações)
    if (ex.expense_type.includes('AERONAVE') || ex.expense_type.includes('EMBARCAÇÃO')) {
      alerts.push({
        deputy_id: ex.deputy_id,
        title: 'Uso de Transporte de Luxo',
        description: `O político utilizou verba pública para fretamento de ${ex.expense_type.toLowerCase()} no valor de R$ ${val.toLocaleString('pt-BR')}.`,
        alert_type: 'LUXURY_USAGE',
        severity: 'MEDIUM',
        net_value: val,
        provider_name: ex.provider_name,
        reference_id: ex.id
      });
    }
  }

  // 3. Análise de Financiamento (Concentração)
  console.log('💰 Analisando Concentração de Financiamento...');
  const { data: fundingData } = await supabase
    .from('campaign_donations')
    .select('deputy_id, donor_name, amount, donor_type');

  const deputyFunding = {};
  fundingData.forEach(f => {
    if (!deputyFunding[f.deputy_id]) deputyFunding[f.deputy_id] = { totalPrivate: 0, donors: [] };
    if (f.donor_type === 'PF' || f.donor_type === 'PJ') {
      deputyFunding[f.deputy_id].totalPrivate += parseFloat(f.amount);
      deputyFunding[f.deputy_id].donors.push(f);
    }
  });

  Object.entries(deputyFunding).forEach(([depId, data]) => {
    data.donors.forEach(donor => {
      const perc = (parseFloat(donor.amount) / data.totalPrivate) * 100;
      if (perc > 30 && data.totalPrivate > 10000) {
        alerts.push({
          deputy_id: depId,
          title: 'Dependência de Único Financiador',
          description: `O doador "${donor.donor_name}" sozinho foi responsável por ${perc.toFixed(1)}% de todo o financiamento privado deste político. Isso pode indicar forte influência de terceiros.`,
          alert_type: 'FUNDING_CONCENTRATION',
          severity: perc > 50 ? 'HIGH' : 'MEDIUM',
          net_value: parseFloat(donor.amount)
        });
      }
    });
  });

  if (alerts.length > 0) {
    console.log(`🚀 Inserindo ${alerts.length} alertas detectados...`);
    // Inserir em lotes de 100
    for (let i = 0; i < alerts.length; i += 100) {
      const { error } = await supabase.from('integrity_alerts').upsert(alerts.slice(i, i + 100));
      if (error) console.error('Erro ao inserir:', error);
    }
  }

  console.log('🔍 Iniciando análise Ética de Projetos via IA...');
  // Opcional: Aqui poderíamos rodar uma análise de proposições com Gemini
  // Mas por enquanto vamos focar nos gastos que são mais "virais"

  console.log('✅ Radar Atualizado!');
}

runAnalysis();
