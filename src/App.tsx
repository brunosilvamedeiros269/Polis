import { useEffect, useState } from 'react';
import './index.css';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import NewsFeed from './components/NewsFeed';
import { PoliticianProfile } from './components/PoliticianProfile';
import LoginScreen from './components/LoginScreen';
import UserProfile from './components/UserProfile';
import NotificationInbox from './components/NotificationInbox';
import NotificationBell from './components/NotificationBell';
import { App as CapApp } from '@capacitor/app';

function App() {
  const [session, setSession] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [deputies, setDeputies] = useState<any[]>(() => {
    const saved = sessionStorage.getItem('meuPolitico_deputies');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('meuPolitico_activeTab') || 'inicio');
  const [selectedDeputyId, setSelectedDeputyId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('meuPolitico_selectedDeputyId');
    return saved ? parseInt(saved, 10) : null;
  });
  
  // Estados para Busca e Filtro
  const [feedMode, setFeedMode] = useState<'explorar' | 'seguindo'>(() => (sessionStorage.getItem('meuPolitico_feedMode') as any) || 'explorar');
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('meuPolitico_searchQuery') || '');
  const [following, setFollowing] = useState<number[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [radarDeputyIds, setRadarDeputyIds] = useState<number[]>([]);
  const [showNotifInbox, setShowNotifInbox] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 24;

  // Sync state changes back to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('meuPolitico_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedDeputyId === null) {
      sessionStorage.removeItem('meuPolitico_selectedDeputyId');
    } else {
      console.log(`🚀 Navegando para Deputado ID: ${selectedDeputyId}`);
      sessionStorage.setItem('meuPolitico_selectedDeputyId', selectedDeputyId.toString());
      // Força o scroll para o topo ao trocar de perfil
      window.scrollTo(0, 0);
    }
  }, [selectedDeputyId]);

  useEffect(() => {
    sessionStorage.setItem('meuPolitico_feedMode', feedMode);
  }, [feedMode]);

  useEffect(() => {
    sessionStorage.setItem('meuPolitico_searchQuery', searchQuery);
  }, [searchQuery]);

  // 0. Listener de Scroll para Persistência
  useEffect(() => {
    const handleScroll = () => {
      const scrollKey = selectedDeputyId 
        ? `meuPolitico_scroll_deputy_${selectedDeputyId}` 
        : `meuPolitico_scroll_${activeTab}`;
      sessionStorage.setItem(scrollKey, window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedDeputyId, activeTab]);

  // Restaura Scroll ao Mudar de Aba ou Perfil
  useEffect(() => {
    const scrollKey = selectedDeputyId 
      ? `meuPolitico_scroll_deputy_${selectedDeputyId}` 
      : `meuPolitico_scroll_${activeTab}`;
    
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll) {
      setTimeout(() => {
        window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' });
      }, 100);
    }
  }, [selectedDeputyId, activeTab]);

  // Deep Link Parser (E.g. /?deputado=123)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const depId = params.get('deputado');
    if (depId) {
      setSelectedDeputyId(parseInt(depId, 10));
      // Limpa a URL silenciosamente para não manter o parâmetro engessado
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // 1. Ouvinte Global de Autenticação Supabase - Otimizado (sem dependências de view)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (!session) {
        setFollowing([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Back Button (separado)
  useEffect(() => {
    const backListener = CapApp.addListener('backButton', () => {
      if (selectedDeputyId !== null) {
        setSelectedDeputyId(null);
      } else if (activeTab !== 'inicio') {
        setActiveTab('inicio');
      } else {
        CapApp.exitApp();
      }
    });
    return () => { backListener.then(l => l.remove()); };
  }, [selectedDeputyId, activeTab]);

  // 2. Trazer a array de "Seguindo" do Banco de Dados Cloud e Unread Notifications
  useEffect(() => {
    if (session) {
      async function fetchProfile() {
        const { data } = await supabase
          .from('profiles')
          .select('following')
          .eq('id', session.user.id)
          .single();
          
        if (data && data.following) {
          setFollowing(data.following);
        }
      }
      async function fetchUnreadCount() {
        const { data, count } = await supabase
          .from('notifications')
          .select('deputy_id', { count: 'exact' })
          .eq('user_id', session.user.id)
          .eq('is_read', false);
        
        setUnreadCount(count || 0);
        if (data) {
          const ids = Array.from(new Set(data.map(n => Number(n.deputy_id))));
          setRadarDeputyIds(ids);
        }
      }
      fetchProfile();
      fetchUnreadCount();
    }
  }, [session, showNotifInbox]);

  // Função Guardiã que força o Login para ações protegidas
  const requireAuth = (action: () => void) => {
    if (session) {
      action();
    } else {
      setPendingAction(() => action); // Salva o que a pessoa queria fazer
      setShowLogin(true); // Exibe a o Modal de Bloqueio
    }
  };

  // 3. Modificando o Seguir para atualizar o Banco de Dados em tempo real
  const toggleFollow = (id: number) => {
    requireAuth(async () => {
      let newFollowing;
      if (following.includes(id)) {
        newFollowing = following.filter(fid => fid !== id);
      } else {
        newFollowing = [...following, id];
      }
      // Atualiza estado local para resposta instantânea
      setFollowing(newFollowing);
      
      // Persiste na Nuvem invisivelmente
      if (session) {
        await supabase
          .from('profiles')
          .update({ following: newFollowing })
          .eq('id', session.user.id);
      }
    });
  };

  // Motor de Busca e Listagem por Ranking
  useEffect(() => {
    async function fetchDeputies() {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase.from('deputies').select('*', { count: 'exact' });

      if (feedMode === 'seguindo') {
        if (following.length === 0) {
          setDeputies([]);
          setLoading(false);
          setHasMore(false);
          return;
        }
        query = query.in('id', following);
      } else {
        // Modo Explorar: Ordenação por Ranking obrigatória
        query = query.order('ranking_score', { ascending: false, nullsFirst: false });
        
        if (searchQuery.trim().length > 0) {
          const term = `%${searchQuery.trim()}%`;
          // Tenta buscar no nome parlamentar ou nome civil
          query = query.or(`name.ilike.${term},nome_civil.ilike.${term}`);
        }
      }

      const { data, count } = await query.range(from, to);
      
      if (data) {
        if (page === 0) {
          setDeputies(data);
        } else {
          setDeputies(prev => [...prev, ...data]);
        }
        setHasMore(count ? (from + data.length < count) : data.length === PAGE_SIZE);
      }
      setLoading(false);
    }
    
    const timeoutId = setTimeout(() => {
       fetchDeputies();
    }, 400); // Throttle levemente menor para resposta mais rápida
    return () => clearTimeout(timeoutId);

  }, [feedMode, following.length, searchQuery, page]);

  // Reset de página quando o critério muda
  useEffect(() => {
    setPage(0);
  }, [feedMode, searchQuery]);

  return (
    <>
      {showLogin && (
        <LoginScreen 
          onClose={() => {
            setShowLogin(false);
            setPendingAction(null);
          }} 
          onSuccess={() => {
            setShowLogin(false);
            if (pendingAction) {
              pendingAction();
              setPendingAction(null);
            }
          }} 
        />
      )}

      {showNotifInbox && session && (
        <NotificationInbox 
          session={session} 
          onClose={() => setShowNotifInbox(false)} 
          onSelectDeputy={(id) => setSelectedDeputyId(id)}
        />
      )}

      {selectedDeputyId !== null && (
        <PoliticianProfile 
          session={session}
          deputyId={selectedDeputyId as number} 
          onBack={() => setSelectedDeputyId(null)} 
          isFollowing={following.includes(selectedDeputyId as number)}
          onToggleFollow={() => toggleFollow(selectedDeputyId as number)}
          onShowNotifications={() => setShowNotifInbox(true)}
          unreadCount={unreadCount}
        />
      )}

      {selectedDeputyId === null && (
        <>
          {activeTab === 'inicio' ? (
            <>
          <header className="app-header" style={{ height: "auto", flexDirection: "column", padding: "1.5rem", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <h1 className="headline" style={{ fontSize: "1.5rem", letterSpacing: "-1px" }}>Visão Geral</h1>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {session && (
                    <NotificationBell 
                      userId={session.user.id} 
                      onSelectDeputy={(id) => setSelectedDeputyId(id)}
                    />
                  )}
                  <div className="avatar" 
                       onClick={() => {
                         if(!session) { setShowLogin(true); }
                         else { setActiveTab('perfil'); }
                       }}
                       style={{ cursor: "pointer", border: session ? '2px solid var(--color-success)' : 'none' }}>
                    <img alt="User" src={session ? "https://ui-avatars.com/api/?name=User&background=10b981&color=fff" : "https://ui-avatars.com/api/?name=MK&background=fc5a97&color=fff"} />
                  </div>
                </div>
            </div>

            {/* Input de Busca Otimizada */}
            <div style={{ display: "flex", width: "100%", height: "3rem", backgroundColor: "var(--bg-surface-highest)", borderRadius: "999px", padding: "0 1.25rem", alignItems: "center" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--text-on-surface-variant)", fontSize: "1.25rem", marginRight: "0.5rem" }}>search</span>
                <input 
                  type="text" 
                  placeholder="Procurar deputado pelo nome..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: "transparent", border: "none", outline: "none", width: "100%", fontSize: "0.875rem", fontFamily: "var(--font-body)", color: "var(--text-on-surface)" }}
                />
            </div>

            {/* Toggle Switcher Explorar vs Meus Políticos */}
            <div style={{ display: "flex", width: "100%", gap: "0.5rem" }}>
                <button 
                  onClick={() => setFeedMode('explorar')}
                  style={{ flex: 1, padding: "0.75rem", borderRadius: "999px", fontWeight: 700, fontSize: "0.75rem", border: "none", cursor: "pointer", transition: "0.2s",
                           backgroundColor: feedMode === 'explorar' ? "var(--color-primary-container)" : "var(--bg-surface-low)",
                           color: feedMode === 'explorar' ? "white" : "var(--text-on-surface-variant)"}}>
                    Explorar Todos
                </button>
                <button 
                  onClick={() => requireAuth(() => setFeedMode('seguindo'))}
                  style={{ flex: 1, padding: "0.75rem", borderRadius: "999px", fontWeight: 700, fontSize: "0.75rem", border: "none", cursor: "pointer", transition: "0.2s",
                           backgroundColor: feedMode === 'seguindo' ? "var(--color-primary-container)" : "var(--bg-surface-low)",
                           color: feedMode === 'seguindo' ? "white" : "var(--text-on-surface-variant)"}}>
                    Meus Políticos
                </button>
            </div>
          </header>

          <main className="main-content" style={{ marginTop: "12rem" }}>
            
            {loading && <p style={{textAlign: "center", marginTop: "2rem", fontWeight: 600}}>Buscando conectividade governamental...</p>}
            
            {!loading && deputies.length === 0 && feedMode === 'seguindo' && (
              <div style={{ textAlign: "center", marginTop: "3rem", color: "var(--text-on-surface-variant)" }}>
                 <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--outline-variant)" }}>person_add</span>
                 <p style={{ marginTop: "1rem", fontWeight: 600 }}>Sua lista está vazia</p>
                 <p style={{ fontSize: "0.875rem", padding: "0 2rem" }}>Busque por um deputado ativo na câmara e clique em Seguir para gerar gráficos.</p>
              </div>
            )}
            {!loading && deputies.length === 0 && feedMode === 'explorar' && (
              <p style={{textAlign: "center", marginTop: "2rem"}}>Vazio. Nenhum político encontrado ou Nuvem inacessível!</p>
            )}

            {/* Listagem Dinâmica e Botão SEGUIR */}
            {!loading && deputies.map((deputy) => {
              const isFollowing = following.includes(deputy.id);
              return (
              <section key={deputy.id} style={{ marginBottom: "2rem" }}>
                <div 
                  className="card profile-section" 
                  style={{ position: "relative", cursor: "pointer", transition: "transform 0.2s" }} 
                  onClick={() => setSelectedDeputyId(deputy.id)}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                   
                  <button 
                     onClick={(e) => { e.stopPropagation(); toggleFollow(deputy.id); }}
                     style={{ position: "absolute", top: "1rem", right: "1rem", 
                              background: isFollowing ? "var(--color-success-bg)" : "var(--bg-surface-high)", 
                              color: isFollowing ? "var(--color-success-text)" : "var(--text-on-surface-variant)", 
                              border: "none", padding: "0.5rem 1rem", borderRadius: "999px", fontWeight: 700, 
                              fontSize: "0.625rem", textTransform: "uppercase", cursor: "pointer", display: "flex", gap: "0.25rem", alignItems: "center", zIndex: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>{isFollowing ? "check" : "add"}</span>
                      {isFollowing ? "Seguindo" : "Seguir"}
                  </button>

                  <div className="profile-image-container">
                    <div className="profile-ring">
                      <div className="profile-image-inner">
                        <img 
                          alt={deputy.name}
                          src={deputy.avatar_url || "https://ui-avatars.com/api/?name=Avatar"} 
                        />
                      </div>
                      {radarDeputyIds.includes(Number(deputy.id)) && (
                        <div style={{ position: "absolute", top: "-5px", right: "-5px", background: "white", borderRadius: "50%", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", zIndex: 5 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#d32f2f", animation: "pulse 2s infinite" }}>notifications_active</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                    <h1 className="profile-name headline" style={{ marginBottom: "0.25rem" }}>{deputy.name}</h1>
                    <p className="profile-subtitle" style={{ margin: 0 }}>Partido {deputy.party} • {deputy.state}</p>
                    {deputy.ranking_score !== null && (
                      <div style={{ marginTop: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.4rem", backgroundColor: "var(--color-primary-container)", color: "white", padding: "0.4rem 0.8rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 800 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>trophy</span>
                        Nota Ranking: {deputy.ranking_score.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )})}

            {hasMore && !loading && deputies.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem", marginBottom: "3rem" }}>
                <button 
                  onClick={() => setPage(prev => prev + 1)}
                  style={{ backgroundColor: "var(--bg-surface-highest)", border: "1px solid var(--outline-variant)", color: "var(--color-primary-container)", padding: "1rem 2rem", borderRadius: "1rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <span className="material-symbols-outlined">expand_more</span>
                  Ver Mais Políticos
                </button>
              </div>
            )}
            
            {loading && page > 0 && (
                <p style={{ textAlign: "center", marginTop: "1rem", marginBottom: "3rem", fontSize: "0.875rem", fontWeight: 600 }}>Carregando próxima página...</p>
            )}

          </main>
        </>
      ) : activeTab === 'analitico' ? (
        <Dashboard following={following} />
      ) : activeTab === 'feed' ? (
        <NewsFeed 
          following={following} 
          session={session} 
          onSelectDeputy={(id) => setSelectedDeputyId(id)} 
        />
      ) : activeTab === 'perfil' && session ? (
        <UserProfile session={session} onSignOut={() => { supabase.auth.signOut(); setActiveTab('inicio'); }} />
      ) : null}
        </>
      )}

      {/* Bottom Nav Bar - Fixed class name mismatch */}
      <nav className="bottom-nav">
        <button 
          onClick={() => {
            setSelectedDeputyId(null);
            setActiveTab('inicio');
          }} 
          className={`nav-item ${activeTab === 'inicio' ? 'active' : ''}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'inicio' ? "'FILL' 1" : "'FILL' 0" }}>home</span>
          <span>Início</span>
        </button>
        <button 
          onClick={() => requireAuth(() => {
            setSelectedDeputyId(null);
            setActiveTab('feed');
          })} 
          className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'feed' ? "'FILL' 1" : "'FILL' 0" }}>rss_feed</span>
          <span>Feed</span>
        </button>
        <button 
          onClick={() => requireAuth(() => {
            setSelectedDeputyId(null);
            setActiveTab('analitico');
          })} 
          className={`nav-item ${activeTab === 'analitico' ? 'active' : ''}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'analitico' ? "'FILL' 1" : "'FILL' 0" }}>analytics</span>
          <span>Métricas</span>
        </button>
        <button 
          onClick={() => requireAuth(() => {
            setSelectedDeputyId(null);
            setActiveTab('perfil');
          })} 
          className={`nav-item ${activeTab === 'perfil' ? 'active' : ''}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'perfil' ? "'FILL' 1" : "'FILL' 0" }}>person</span>
          <span>Perfil</span>
        </button>
      </nav>
    </>
  );
}

export default App;
