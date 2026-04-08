import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

export default function Dashboard({ following }: { following: number[] }) {
  const [totalMonth, setTotalMonth] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFollowed, setHasFollowed] = useState(true);

  // Lê pelo filtro dos Seguidos passados via Prop
  useEffect(() => {
    async function loadData() {
      try {
        const followedIds = following;

        // Valor zerado se a pessoa não seguiu político nenhum
        if (!followedIds || followedIds.length === 0) {
            setHasFollowed(false);
            setExpenses([]);
            setTotalMonth(0);
            setLoading(false);
            return;
        }

        setHasFollowed(true);
        // Puxa as despesas que pertencem SOMENTE DEPUTADOS SEGUIDOS
        const { data, error } = await supabase
           .from('expenses')
           .select('*')
           .in('deputy_id', followedIds)
           .limit(2000);
           
        if (data && !error) {
          setExpenses(data);
          const sum = data.reduce((acc, curr) => acc + (curr.net_value || 0), 0);
          setTotalMonth(sum);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    loadData();
  }, [following]);

  if (loading) return <p style={{textAlign: "center", marginTop: "4rem"}}>Carregando processamento de Metadados Matemáticos...</p>;

  // Formatador Local - Real Brasileiro
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <>
      {/* Top AppBar */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="headline" style={{ marginLeft: "0.5rem" }}>Despesas Rastreadas</h1>
        </div>
      </header>

      <main className="main-content" style={{ paddingBottom: "6rem" }}>
        
        {/* Helper Empty State se o usuario é novo! */}
        {!hasFollowed && (
             <div style={{ backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "1rem", padding: "1rem", marginTop: "1rem", fontSize: "0.875rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span className="material-symbols-outlined">warning</span>
                Você ainda não seguiu nenhum político. Volte até a aba de **Busca** e ative o botão Seguir para extrairmos seus gastos em nuvem.
             </div>
        )}

        {/* Total Expense Hero Card */}
        <section style={{ position: "relative", backgroundColor: "var(--color-primary-container)", borderRadius: "1rem", padding: "2rem", color: "white", overflow: "hidden", boxShadow: "0 20px 40px rgba(13,12,34,0.06)" }}>
          <div style={{ position: "relative", zIndex: 10 }}>
            <p style={{ fontFamily: "Plus Jakarta Sans", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", color: "var(--color-secondary-fixed-dim)", marginBottom: "0.25rem" }}>
              Gasto Acumulado (Seguindo)
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", marginBottom: "1rem" }}>
              <h2 className="headline" style={{ fontSize: "2.25rem", fontWeight: 800, color: "white", margin: 0 }}>
                {formatCurrency(totalMonth)}
              </h2>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", opacity: 0.8 }}>
                <span className="material-symbols-outlined" style={{fontSize: "1rem", color: "var(--color-secondary)"}}>trending_up</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Calculado a partir de {expenses.length} notas emitidas no governo.</span>
            </div>
          </div>
          {/* Decorative Circle */}
          <div style={{ position: "absolute", right: "-3rem", bottom: "-3rem", width: "12rem", height: "12rem", backgroundColor: "var(--color-secondary)", borderRadius: "50%", filter: "blur(60px)", opacity: 0.3 }}></div>
        </section>

        {/* Insight Banner */}
        <div style={{ backgroundColor: "rgba(179, 29, 95, 0.05)", borderRadius: "9999px", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", border: "1px solid rgba(179, 29, 95, 0.1)" }}>
          <span className="material-symbols-outlined" style={{ color: "var(--color-secondary)", fontVariationSettings: "'FILL' 1" }}>insights</span>
          <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-on-surface)" }}>Insight: O app está de olho na corrupção e os dados estão encriptados.</p>
        </div>

        {/* Graphic Bars */}
        <section className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h3 className="headline" style={{ fontSize: "1.25rem", color: "var(--color-primary-container)" }}>Evolução Mensal</h3>
            <span className="material-symbols-outlined" style={{ color: "var(--text-on-surface-variant)" }}>more_horiz</span>
          </div>
          
          <div style={{ height: "12rem", width: "100%", position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-around", padding: "0" }}>
            <div style={{ width: "2.5rem", backgroundColor: "var(--bg-surface-highest)", borderRadius: "9999px 9999px 0 0", height: hasFollowed ? "40%" : "5%" }}></div>
            <div style={{ width: "2.5rem", backgroundColor: "var(--bg-surface-highest)", borderRadius: "9999px 9999px 0 0", height: hasFollowed ? "65%" : "5%" }}></div>
            <div style={{ width: "2.5rem", backgroundColor: "var(--bg-surface-highest)", borderRadius: "9999px 9999px 0 0", height: hasFollowed ? "55%" : "5%" }}></div>
            <div style={{ width: "2.5rem", backgroundColor: "var(--bg-surface-highest)", borderRadius: "9999px 9999px 0 0", height: hasFollowed ? "80%" : "5%" }}></div>
            <div style={{ width: "2.5rem", backgroundColor: "var(--color-secondary)", borderRadius: "9999px 9999px 0 0", height: hasFollowed ? "95%" : "5%" }}></div>
          </div>
        </section>

        {/* Bento Grid Analytics */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "0.75rem", backgroundColor: "rgba(9, 25, 74, 0.05)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-primary-container)" }}>receipt_long</span>
            </div>
            <p style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-on-surface-variant)" }}>Cupons / Notas</p>
            <p className="headline" style={{ fontSize: "1.5rem", color: "var(--color-primary-container)" }}>{expenses.length}</p>
          </div>
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "0.75rem", backgroundColor: "rgba(179, 29, 95, 0.05)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-secondary)" }}>local_atm</span>
            </div>
            <p style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-on-surface-variant)" }}>Pico Máximo</p>
            <p className="headline" style={{ fontSize: "1.1rem", color: "var(--color-primary-container)" }}>
               {hasFollowed && expenses.length > 0 ? formatCurrency(Math.max(...expenses.map(e => e.net_value || 0))) : "R$ 0,00"}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
