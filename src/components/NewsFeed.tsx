import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NewsFeedProps {
  following: number[];
  session: any;
  onSelectDeputy?: (id: number) => void;
}

export default function NewsFeed({ following, session, onSelectDeputy }: NewsFeedProps) {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPrefs, setUserPrefs] = useState<any>(null);

  useEffect(() => {
    async function loadFeed() {
      if (following.length === 0) {
        setFeedItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      // Fetch expenses and join with deputies data
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          deputies:deputy_id (
            id,
            name,
            avatar_url,
            party
          )
        `)
        .in('deputy_id', following)
        .order('document_date', { ascending: false, nullsFirst: false })
        .limit(50);

      if (data && !error) {
        setFeedItems(data);
      }
      setLoading(false);
    }

    async function fetchUserPrefs() {
      if (session?.user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('notification_min_value, notification_expense_types')
          .eq('id', session.user.id)
          .single();
        if (data) setUserPrefs(data);
      }
    }

    loadFeed();
    fetchUserPrefs();
  }, [following, session]);

  const normalize = (str: string) => 
    str.toLowerCase()
       .normalize("NFD")
       .replace(/[\u0300-\u036f]/g, "")
       .replace(/[^\w\s]/gi, '')
       .trim();

  const isMatch = (item: any) => {
    if (!userPrefs) return false;
    
    const valueMatch = (item.net_value || 0) >= (userPrefs.notification_min_value || 0);
    const prefTypes = (userPrefs.notification_expense_types || []).map(normalize);
    const itemType = normalize(item.expense_type || "");

    const typeMatch = prefTypes.length === 0 || prefTypes.includes(itemType);
    
    return valueMatch && typeMatch;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite", fontSize: "2rem", color: "var(--color-primary)" }}>sync</span>
      </div>
    );
  }

  if (following.length === 0) {
    return (
      <div style={{ textAlign: "center", marginTop: "4rem", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 2rem" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "4rem", color: "var(--outline-variant)" }}>feed</span>
        <h2 className="headline" style={{ marginTop: "1rem", fontSize: "1.25rem", color: "var(--text-on-surface)" }}>Seu feed está vazio</h2>
        <p style={{ marginTop: "0.5rem", color: "var(--text-on-surface-variant)", fontSize: "0.875rem" }}>
          Siga políticos na aba "Início" para ver em tempo real as movimentações de seus mandatos caindo aqui.
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "2rem" }}>
      <header style={{ padding: "1.5rem", paddingBottom: "1rem", position: "sticky", top: 0, backgroundColor: "rgba(248, 249, 250, 0.9)", backdropFilter: "blur(12px)", zIndex: 10, borderBottom: "1px solid var(--outline-variant)" }}>
        <h1 className="headline" style={{ fontSize: "1.5rem", letterSpacing: "-1px", color: "var(--color-primary-container)" }}>Feed de Atualizações</h1>
      </header>

      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {feedItems.map((item) => {
          const deputy = item.deputies;
          const matched = isMatch(item);
          const dateStr = item.document_date ? new Date(item.document_date) : null;
          let timeAgo = "Data desconhecida";
          if (dateStr) {
             try {
                 timeAgo = formatDistanceToNow(dateStr, { addSuffix: true, locale: ptBR });
             } catch (e) {
                 timeAgo = dateStr.toLocaleDateString('pt-BR');
             }
          }

          const valueFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.net_value || 0);

          return (
            <article key={item.id} className="card" style={{ 
              padding: "1.25rem", 
              display: "flex", 
              gap: "1rem", 
              alignItems: "flex-start", 
              backgroundColor: "var(--bg-surface-lowest)",
              borderLeft: matched ? "6px solid #d32f2f" : "1px solid var(--outline-variant)",
              boxShadow: matched ? "0 4px 12px rgba(211, 47, 47, 0.1)" : "var(--shadow-sm)"
            }}>
              {/* Photo */}
              <div 
                style={{ position: "relative", cursor: "pointer" }} 
                onClick={() => onSelectDeputy && onSelectDeputy(deputy.id)}
              >
                <div style={{ width: "3.5rem", height: "3.5rem", borderRadius: "12px", overflow: "hidden", flexShrink: 0, border: "2px solid var(--bg-surface-high)", boxShadow: "var(--shadow-sm)" }}>
                  <img src={deputy?.avatar_url || 'https://via.placeholder.com/150'} alt={deputy?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                {matched && (
                  <div style={{ position: "absolute", top: "-8px", right: "-8px", background: "#d32f2f", borderRadius: "50%", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", border: "2px solid white", zIndex: 2 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "white", animation: "pulse 2.5s infinite" }}>notifications_active</span>
                  </div>
                )}
              </div>
              
              {/* Post Content */}
              <div style={{ flexGrow: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    <h3 
                      className="headline" 
                      style={{ fontSize: "1rem", color: "var(--color-primary-container)", margin: 0, cursor: "pointer" }}
                      onClick={() => onSelectDeputy && onSelectDeputy(deputy.id)}
                    >
                      {deputy?.name}
                    </h3>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-on-surface-variant)", background: "var(--bg-surface-high)", padding: "2px 6px", borderRadius: "4px", fontWeight: 800 }}>{deputy?.party}</span>
                    {matched && <span style={{ fontSize: "0.625rem", color: "#d32f2f", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px" }}>Radar</span>}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-on-surface-variant)", fontWeight: 500 }}>{timeAgo}</span>
                </div>

                <p style={{ fontSize: "0.875rem", color: "var(--text-on-surface)", lineHeight: "1.5", margin: "0.75rem 0" }}>
                  Declarou gasto de <strong style={{ color: matched ? "#d32f2f" : "var(--color-primary-container)", fontWeight: 900, fontSize: "1rem" }}>{valueFormatted}</strong> com <strong style={{ textTransform: "lowercase", fontWeight: 700 }}>{item.expense_type}</strong>.
                </p>

                <div style={{ margin: "1rem 0", padding: "0.75rem 1rem", backgroundColor: "var(--bg-surface-low)", borderRadius: "12px", border: "1px solid var(--outline-variant)" }}>
                  <span style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 800, color: "var(--text-on-surface-variant)", letterSpacing: "0.05em", display: "block", marginBottom: "0.25rem", opacity: 0.7 }}>Fornecedor</span>
                  <p className="headline" style={{ fontSize: "0.875rem", color: "var(--text-on-surface)", margin: 0 }}>{item.provider_name}</p>
                </div>
                
                {item.document_url && (
                  <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                    <a 
                      href={item.document_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "0.4rem", 
                        fontSize: "0.75rem", 
                        fontWeight: 800, 
                        color: matched ? "#d32f2f" : "var(--color-primary-container)", 
                        padding: "0.6rem 1.2rem", 
                        backgroundColor: matched ? "rgba(211, 47, 47, 0.08)" : "var(--bg-surface-high)", 
                        borderRadius: "12px", 
                        transition: "0.2s",
                        textDecoration: "none",
                        border: matched ? "1px solid rgba(211, 47, 47, 0.2)" : "1px solid var(--outline-variant)"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>receipt_long</span>
                      Visualizar Nota
                    </a>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {feedItems.length > 0 && feedItems.length === 50 && (
           <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-on-surface-variant)", marginTop: "1rem" }}>Exibindo as 50 movimentações mais recentes</p>
        )}
      </div>
    </div>
  );
}
