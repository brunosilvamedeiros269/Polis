import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface PoliticianProfileProps {
  session: any;
  deputyId: number;
  onBack: () => void;
  isFollowing: boolean;
  onToggleFollow: () => void;
  onShowNotifications?: () => void;
  unreadCount?: number;
}

const PARTY_COLORS: Record<string, { primary: string, secondary: string }> = {
  "PT": { primary: "#cc0000", secondary: "#ff0000" },
  "PL": { primary: "#0033a0", secondary: "#0052cc" },
  "UNIÃO": { primary: "#002776", secondary: "#f2a900" },
  "UB": { primary: "#002776", secondary: "#f2a900" },
  "PP": { primary: "#0033a0", secondary: "#66b2ff" },
  "MDB": { primary: "#006600", secondary: "#f2a900" },
  "PSD": { primary: "#0033a0", secondary: "#f2a900" },
  "REPUBLICANOS": { primary: "#005ba3", secondary: "#f2a900" },
  "PDT": { primary: "#cd192e", secondary: "#002776" },
  "PODE": { primary: "#008a4e", secondary: "#66cc99" },
  "PSDB": { primary: "#0033a0", secondary: "#f2a900" },
  "PSOL": { primary: "#f2a900", secondary: "#cc0000" },
  "PCdoB": { primary: "#cc0000", secondary: "#ff0000" },
  "NOVO": { primary: "#f58220", secondary: "#002776" },
  "PV": { primary: "#006600", secondary: "#66cc99" },
  "REDE": { primary: "#f26522", secondary: "#006600" },
  "SOLIDARIEDADE": { primary: "#f37021", secondary: "#005ba3" },
  "AVANTE": { primary: "#00b0f0", secondary: "#005ba3" },
  "CIDADANIA": { primary: "#ec008c", secondary: "#0033a0" },
  "PRD": { primary: "#0033a0", secondary: "#f2a900" },
  "PSB": { primary: "#ffcc00", secondary: "#cc0000" },
};

export const PoliticianProfile: React.FC<PoliticianProfileProps> = ({ 
  session, 
  deputyId, 
  onBack, 
  isFollowing, 
  onToggleFollow,
  onShowNotifications,
  unreadCount 
}) => {
  const [deputy, setDeputy] = useState<any>(() => {
    const saved = sessionStorage.getItem(`meuPolitico_deputy_${deputyId}`);
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('meuPolitico_profileTab') || 'expenses';
  });
  const [expenses, setExpenses] = useState<any[]>(() => {
    const saved = sessionStorage.getItem(`meuPolitico_expenses_${deputyId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [proposals, setProposals] = useState<any[]>(() => {
    const saved = sessionStorage.getItem(`meuPolitico_proposals_${deputyId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [votes, setVotes] = useState<any[]>(() => {
    const saved = sessionStorage.getItem(`meuPolitico_votes_${deputyId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [amendments, setAmendments] = useState<any[]>(() => {
    const saved = sessionStorage.getItem(`meuPolitico_amendments_${deputyId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [funding, setFunding] = useState<any[]>(() => {
    const saved = sessionStorage.getItem(`meuPolitico_funding_${deputyId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [summaries, setSummaries] = useState<Record<number, any>>({});
  const [integrityAlerts, setIntegrityAlerts] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [speeches, setSpeeches] = useState<any[]>([]);
  const [totalExpense, setTotalExpense] = useState(() => {
    const saved = sessionStorage.getItem(`meuPolitico_totalExpense_${deputyId}`);
    return saved ? parseFloat(saved) : 0;
  });
  const [loading, setLoading] = useState(true);
  const [loadingLegislative, setLoadingLegislative] = useState(false);
  const [userPrefs, setUserPrefs] = useState<any>(null);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => {
    sessionStorage.setItem('meuPolitico_profileTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // 1. Fetch Deputy
      const { data: dep } = await supabase
        .from('deputies')
        .select('*')
        .eq('id', deputyId)
        .single();
        
      if (dep) {
        setDeputy(dep);
        sessionStorage.setItem(`meuPolitico_deputy_${deputyId}`, JSON.stringify(dep));
      }

      // 2. Fetch Expenses (Increased limit for grouping)
      const { data: exp } = await supabase
        .from('expenses')
        .select('*')
        .eq('deputy_id', deputyId)
        .order('document_date', { ascending: false })
        .limit(100);

      if (exp) {
        setExpenses(exp);
        const total = exp.reduce((acc, curr) => acc + (curr.net_value || 0), 0);
        setTotalExpense(total);
        sessionStorage.setItem(`meuPolitico_expenses_${deputyId}`, JSON.stringify(exp));
        sessionStorage.setItem(`meuPolitico_totalExpense_${deputyId}`, total.toString());
      }

      // Fetch Integrity Alerts
      const { data: alertsData } = await supabase
        .from('integrity_alerts')
        .select('*')
        .eq('deputy_id', deputyId)
        .order('created_at', { ascending: false });

      if (alertsData) setIntegrityAlerts(alertsData);

      // Fetch Speeches
      const { data: speechesData } = await supabase
        .from('deputy_speeches')
        .select('*')
        .eq('deputy_id', deputyId)
        .order('date_time', { ascending: false })
        .limit(5);

      if (speechesData) setSpeeches(speechesData);
      
      setLoading(false);
    }

    async function fetchUserPrefs() {
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('notification_min_value, notification_expense_types')
          .eq('id', session.user.id)
          .single();
        if (data) setUserPrefs(data);
      }
    }

    fetchData();
    fetchUserPrefs();
  }, [deputyId, session]);

  useEffect(() => {
    async function fetchLegislative() {
      if (!deputy?.id) return;
      setLoadingLegislative(true);
      
      try {
        const { data: propData } = await supabase
          .from('proposals')
          .select('*')
          .eq('deputy_id', deputy.id)
          .order('data_apresentacao', { ascending: false });
        if (propData) {
          setProposals(propData);
          sessionStorage.setItem(`meuPolitico_proposals_${deputyId}`, JSON.stringify(propData));
        }

        const { data: vts } = await supabase
          .from('votes')
          .select('*')
          .eq('deputy_id', deputyId)
          .order('data', { ascending: false });

        if (vts) {
          setVotes(vts);
          sessionStorage.setItem(`meuPolitico_votes_${deputyId}`, JSON.stringify(vts));
        }

        const { data: amd } = await supabase
          .from('amendments')
          .select('*')
          .eq('deputy_id', deputyId)
          .order('ano', { ascending: false });

        if (amd) {
          setAmendments(amd);
          sessionStorage.setItem(`meuPolitico_amendments_${deputyId}`, JSON.stringify(amd));
        }

        const { data: fnd } = await supabase
          .from('campaign_donations')
          .select('*')
          .eq('deputy_id', deputyId)
          .order('amount', { ascending: false });

        if (fnd) {
          setFunding(fnd);
          sessionStorage.setItem(`meuPolitico_funding_${deputyId}`, JSON.stringify(fnd));
        }

        // Buscar resumos da IA para as propostas carregadas
        if (propData && propData.length > 0) {
          const ids = propData.map((p: any) => p.id);
          const { data: summaries } = await supabase
            .from('proposals_summaries')
            .select('*')
            .in('proposal_id', ids);
          
          if (summaries) {
            const summaryMap: Record<number, any> = {};
            summaries.forEach(s => { summaryMap[s.proposal_id] = s; });
            setSummaries(summaryMap);
          }
        }
        // 5. Fetch Assets
        const { data: ast } = await supabase
          .from('deputy_assets')
          .select('*')
          .eq('deputy_id', deputyId)
          .order('election_year', { ascending: false });
        if (ast) setAssets(ast);

        // 6. Fetch Speeches (New!)
        const { data: spch } = await supabase
          .from('deputy_speeches')
          .select('*')
          .eq('deputy_id', deputyId)
          .order('date_time', { ascending: false })
          .limit(3);
        if (spch) setSpeeches(spch);
      } catch (err) {
        console.error("Erro legislativo:", err);
      } finally {
        setLoadingLegislative(false);
      }
    }

    if (activeTab !== 'expenses') {
      fetchLegislative();
    }
  }, [deputyId, activeTab]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite", fontSize: "2rem", color: "var(--color-primary)" }}>sync</span>
      </div>
    );
  }

  if (!deputy) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ color: "var(--color-danger)", fontWeight: 700 }}>Deputado não encontrado</p>
        <button onClick={onBack} style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "var(--color-primary)", color: "white", borderRadius: "8px", border: "none", cursor: "pointer" }}>Voltar</button>
      </div>
    );
  }

  // Lógica de Agrupamento Cronológico -> Categórico
  const groupedData = expenses.reduce((acc: any, curr: any) => {
    const date = new Date(curr.document_date);
    const monthKey = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);

    if (!acc[capitalizedMonth]) {
      acc[capitalizedMonth] = { total: 0, categories: {} };
    }
    acc[capitalizedMonth].total += (curr.net_value || 0);

    const cat = curr.expense_type || 'OUTROS';
    if (!acc[capitalizedMonth].categories[cat]) {
      acc[capitalizedMonth].categories[cat] = { total: 0, items: [] };
    }
    acc[capitalizedMonth].categories[cat].total += (curr.net_value || 0);
    acc[capitalizedMonth].categories[cat].items.push(curr);

    return acc;
  }, {});

  const normalize = (str: string) => {
    return (str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
      .trim()
      .toLowerCase();
  };

  const isMatch = (item: any) => {
    if (!userPrefs) return false;
    
    const valueMatch = (item.net_value || 0) >= (userPrefs.notification_min_value || 0);
    
    // Normalize preference types for comparison
    const prefTypes = (userPrefs.notification_expense_types || []).map(normalize);
    const itemType = normalize(item.expense_type || "");

    const typeMatch = prefTypes.length === 0 || prefTypes.includes(itemType);
    
    return valueMatch && typeMatch;
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]);
  };

  const toggleCategory = (catKey: string) => {
    setExpandedCategories(prev => prev.includes(catKey) ? prev.filter(c => c !== catKey) : [...prev, catKey]);
  };

  const partyConfig = (deputy && deputy.party && PARTY_COLORS[deputy.party]) || { primary: "var(--color-primary-container)", secondary: "var(--color-secondary)" };

  return (
    <div style={{ 
      position: "absolute", top: 0, left: 0, width: "100%", 
      background: `linear-gradient(to bottom, ${partyConfig.primary}1A 0%, transparent 400px), var(--bg-background)`, 
      minHeight: "100vh", zIndex: 45, paddingBottom: "120px",
      "--color-primary-container": partyConfig.primary,
      "--color-secondary": partyConfig.secondary
    } as React.CSSProperties}>
      {/* Top AppBar - Consistent with main app header */}
      <header className="main-header" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: "rgba(255, 255, 255, 0.8)", backdropFilter: "blur(20px)", padding: "1rem 1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button onClick={onBack} className="icon-btn" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.5rem", color: "var(--text-on-surface)" }}>arrow_back</span>
            </button>
            <h1 className="headline" style={{ fontSize: "1.25rem", margin: 0 }}>Meu Político</h1>
          </div>
          
          {session && onShowNotifications && (
            <div style={{ position: "relative", cursor: "pointer", display: "flex", alignItems: "center" }} onClick={onShowNotifications}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.75rem", color: "var(--text-on-surface)" }}>notifications</span>
              {(unreadCount || 0) > 0 && (
                <span style={{ 
                  position: "absolute", top: "-5px", right: "-5px", 
                  backgroundColor: "var(--color-primary)", color: "white", 
                  fontSize: "0.625rem", fontWeight: 800, width: "18px", height: "18px", 
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" 
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="main-content" style={{ marginTop: "5rem" }}>
          {/* Grid de Radar de Integridade (Fidelidade + Patrimônio) */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
            gap: "1.5rem", 
            marginBottom: "2rem" 
          }}>

            {/* Card de Evolução Patrimonial */}
            {assets.length > 0 && (
              <div style={{
                padding: "1.5rem",
                borderRadius: "24px",
                background: "linear-gradient(135deg, var(--bg-surface-high) 0%, rgba(52, 168, 83, 0.05) 100%)",
                border: "1px solid var(--outline-variant)",
                position: "relative"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="material-symbols-outlined" style={{ color: "#34A853", fontSize: "1.2rem" }}>account_balance_wallet</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>Evolução Patrimonial</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", gap: "1rem" }}>
                  {(() => {
                    const ast2022 = assets.find(a => a.election_year === 2022);
                    const ast2018 = assets.find(a => a.election_year === 2018);
                    const val = ast2022?.total_value || 0;
                    
                    if (ast2022 && ast2018 && ast2018.total_value > 0) {
                      const growth = ((ast2022.total_value - ast2018.total_value) / ast2018.total_value) * 100;
                      return (
                        <>
                          <div style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1, color: growth > 100 ? "var(--color-danger)" : "#34A853" }}>
                            {growth > 0 ? "+" : ""}{Math.round(growth)}%
                          </div>
                          <div style={{ marginBottom: "4px", fontSize: "0.75rem", fontWeight: 800, color: growth > 100 ? "var(--color-danger)" : "#34A853" }}>
                            {growth > 100 ? "Enriquecimento Alto" : "Crescimento Normal"}
                          </div>
                        </>
                      );
                    }
                    return (
                      <div style={{ fontSize: "1.25rem", fontWeight: 900, lineHeight: 1 }}>
                        R$ {val.toLocaleString('pt-BR')}
                      </div>
                    );
                  })()}
                </div>

                <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {[2018, 2022].map(year => {
                    const ast = assets.find(a => a.election_year === year);
                    return (
                      <div key={year} style={{ fontSize: "0.65rem", fontWeight: 700, padding: "4px 8px", borderRadius: "8px", background: "rgba(0,0,0,0.03)" }}>
                        {year}: {ast ? `R$ ${(ast.total_value / 1000000).toFixed(1)}M` : "---"}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        <section className="card profile-section">
          <div className="profile-image-container">
            <div className="profile-ring">
              <div className="profile-image-inner">
                <img
                  src={deputy.avatar_url || 'https://via.placeholder.com/150'}
                  alt={deputy.name}
                />
              </div>
            </div>
            <div className="status-badge">
              Ativo
            </div>
          </div>
          
          <h1 className="profile-name headline">{deputy.name}</h1>
          <div className="profile-subtitle" style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", margin: "1rem 0" }}>
              <span style={{ 
                width: "28px", height: "18px", borderRadius: "3px", 
                background: `linear-gradient(135deg, ${partyConfig.primary} 50%, ${partyConfig.secondary} 50%)`,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                display: "inline-block"
              }}></span>
              <strong style={{ color: "var(--color-primary-container)", fontWeight: 800 }}>Partido {deputy.party}</strong> • {deputy.state}
          </div>

          <div className="profile-actions" style={{ marginTop: "1rem" }}>
            <div className="action-btns-group" style={{ display: "flex", gap: "0.75rem", justifyContent: "center", width: "100%", maxWidth: "300px", margin: "1rem auto" }}>
              <button 
                onClick={onToggleFollow}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  backgroundColor: isFollowing ? "var(--color-success-bg)" : "var(--color-primary-container)",
                  color: isFollowing ? "var(--color-success-text)" : "white",
                  padding: "0.75rem 1rem",
                  borderRadius: "9999px",
                  border: "none",
                  fontFamily: "var(--font-headline)",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  cursor: "pointer"
                }}
              >
                <span className="material-symbols-outlined">
                  {isFollowing ? 'person_remove' : 'person_add'}
                </span>
                {isFollowing ? 'Seguindo' : 'Seguir'}
              </button>
              
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/?deputado=${deputy.id}`;
                  if (navigator.share) {
                    navigator.share({
                      title: `Meu Político: ${deputy.name}`,
                      text: `Acompanhe como vota e os gastos do deputado ${deputy.name} em tempo real.`,
                      url: url,
                    }).catch(console.error);
                  } else {
                    navigator.clipboard.writeText(url);
                    alert("Link do perfil copiado com sucesso!");
                  }
                }} 
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  backgroundColor: "var(--bg-surface-high)",
                  color: "var(--text-on-surface)",
                  padding: "0.75rem 1rem",
                  borderRadius: "9999px",
                  border: "1px solid var(--outline-variant)",
                  fontFamily: "var(--font-headline)",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  cursor: "pointer"
                }}
              >
                <span className="material-symbols-outlined">share</span>
                Compartilhar
              </button>
            </div>
          </div>
        </section>

        {/* Ranking & Reputação Section */}
        {deputy.ranking_score !== null && deputy.ranking_score !== undefined && (
          <section className="card ranking-section" style={{ marginTop: "1rem", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h3 className="headline-small" style={{ margin: 0, fontSize: "1.1rem" }}>Reputação e Ranking</h3>
                <p className="body-small" style={{ opacity: 0.7 }}>Fonte: Ranking dos Políticos</p>
              </div>
              <div style={{ 
                background: "var(--color-primary-container)", 
                color: "white", 
                padding: "0.5rem 1rem", 
                borderRadius: "20px", 
                fontWeight: 800,
                fontSize: "1.25rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}>
                {deputy.ranking_score?.toFixed(1) || "0.0"}
              </div>
            </div>

            <div className="ranking-grids" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div className="ranking-badge-item" style={{ background: "rgba(0,0,0,0.03)", padding: "1rem", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{deputy.ranking_pos_nacional || "---"}º</div>
                <div style={{ fontSize: "0.7rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "1px" }}>No Brasil</div>
              </div>
              <div className="ranking-badge-item" style={{ background: "rgba(0,0,0,0.03)", padding: "1rem", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{deputy.ranking_pos_estadual || "---"}º</div>
                <div style={{ fontSize: "0.7rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "1px" }}>Em {deputy.state}</div>
              </div>
            </div>

            <div className="pillar-metrics">
              {[
                { label: "Votações", val: deputy.ranking_votos, icon: "how_to_vote" },
                { label: "Assiduidade", val: deputy.ranking_presenca, icon: "event_available" },
                { label: "Economia", val: deputy.ranking_economia, icon: "savings" },
                { label: "Ficha Limpa", val: deputy.ranking_processos, icon: "gavel" }
              ].map(p => (
                <div key={p.label} style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", color: "var(--color-primary-container)" }}>{p.icon}</span>
                      {p.label}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{p.val?.toFixed(1) || "0.0"}</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(0,0,0,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ 
                      height: "100%", 
                      width: `${Math.min(100, ((p.val || 0) + 2) * 10)}%`,
                      background: (p.val || 0) >= 0 ? "var(--color-primary-container)" : "var(--color-danger)",
                      borderRadius: "3px",
                      transition: "width 1s ease-out"
                    }} />
                  </div>
                </div>
              ))}
            </div>
            
            <a 
              href={`https://ranking.org.br/perfil/${deputy.ranking_slug || deputy.name.toLowerCase().replace(/\s+/g, '-')}`}
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                display: "block", textAlign: "center", marginTop: "1rem", 
                fontSize: "0.8rem", color: "var(--color-primary-container)", 
                textDecoration: "none", fontWeight: 600 
              }}
            >
              Ver detalhes no Ranking dos Políticos →
            </a>
          </section>
        )}

        {/* Fidelidade Partidária Section (Moved from top) */}
        {deputy.loyalty_score !== undefined && (
          <section className="card loyalty-section" style={{ marginTop: "1rem", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-primary)", fontSize: "1.2rem" }}>verified_user</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>Fidelidade Partidária</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: "1rem" }}>
              <div style={{ fontSize: "2.5rem", fontWeight: 900, lineHeight: 1 }}>
                {Math.round(deputy.loyalty_score)}%
              </div>
              <div style={{ marginBottom: "5px" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, opacity: 0.6 }}>Alinhamento com {deputy.party}</div>
                <div style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: 800, 
                  color: deputy.loyalty_score > 80 ? "#2E7D32" : deputy.loyalty_score > 50 ? "#F57C00" : "#D32F2F"
                }}>
                  {deputy.loyalty_score > 80 ? "Altíssima Fidelidade" : deputy.loyalty_score > 50 ? "Perfil Independente" : "Votação Dissidente"}
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: "1.5rem", height: "6px", background: "rgba(0,0,0,0.05)", borderRadius: "100px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${deputy.loyalty_score}%`, background: "var(--color-primary)", borderRadius: "100px" }} />
            </div>
          </section>
        )}

        {/* Histórico e Mandatos Section */}
        <section className="card mandates-section" style={{ marginTop: "1rem", padding: "1.5rem" }}>
          <h3 className="headline-small" style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Histórico de Mandatos</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ background: "rgba(0,0,0,0.03)", padding: "0.5rem 0.75rem", borderRadius: "8px", fontSize: "0.85rem", border: "1px solid rgba(0,0,0,0.05)" }}>
              <strong>Legislatura 57</strong> (Atual)
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.5rem" }}>
            <button 
              onClick={() => window.open(`https://www.camara.leg.br/deputados/${deputy.id}/biografia`, '_blank')} 
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--bg-surface-high)", padding: "0.75rem", borderRadius: "12px", border: "1px solid var(--outline-variant)", color: "var(--text-on-surface)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", justifyContent: "center" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>history_edu</span>
              Biografia
            </button>
            <button 
              onClick={() => window.open(`https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(deputy.nome_civil || deputy.name)}`, '_blank')} 
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255, 115, 0, 0.1)", padding: "0.75rem", borderRadius: "12px", border: "1px solid rgba(255, 115, 0, 0.2)", color: "rgb(255, 115, 0)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", justifyContent: "center" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>gavel</span>
              Processos
            </button>
          </div>
        </section>

        {/* Quick Stats Grid */}
        <section className="card stats-grid-card" style={{ marginTop: "1rem", padding: "1.5rem" }}>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div className="stat-item" style={{ textAlign: "center" }}>
              <span className="stat-value" style={{ display: "block", fontSize: "1.2rem", fontWeight: 800 }}>{expenses.length || '0'}</span>
              <span className="stat-label" style={{ fontSize: "0.7rem", opacity: 0.6 }}>NFs Lidas</span>
            </div>
            <div className="stat-item" style={{ textAlign: "center" }}>
               <span className="stat-value" style={{ display: "block", fontSize: "1.2rem", fontWeight: 800 }}>Sim</span>
              <span className="stat-label" style={{ fontSize: "0.7rem", opacity: 0.6 }}>Ativo</span>
            </div>
            <div className="stat-item" style={{ textAlign: "center" }}>
               <span className="material-symbols-outlined" style={{ color: "var(--color-success)", fontSize: "1.5rem" }}>verified</span>
              <span className="stat-label" style={{ fontSize: "0.7rem", opacity: 0.6, display: "block" }}>Exercício</span>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div style={{ 
          display: "flex", 
          gap: "1rem", 
          padding: "0 1.5rem", 
          marginBottom: "1.5rem",
          overflowX: "auto",
          scrollbarWidth: "none"
        }}>
          {[
            { id: 'expenses', label: 'Gastos', icon: 'payments' },
            { id: 'proposals', label: 'Projetos', icon: 'description' },
            { id: 'votes', label: 'Votações', icon: 'how_to_vote' },
            { id: 'amendments', label: 'Emendas', icon: 'account_balance_wallet' },
            { id: 'funding', label: 'Financiamento', icon: 'monitoring' },
            { id: 'radar', label: 'Radar Ético', icon: 'security' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.15rem",
                padding: "0.75rem",
                borderRadius: "16px",
                border: "none",
                background: activeTab === tab.id ? "var(--color-primary-container)" : "var(--bg-surface-high)",
                color: activeTab === tab.id ? "white" : "var(--text-on-surface-variant)",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: activeTab === tab.id ? "0 4px 12px var(--color-primary-container)40" : "none"
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.5rem" }}>{tab.icon}</span>
              <span style={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'expenses' && (
          <section className="expenses-section" style={{ padding: "0 1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem" }}>
              <h2 className="headline" style={{ fontSize: "1.25rem", margin: 0 }}>Despesas Recentes</h2>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-primary-container)" }}>R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            
            {Object.keys(groupedData).length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-on-surface-variant)" }}>
                Nenhuma despesa encontrada para este período.
              </div>
            ) : (
              Object.keys(groupedData).map((month) => {
                const isMonthExp = expandedMonths.includes(month);
                return (
                  <div key={month} className="month-group" style={{ marginBottom: "1rem" }}>
                    <div 
                      onClick={() => toggleMonth(month)}
                      style={{ 
                        display: "flex", justifyContent: "space-between", alignItems: "center", 
                        padding: "1.25rem", background: "var(--bg-surface-high)", borderRadius: "16px",
                        cursor: "pointer", marginBottom: "0.5rem", border: "1px solid var(--outline-variant)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span className="material-symbols-outlined" style={{ color: "var(--color-primary-container)" }}>calendar_month</span>
                        <span style={{ fontWeight: 800, color: "var(--text-on-surface)" }}>{month}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--color-primary-container)" }}>R$ {groupedData[month].total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span className="material-symbols-outlined" style={{ 
                          fontSize: "1.5rem", color: "var(--text-on-surface-variant)",
                          transform: isMonthExp ? "rotate(180deg)" : "none",
                          transition: "transform 0.2s"
                        }}>expand_more</span>
                      </div>
                    </div>

                    {isMonthExp && (
                      <div className="category-list" style={{ padding: "0 0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {Object.keys(groupedData[month].categories).map((cat) => {
                          const catData = groupedData[month].categories[cat];
                          const catKey = `${month}-${cat}`;
                          const isCatExp = expandedCategories.includes(catKey);
                          return (
                            <div key={cat} style={{ marginBottom: "0.25rem" }}>
                              <div 
                                onClick={() => toggleCategory(catKey)}
                                style={{ 
                                  display: "flex", justifyContent: "space-between", alignItems: "center", 
                                  padding: "1rem", background: "var(--bg-surface-high)", borderRadius: "12px",
                                  cursor: "pointer", border: "1px solid var(--outline-variant)", opacity: isCatExp ? 1 : 0.9
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
                                  {catData.items.some(isMatch) && (
                                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#d32f2f", animation: "pulse 2s infinite" }}>notifications_active</span>
                                  )}
                                  <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-on-surface-variant)", letterSpacing: "0.5px" }}>{cat.toLowerCase()}</p>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                  <span style={{ fontWeight: 800, fontSize: "0.875rem", color: "var(--text-on-surface)" }}>R$ {catData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: "1.25rem", transform: isCatExp ? "rotate(180deg)" : "none" }}>expand_more</span>
                                </div>
                              </div>

                              {isCatExp && (
                                <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0 0.5rem" }}>
                                  {catData.items.map((item: any) => {
                                    const match = isMatch(item);
                                    return (
                                      <div key={item.id} style={{ 
                                        padding: "1.25rem", borderRadius: "12px", background: "var(--bg-surface-high)",
                                        borderLeft: match ? "4px solid #d32f2f" : `4px solid ${partyConfig.primary}`,
                                        boxShadow: "var(--shadow-sm)"
                                      }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                          <span style={{ fontSize: "0.625rem", color: "var(--text-on-surface-variant)", fontWeight: 800 }}>{new Date(item.document_date).toLocaleDateString('pt-BR')}</span>
                                          {match && <span style={{ fontSize: "0.625rem", color: "#d32f2f", fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "2px" }}><span className="material-symbols-outlined" style={{ fontSize: "12px" }}>warning</span> Radar</span>}
                                        </div>
                                        <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", fontWeight: 800, color: "var(--text-on-surface)", lineHeight: 1.3 }}>{item.provider_name}</p>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                          <span style={{ fontSize: "1.125rem", fontWeight: 900, color: match ? "#d32f2f" : "var(--color-primary-container)" }}>R$ {item.net_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                          {item.document_url && (
                                            <a href={item.document_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--color-primary-container)", textDecoration: "none", fontWeight: 800 }}>
                                              <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>receipt_long</span> Ver Nota
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}

        {activeTab === 'proposals' && (
          <section className="legislative-section" style={{ padding: "0 1.5rem" }}>
            <h2 className="headline" style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>Projetos e Iniciativas</h2>
            {loadingLegislative ? (
               <div style={{ textAlign: "center", padding: "2rem" }}>Carregando dados legislativos...</div>
            ) : proposals.length === 0 ? (
               <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-on-surface-variant)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--outline-variant)", marginBottom: "1rem" }}>sync</span>
                  <p>Sincronizando projetos recentes da base da Câmara...</p>
               </div>
            ) : (
              proposals.map((p) => (
                <div key={p.id} className="card" style={{ padding: "1.25rem", marginBottom: "1rem", background: "var(--bg-surface-high)", borderLeft: `6px solid ${partyConfig.primary}`, borderRadius: "16px", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                    <span style={{ 
                      padding: "0.3rem 0.75rem", background: "var(--color-primary-container)", 
                      color: "white", fontSize: "0.625rem", fontWeight: 800, borderRadius: "6px", textTransform: "uppercase"
                    }}>
                      {p.sigla_tipo} {p.numero}/{p.ano}
                    </span>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-on-surface-variant)", fontWeight: 700 }}>{new Date(p.data_apresentacao).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {summaries[p.id] ? (
                    <div style={{ marginTop: "0.5rem", marginBottom: "1rem", padding: "1.25rem", background: "linear-gradient(135deg, rgba(26, 115, 232, 0.08) 0%, rgba(26, 115, 232, 0.02) 100%)", borderRadius: "14px", border: "1px solid rgba(26, 115, 232, 0.2)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "1.25rem", color: "#1a73e8" }}>auto_awesome</span>
                        <span style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", color: "#1a73e8", letterSpacing: "0.5px" }}>Resumo Inteligente</span>
                      </div>
                      <p style={{ fontSize: "0.925rem", margin: "0 0 1rem 0", lineHeight: "1.6", fontWeight: 600, color: "var(--text-on-surface)" }}>
                        {summaries[p.id]?.summary_plain}
                      </p>
                      {summaries[p.id]?.impact_analysis && (
                        <div style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.6)", padding: "0.75rem", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.03)", display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                           <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", color: "#1a73e8", opacity: 0.8 }}>info</span>
                           <span style={{ color: "var(--text-on-surface-variant)", lineHeight: 1.4 }}><strong>Impacto Direto:</strong> {summaries[p.id].impact_analysis}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: "0 0 1rem 0", fontSize: "0.875rem", color: "var(--text-on-surface)", fontWeight: 800, lineHeight: 1.4 }}>{p.ementa}</p>
                  )}
                  
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <a 
                      href={`https://www.camara.leg.br/propostas-legislativas/${p.id}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        display: "flex", alignItems: "center", gap: "0.4rem", 
                        fontSize: "0.75rem", fontWeight: 800, color: "var(--color-primary-container)",
                        textDecoration: "none", padding: "0.5rem 1rem", background: "rgba(9, 25, 74, 0.05)",
                        borderRadius: "8px", border: "1px solid var(--outline-variant)"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>open_in_new</span>
                      Ver na Câmara
                    </a>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === 'votes' && (
          <section className="legislative-section" style={{ padding: "0 1.5rem" }}>
            <h2 className="headline" style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>Histórico de Votos Nominais</h2>
            {loadingLegislative ? (
               <div style={{ textAlign: "center", padding: "2rem" }}>Carregando histórico...</div>
            ) : votes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-on-surface-variant)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--outline-variant)", marginBottom: "1rem" }}>how_to_vote</span>
                  <p>Buscando registros de sessões plenárias dos últimos 2 anos...</p>
               </div>
            ) : (
              votes.map((v) => {
                const normVote = (v.voto || "").toLowerCase();
                const isPositive = normVote.includes('sim') || normVote.includes('favor');
                const isNegative = normVote.includes('nao') || normVote.includes('contra');
                const statusColor = isPositive ? "#2e7d32" : (isNegative ? "#d32f2f" : "#ed6c02");
                
                return (
                  <div key={v.id} className="card" style={{ padding: "1.25rem", marginBottom: "1rem", background: "var(--bg-surface-high)", borderRadius: "16px", boxShadow: "var(--shadow-sm)", borderLeft: `1px solid var(--outline-variant)` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <div style={{ 
                        display: "flex", alignItems: "center", gap: "0.5rem", 
                        padding: "0.5rem 1rem", background: `${statusColor}10`, 
                        borderRadius: "12px", border: `2px solid ${statusColor}33`
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "1.5rem", color: statusColor }}>{isPositive ? 'check_circle' : (isNegative ? 'cancel' : 'info')}</span>
                        <strong style={{ fontSize: "0.875rem", color: statusColor, textTransform: "uppercase", fontWeight: 900 }}>{v.voto}</strong>
                      </div>
                      <span style={{ fontSize: "0.625rem", color: "var(--text-on-surface-variant)", fontWeight: 700 }}>{new Date(v.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {v.proposicao_titulo && (
                      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: "var(--color-primary-container)", fontWeight: 900 }}>
                        {v.proposicao_titulo}
                      </h4>
                    )}
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", color: "var(--text-on-surface)", fontWeight: 800, lineHeight: 1.4 }}>{v.proposicao_ementa}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: 0.7 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "1.125rem", color: "var(--text-on-surface-variant)" }}>meeting_room</span>
                        <span style={{ fontSize: "0.625rem", color: "var(--text-on-surface-variant)", textTransform: "uppercase", fontWeight: 800 }}>Sessão: {v.sessao_nome}</span>
                      </div>
                      
                      <a 
                        href={`https://www.camara.leg.br/propostas-legislativas/${v.id.split('-')[0]}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          display: "flex", alignItems: "center", gap: "0.4rem", 
                          fontSize: "0.625rem", fontWeight: 800, color: "var(--color-primary-container)",
                          textDecoration: "none", padding: "0.4rem 0.8rem", background: "rgba(9, 25, 74, 0.05)",
                          borderRadius: "8px", border: "1px solid var(--outline-variant)", transition: "0.2s"
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "0.875rem" }}>open_in_new</span>
                        Ver Projeto
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}
        {activeTab === 'amendments' && (
          <section className="amendments-section" style={{ padding: "0 1.5rem" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 className="headline" style={{ fontSize: "1.25rem", margin: "0 0 0.5rem 0" }}>Emendas Parlamentares</h2>
              <p className="body-small" style={{ opacity: 0.7 }}>Recursos indicados pelo parlamentar no Orçamento da União.</p>
            </div>

            {amendments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", background: "var(--bg-surface-high)", borderRadius: "16px", border: "1px solid var(--outline-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--text-on-surface-variant)", opacity: 0.3, marginBottom: "1rem" }}>account_balance_wallet</span>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--text-on-surface-variant)" }}>Nenhuma emenda encontrada no banco de dados.</p>
                <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.5rem" }}>Os dados são sincronizados do Portal da Transparência.</p>
                
                <button 
                  onClick={() => window.open(`https://portaldatransparencia.gov.br/emendas/consulta?nomeAutor=${encodeURIComponent(deputy.name)}`, '_blank')}
                  style={{ marginTop: "1.5rem", padding: "0.75rem 1rem", borderRadius: "12px", border: "none", background: "var(--color-primary-container)", color: "white", fontWeight: 700, cursor: "pointer" }}
                >
                  Consultar no Portal da Transparência
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                {/* Summary Card Geral */}
                <div style={{ padding: "1.5rem", borderRadius: "20px", background: "var(--color-primary-container)", color: "white", boxShadow: "0 8px 24px var(--color-primary-container)40" }}>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 800, opacity: 0.8, marginBottom: "0.5rem", letterSpacing: "1px" }}>Total Geral (2023-2027)</div>
                  <div style={{ fontSize: "2rem", fontWeight: 900 }}>
                    R$ {amendments.reduce((acc, curr) => acc + (curr.valor_empenhado || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                    <div>
                      <div style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 800, opacity: 0.7 }}>Total Pago</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>R$ {amendments.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 800, opacity: 0.7 }}>Emendas</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{amendments.length}</div>
                    </div>
                  </div>
                </div>

                {/* Grouped by Year */}
                {Object.entries(
                  amendments.reduce((acc: any, curr) => {
                    const year = curr.ano;
                    if (!acc[year]) acc[year] = [];
                    acc[year].push(curr);
                    return acc;
                  }, {})
                )
                .sort((a: any, b: any) => b[0] - a[0])
                .map(([year, yearAmds]: [string, any]) => (
                  <div key={year} className="year-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "2px solid var(--outline-variant)" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "var(--text-on-surface)" }}>Ano {year}</h3>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--color-primary-container)" }}>
                        R$ {yearAmds.reduce((a: any, b: any) => a + (b.valor_empenhado || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {yearAmds.map((amd: any) => (
                        <div key={amd.id} style={{ 
                          padding: "1.25rem", borderRadius: "16px", background: "var(--bg-surface-high)", 
                          border: "1px solid var(--outline-variant)", boxShadow: "var(--shadow-sm)" 
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--color-primary-container)", background: "var(--color-primary-container)1A", padding: "0.25rem 0.5rem", borderRadius: "6px" }}>{amd.tipo_emenda}</span>
                            <span style={{ fontSize: "0.7rem", opacity: 0.6, fontWeight: 700 }}>#{amd.numero_emenda}</span>
                          </div>
                          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 800, color: "var(--text-on-surface)" }}>{amd.localidade}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "1rem", opacity: 0.5 }}>category</span>
                            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{amd.funcao}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--color-primary-container)" }}>R$ {amd.valor_empenhado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--color-success)", fontWeight: 700 }}>Pago: R$ {amd.valor_pago?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button 
              onClick={() => window.open(`https://portaldatransparencia.gov.br/emendas/consulta?nomeAutor=${encodeURIComponent(deputy.name)}`, '_blank')}
              style={{ width: "100%", marginTop: "2rem", padding: "1rem", borderRadius: "16px", border: "1px solid var(--outline-variant)", background: "var(--bg-surface-high)", color: "var(--text-on-surface)", fontWeight: 700, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", cursor: "pointer" }}
            >
              <span className="material-symbols-outlined">open_in_new</span>
              Ver no Portal da Transparência
            </button>
          </section>
        )}
        {activeTab === 'funding' && (
          <section className="funding-section" style={{ padding: "0 1.5rem" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 className="headline" style={{ fontSize: "1.25rem", margin: "0 0 0.5rem 0" }}>Financiamento de Campanha</h2>
              <p className="body-small" style={{ opacity: 0.7 }}>Origem dos recursos da última eleição (2022).</p>
            </div>

            {funding.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", background: "var(--bg-surface-high)", borderRadius: "16px", border: "1px solid var(--outline-variant)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--text-on-surface-variant)", opacity: 0.3, marginBottom: "1rem" }}>monitoring</span>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--text-on-surface-variant)" }}>Dados de financiamento ainda não sincronizados.</p>
                <button 
                  onClick={() => window.open(`https://divulgacandcontas.tse.jus.br/divulga/#/estados/2022/2045202022/${deputy.state}/candidatos/6`, '_blank')}
                  style={{ marginTop: "1.5rem", padding: "0.75rem 1rem", borderRadius: "12px", border: "none", background: "var(--color-primary-container)", color: "white", fontWeight: 700, cursor: "pointer" }}
                >
                  Ver no DivulgaCand (TSE)
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Summary View */}
                <div style={{ padding: "1.5rem", borderRadius: "20px", background: "var(--bg-surface-high)", border: "1px solid var(--outline-variant)" }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 800, marginBottom: "1rem", color: "var(--text-on-surface)" }}>Composição da Receita</div>
                  
                  {(() => {
                    const total = funding.reduce((acc, curr) => acc + curr.amount, 0);
                    const publicTotal = funding.filter(f => f.donor_type === 'PARTIDO').reduce((acc, curr) => acc + curr.amount, 0);
                    const privateTotal = funding.filter(f => f.donor_type === 'PF').reduce((acc, curr) => acc + curr.amount, 0);
                    const ownTotal = funding.filter(f => f.donor_type === 'PROPRIO').reduce((acc, curr) => acc + curr.amount, 0);
                    
                    const publicPerc = total > 0 ? ((publicTotal / total) * 100).toFixed(1) : "0";
                    const privatePerc = total > 0 ? ((privateTotal / total) * 100).toFixed(1) : "0";
                    const ownPerc = total > 0 ? ((ownTotal / total) * 100).toFixed(1) : "0";

                    return (
                      <>
                        {/* Legend with Percentages */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "1.5rem" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1a73e8" }}></div>
                              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-on-surface-variant)" }}>Público (Fundo)</span>
                            </div>
                            <span style={{ fontSize: "1.25rem", fontWeight: 900 }}>{publicPerc}%</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fbbc04" }}></div>
                              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-on-surface-variant)" }}>Privado (PF)</span>
                            </div>
                            <span style={{ fontSize: "1.25rem", fontWeight: 900 }}>{privatePerc}%</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34a853" }}></div>
                              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-on-surface-variant)" }}>Próprio</span>
                            </div>
                            <span style={{ fontSize: "1.25rem", fontWeight: 900 }}>{ownPerc}%</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ height: "14px", width: "100%", background: "var(--outline-variant)", borderRadius: "7px", display: "flex", overflow: "hidden", marginBottom: "0.5rem" }}>
                          <div style={{ width: `${publicPerc}%`, background: "#1a73e8", transition: "width 0.5s ease" }} title="Público"></div>
                          <div style={{ width: `${privatePerc}%`, background: "#fbbc04", transition: "width 0.5s ease" }} title="Privado"></div>
                          <div style={{ width: `${ownPerc}%`, background: "#34a853", transition: "width 0.5s ease" }} title="Próprio"></div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Setores Econômicos (IA) */}
                <div style={{ padding: "1.5rem", borderRadius: "20px", background: "var(--bg-surface-high)", border: "1px solid var(--outline-variant)" }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 800, marginBottom: "1rem", color: "var(--text-on-surface)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.2rem", color: "var(--color-primary)" }}>hub</span>
                    Principais Setores (IA)
                  </div>
                  
                  {(() => {
                    const sectorTotals: Record<string, number> = {};
                    let totalPrivate = 0;
                    
                    funding.forEach(f => {
                      // Se for PF, auto-classificar como 'Pessoas Físicas' se estiver null
                      const s = f.sector || (f.donor_type === 'PF' ? 'Pessoas Físicas' : (f.donor_type === 'PARTIDO' ? 'Partidos / Fundo' : (f.donor_type === 'PROPRIO' ? 'Recursos Próprios' : 'Outros / Não Identificado')));
                      sectorTotals[s] = (sectorTotals[s] || 0) + f.amount;
                      totalPrivate += f.amount;
                    });

                    const sortedSectors = Object.entries(sectorTotals)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5);

                    if (totalPrivate === 0) return <div style={{ fontSize: "0.85rem", opacity: 0.5 }}>Dados insuficientes para análise de setores.</div>;

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {sortedSectors.map(([sector, amount]) => {
                          const p = ((amount / totalPrivate) * 100).toFixed(1);
                          return (
                            <div key={sector}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
                                <span style={{ fontWeight: 700 }}>{sector}</span>
                                <span style={{ fontWeight: 800 }}>{p}%</span>
                              </div>
                              <div style={{ height: "8px", width: "100%", background: "var(--outline-variant)", borderRadius: "4px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${p}%`, background: "var(--color-primary-container)", borderRadius: "4px" }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Top Donors List */}
                <div>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 900, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-on-surface-variant)" }}>Maiores Doadores</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {funding.map((donor) => (
                      <div key={donor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "var(--bg-surface-high)", borderRadius: "12px", border: "1px solid var(--outline-variant)" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-on-surface)" }}>{donor.donor_name}</span>
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.2rem" }}>
                             <span style={{ fontSize: "0.65rem", opacity: 0.6, fontWeight: 700 }}>{donor.donor_type === 'PARTIDO' ? 'Partido Político' : 'Privado'}</span>
                             {donor.sector && (
                               <span style={{ fontSize: "0.6rem", background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: "4px", color: "var(--color-primary-container)", fontWeight: 800 }}>{donor.sector}</span>
                             )}
                          </div>
                        </div>
                        <span style={{ fontSize: "0.9rem", fontWeight: 900, color: "var(--color-primary-container)" }}>
                          R$ {donor.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => window.open(`https://divulgacandcontas.tse.jus.br/divulga/#/estados/2022/2045202022/${deputy.state}/candidatos/6`, '_blank')}
                  style={{ width: "100%", padding: "1rem", borderRadius: "16px", border: "1px solid var(--outline-variant)", background: "transparent", color: "var(--text-on-surface)", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>open_in_new</span>
                  Ver Detalhes no DivulgaCand
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'radar' && (
          <section className="radar-section" style={{ padding: "0 1.5rem" }}>
            <div style={{
              background: "linear-gradient(135deg, var(--color-primary-container) 0%, #1a237e 100%)",
              padding: "2rem",
              borderRadius: "24px",
              color: "white",
              textAlign: "center",
              marginBottom: "1.5rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)"
            }}>
              <div style={{ fontSize: "0.8rem", textTransform: "uppercase", opacity: 0.8, letterSpacing: "1px", marginBottom: "0.5rem" }}>
                Score de Integridade
              </div>
              <div style={{ fontSize: "3.5rem", fontWeight: 900 }}>
                {Math.max(0, 100 - (integrityAlerts.length * 5))}%
              </div>
              <p style={{ fontSize: "0.9rem", opacity: 0.9, marginTop: "0.5rem" }}>
                {integrityAlerts.length === 0 ? "Nenhum alerta crítico detectado até o momento." : `${integrityAlerts.length} alertas pendentes de análise.`}
              </p>
            </div>

            <div className="alerts-list" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {integrityAlerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", background: "rgba(0,0,0,0.02)", borderRadius: "16px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "3rem", opacity: 0.2 }}>verified_user</span>
                  <p style={{ marginTop: "1rem", opacity: 0.5 }}>Tudo limpo no radar deste político.</p>
                </div>
              ) : (
                integrityAlerts.map(alert => (
                  <div key={alert.id} className="alert-card" style={{
                    background: "white",
                    padding: "1.25rem",
                    borderRadius: "16px",
                    borderLeft: alert.severity === 'HIGH' ? "6px solid #ff1744" : "6px solid #ffea00",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 800, color: alert.severity === 'HIGH' ? "#ff1744" : "#f57c00", textTransform: "uppercase" }}>
                        {alert.severity === 'HIGH' ? 'Alerta Crítico' : 'Alerta Médio'}
                      </span>
                      <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>{new Date(alert.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem" }}>{alert.title}</h4>
                    <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: 0, lineHeight: "1.4" }}>{alert.description}</p>
                    
                    {alert.net_value && (
                      <div style={{ marginTop: "1rem", fontSize: "1.1rem", fontWeight: 800, color: "var(--color-primary-container)" }}>
                        R$ {parseFloat(alert.net_value).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: "2rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 900, marginBottom: "1rem", color: "var(--text-on-surface-variant)", textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>mic</span>
                Voz do Parlamentar (2024)
              </h3>
              
              {speeches.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", borderRadius: "20px", background: "var(--bg-surface-high)", border: "1px dashed var(--outline-variant)" }}>
                  <p style={{ opacity: 0.5, fontSize: "0.875rem" }}>Buscando discursos recentes...</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {speeches.map((spch) => (
                    <div key={spch.id} style={{ 
                      padding: "1.5rem", borderRadius: "20px", background: "white", 
                      border: "1px solid var(--outline-variant)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 800, background: "var(--color-primary-container)1A", color: "var(--color-primary-container)", padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                          {spch.tipo_discurso || 'Discurso'}
                        </span>
                        <span style={{ fontSize: "0.7rem", opacity: 0.5, fontWeight: 700 }}>{new Date(spch.date_time).toLocaleDateString('pt-BR')}</span>
                      </div>
                      
                      <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", fontWeight: 900, color: "var(--text-on-surface)", lineHeight: 1.3 }}>
                        {spch.keywords ? (spch.keywords.split(',').slice(0, 3).join(' • ')) : "Temas Diversos"}
                      </p>
                      
                      <div style={{ fontSize: "0.85rem", opacity: 0.7, lineHeight: 1.5, background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "12px", borderLeft: "3px solid var(--color-primary-container)" }}>
                        "{spch.transcription?.substring(0, 200)}..."
                      </div>

                      <button 
                        onClick={() => window.open(spch.uri_evento, '_blank')}
                        style={{ marginTop: "1rem", border: "none", background: "none", color: "var(--color-primary-container)", fontWeight: 800, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", padding: 0 }}
                      >
                        Ver na íntegra <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>open_in_new</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "1rem", background: "rgba(0,0,0,0.03)", borderRadius: "12px", fontSize: "0.75rem", textAlign: "center", opacity: 0.6, marginTop: "2rem", marginBottom: "3rem" }}>
              O Radar de Integridade utiliza IA e estatísticas comparativas entre os 513 deputados para detectar desvios de padrão. Alertas não constituem prova de crime.
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
