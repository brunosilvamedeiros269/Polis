import React from 'react';

interface PoliticianCardProps {
  deputy: any;
  isFollowing: boolean;
  isRadar: boolean;
  onToggleFollow: (id: number) => void;
  onClick: (id: number) => void;
}

const getPartyColor = (party: string) => {
  const colors: Record<string, string> = {
    'PT': '#b71c1c',
    'PL': '#0d47a1',
    'NOVO': '#ef6c00',
    'PSDB': '#1565c0',
    'MDB': '#2e7d32',
    'PSD': '#283593',
    'PP': '#0277bd',
    'UNIÃO': '#01579b',
    'REDE': '#00695c',
    'PSOL': '#c62828',
    'PV': '#1b5e20',
    'PDT': '#d32f2f',
    'PODEMOS': '#0277bd',
    'REPUBLICANOS': '#1565c0',
  };
  return colors[party?.toUpperCase()] || '#455a64'; // Default a blue-grey
};

export default function PoliticianCard({ deputy, isFollowing, isRadar, onToggleFollow, onClick }: PoliticianCardProps) {
  const partyColor = getPartyColor(deputy.party);
  
  // Lógica de Badges (Simplificada para o card)
  const badges = [];
  if (deputy.assiduidade && deputy.assiduidade > 90) badges.push({ text: 'Compromisso Total', icon: 'event_available', color: '#2e7d32' });
  if (deputy.economia_verba && deputy.economia_verba > 80) badges.push({ text: 'Gestão Eficiente', icon: 'account_balance_wallet', color: '#0277bd' });
  if (deputy.ranking_pos_nacional && deputy.ranking_pos_nacional > 0 && deputy.ranking_pos_nacional <= 50) badges.push({ text: 'Elite Legislativa', icon: 'workspace_premium', color: '#f57c00' });

  return (
    <article 
      className="card" 
      onClick={() => onClick(deputy.id)}
      style={{ 
        marginBottom: "1.5rem", 
        padding: "1.25rem", 
        cursor: "pointer", 
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        borderLeft: `6px solid ${partyColor}`,
        background: "white",
        position: "relative",
        overflow: "hidden"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px -10px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {/* Botão Seguir */}
      <button 
         onClick={(e) => { e.stopPropagation(); onToggleFollow(deputy.id); }}
         style={{ 
           position: "absolute", top: "1rem", right: "1rem", 
           background: isFollowing ? "var(--color-success-bg)" : "var(--bg-surface-high)", 
           color: isFollowing ? "var(--color-success-text)" : "var(--text-on-surface-variant)", 
           border: "none", padding: "0.5rem 1rem", borderRadius: "999px", fontWeight: 700, 
           fontSize: "0.625rem", textTransform: "uppercase", cursor: "pointer", display: "flex", gap: "0.25rem", alignItems: "center", zIndex: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{isFollowing ? "check" : "add"}</span>
          {isFollowing ? "Seguindo" : "Seguir"}
      </button>

      <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
        {/* Imagem e Ranking */}
        <div style={{ position: "relative" }}>
          <div style={{ 
            width: "4.5rem", height: "4.5rem", borderRadius: "16px", overflow: "hidden", 
            border: `3px solid ${partyColor}22`, boxShadow: "var(--shadow-sm)" 
          }}>
            <img 
              alt={deputy.name}
              src={deputy.avatar_url || "https://ui-avatars.com/api/?name=Avatar"} 
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          {isRadar && (
            <div style={{ position: "absolute", top: "-5px", right: "-5px", background: "#d32f2f", borderRadius: "50%", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", border: "2px solid white", zIndex: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "white", animation: "pulse 2s infinite" }}>notifications_active</span>
            </div>
          )}
          
          <div style={{ 
            marginTop: "0.5rem", textAlign: "center", background: "var(--bg-surface-low)", 
            borderRadius: "6px", padding: "2px 4px", border: "1px solid var(--outline-variant)",
            minWidth: "60px"
          }}>
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "var(--text-on-surface-variant)" }}>
              {deputy.ranking_pos_nacional && deputy.ranking_pos_nacional > 0 ? `#${deputy.ranking_pos_nacional} Nac.` : 'Sem Rank'}
            </span>
          </div>
        </div>

        {/* Informações Principais */}
        <div style={{ flexGrow: 1 }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <h3 className="headline" style={{ fontSize: "1.125rem", color: "var(--color-primary-container)", margin: 0 }}>{deputy.name}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <span style={{ 
                fontSize: "0.625rem", fontWeight: 900, backgroundColor: `${partyColor}15`, 
                color: partyColor, padding: "2px 8px", borderRadius: "4px", border: `1px solid ${partyColor}33` 
              }}>
                {deputy.party}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-on-surface-variant)", fontWeight: 600 }}>
                • {deputy.state}
              </span>
            </div>
          </div>

          {/* Badges de Performance */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.75rem" }}>
            {badges.map((b, i) => (
              <div key={i} style={{ 
                display: "flex", alignItems: "center", gap: "0.3rem", 
                backgroundColor: `${b.color}08`, color: b.color, 
                padding: "3px 8px", borderRadius: "6px", fontSize: "0.625rem", fontWeight: 800,
                border: `1px solid ${b.color}22`
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>{b.icon}</span>
                {b.text}
              </div>
            ))}
          </div>
          
          {/* Métricas Sintéticas */}
          <div style={{ 
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", 
            marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--outline-variant)" 
          }}>
             <div>
                <span style={{ fontSize: "0.625rem", color: "var(--text-on-surface-variant)", fontWeight: 700, textTransform: "uppercase", display: "block" }}>Nota Ranking</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 900, color: "var(--color-primary)" }}>{deputy.ranking_score?.toFixed(2) || '0.00'}</span>
             </div>
             <div>
                <span style={{ fontSize: "0.625rem", color: "var(--text-on-surface-variant)", fontWeight: 700, textTransform: "uppercase", display: "block" }}>Assiduidade</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 900, color: deputy.assiduidade > 80 ? "var(--color-success)" : "var(--color-primary)" }}>{deputy.assiduidade?.toFixed(1) || '0'}%</span>
             </div>
          </div>
        </div>
      </div>
    </article>
  );
}
