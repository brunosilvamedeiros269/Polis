import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

// Lista de Feriados Nacionais (Brasil) - 2024 e 2025
const NATIONAL_HOLIDAYS = [
  '2024-01-01', '2024-02-13', '2024-03-29', '2024-04-21', '2024-05-01', '2024-05-30', '2024-07-09', '2024-09-07', '2024-10-12', '2024-11-02', '2024-11-15', '2024-11-20', '2024-12-25',
  '2025-01-01', '2025-03-04', '2025-04-18', '2025-04-21', '2025-05-01', '2025-06-19', '2025-09-07', '2025-10-12', '2025-11-02', '2025-11-15', '2025-11-20', '2025-12-25'
];

async function run() {
  console.log('🗓️ Iniciando Detecção de Gastos em Fins de Semana e Feriados...');

  // 1. Pegar todos os deputados
  const { data: deputies } = await supabase.from('deputies').select('id, name');

  for (const deputy of deputies) {
    // 2. Buscar gastos do deputado
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, document_date, net_value, expense_type, provider_name')
      .eq('deputy_id', deputy.id);

    if (!expenses) continue;

    console.log(`\n🔹 Analisando: ${deputy.name}`);

    for (const exp of expenses) {
      if (!exp.document_date) continue;

      const date = new Date(exp.document_date);
      const isoDate = date.toISOString().split('T')[0];
      const dayOfWeek = date.getUTCDay(); // 0 = Domingo, 6 = Sábado

      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = NATIONAL_HOLIDAYS.includes(isoDate);

      if (isWeekend || isHoliday) {
        const type = isHoliday ? 'FERIADO' : (dayOfWeek === 0 ? 'DOMINGO' : 'SÁBADO');
        console.log(`   🚨 Gasto em ${type}: R$ ${exp.net_value} (${exp.expense_type})`);

        // Inserir alerta de integridade
        await supabase.from('integrity_alerts').upsert({
          deputy_id: deputy.id,
          title: `Gasto em ${type}`,
          description: `Gasto de R$ ${exp.net_value.toLocaleString('pt-BR')} com "${exp.expense_type}" realizado em um ${type.toLowerCase()} (${isoDate}) no fornecedor ${exp.provider_name}.`,
          alert_type: 'WEEKEND_EXPENSE',
          severity: 'MEDIUM',
          net_value: exp.net_value
        }, { onConflict: 'deputy_id, description' }); 
        // Nota: onConflict: 'deputy_id, description' para evitar duplicados exatos
      }
    }
  }

  console.log('\n✅ Detecção de Gastos em Feriados Concluída!');
}

run();
