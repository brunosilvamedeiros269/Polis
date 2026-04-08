import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function UserProfile({ session, onSignOut }: { session: any; onSignOut: () => void }) {
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profileData) setProfile(profileData);
      
      // 2. Fetch Dynamic categories
      const { data: catData } = await supabase
        .from('distinct_expense_types')
        .select('expense_type');
      
      if (catData) {
        setExpenseCategories(catData.map(c => c.expense_type));
      }

      setLoading(false);
    }
    fetchData();
  }, [session]);

  const formatBRL = (value: number | undefined) => {
    if (value === undefined || value === null) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    const numericValue = Number(rawValue) / 100;
    setProfile({ ...profile, notification_min_value: numericValue });
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from('profiles')
      .update({
        notifications_enabled: profile.notifications_enabled,
        notification_min_value: profile.notification_min_value,
        notification_expense_types: profile.notification_expense_types
      })
      .eq('id', session.user.id);
    setSaving(false);
    alert('Preferências salvas com sucesso!');
  };

  if (loading) return <div style={{marginTop:"5rem", textAlign:"center", fontWeight: 700}}>Acessando informações de segurança...</div>;

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", background: "var(--bg-background)", minHeight: "100vh", zIndex: 40, paddingBottom: "100px" }}>
      <header className="app-header">
         <div className="header-left">
           <h1 className="headline">Meu Perfil</h1>
         </div>
         <button onClick={onSignOut} style={{ background: "transparent", color: "var(--color-danger)", border: "none", fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Sair da Conta</button>
      </header>
      <main className="main-content" style={{ marginTop: "5rem" }}>
         <section className="card bg-surface-container-lowest" style={{ marginBottom: "2rem" }}>
            <h2 className="headline" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Notificações de Alerta</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-on-surface-variant)", marginBottom: "1.5rem" }}>
              O app enviará um alerta automático para a sua Caixa de Entrada quando um de seus políticos investigados bater esse valor em uma nota fiscal.
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-surface-high)", borderRadius: "8px" }}>
              <strong style={{ color: "var(--text-on-surface)", fontSize: "0.875rem" }}>Ativar Monitoramento</strong>
              <input 
                type="checkbox" 
                checked={profile.notifications_enabled} 
                onChange={(e) => setProfile({...profile, notifications_enabled: e.target.checked})} 
                style={{ transform: "scale(1.2)" }} 
              />
            </div>

            <div style={{ opacity: profile.notifications_enabled ? 1 : 0.4, pointerEvents: profile.notifications_enabled ? 'auto' : 'none', transition: "0.2s" }}>
               <div style={{ marginBottom: "1.5rem" }}>
                 <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 700, fontSize: "0.875rem" }}>
                   Valor Mínimo Cobrado (R$)
                 </label>
                  <input 
                    type="text" 
                    value={formatBRL(profile.notification_min_value)} 
                    onChange={handlePriceChange}
                    style={{ 
                      width: "100%", padding: "1rem", borderRadius: "8px", border: "2px solid var(--outline-variant)", 
                      background: "var(--bg-background)", color: "var(--text-on-surface)", fontSize: "1.25rem", fontWeight: 800 
                    }}
                  />
                 <small style={{ color: "var(--text-on-surface-variant)", marginTop: "0.5rem", display: "block" }}>
                   Ex: R$ 5.000,00 - Você será avisado pra toda nota cara acima disso emitidas por seus seguidos.
                 </small>
               </div>

               <div style={{ marginBottom: "1.5rem" }}>
                 <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 700, fontSize: "0.875rem" }}>
                   Filtro Específico (Opcional)
                 </label>
                  <small style={{ color: "var(--text-on-surface-variant)", display: "block", marginBottom: "1rem" }}>
                    Deseja focar a lupa apenas em consultorias ou fretamentos? Selecione abaixo. Deixe em branco caso queira alertar **todas**.
                  </small>
                  
                  <div style={{ marginBottom: "0.75rem" }}>
                    <button 
                      onClick={() => {
                        const allSelected = profile.notification_expense_types?.length === expenseCategories.length;
                        setProfile({
                          ...profile, 
                          notification_expense_types: allSelected ? [] : [...expenseCategories]
                        });
                      }}
                      style={{ background: "var(--bg-surface-high)", border: "1px solid var(--outline-variant)", borderRadius: "99px", padding: "0.4rem 1rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", color: "var(--text-on-surface)" }}
                    >
                      {profile.notification_expense_types?.length === expenseCategories.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto", padding: "0.5rem", background: "var(--bg-surface-high)", borderRadius: "8px", border: "1px solid var(--outline-variant)" }}>
                   {expenseCategories.map(cat => {
                     const isChecked = profile.notification_expense_types?.includes(cat);
                     return (
                       <label key={cat} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.75rem", cursor: "pointer", padding: "0.5rem", borderRadius: "4px", background: isChecked ? "var(--color-primary-container)" : "transparent", color: isChecked ? "white" : "var(--text-on-surface)" }}>
                         <input 
                           type="checkbox" 
                           checked={isChecked || false} 
                           onChange={(e) => {
                             let types = profile.notification_expense_types || [];
                             if (e.target.checked) types = [...types, cat];
                             else types = types.filter((t: string) => t !== cat);
                             
                             if(types.length === 0) types = null;
                             setProfile({...profile, notification_expense_types: types});
                           }}
                         />
                         {cat.toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                       </label>
                     )
                   })}
                 </div>
               </div>
            </div>

            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ width: "100%", padding: "1rem", background: "var(--color-primary)", color: "white", borderRadius: "999px", border: "none", fontWeight: 800, fontSize: "1rem", marginTop: "1rem", cursor: "pointer" }}>
              {saving ? 'Gravando no Satélite...' : 'Salvar Radar'}
            </button>
         </section>
      </main>
    </div>
  )
}
