import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface NotificationInboxProps {
  session: any;
  onClose: () => void;
  onSelectDeputy: (id: number) => void;
}

export default function NotificationInbox({ session, onClose, onSelectDeputy }: NotificationInboxProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifs() {
      const { data } = await supabase
        .from('notifications')
        .select(`*, deputies(name, avatar_url)`)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(30);
        
      if (data) setNotifications(data);
      setLoading(false);
    }
    fetchNotifs();
  }, [session.user.id]);

  const markAsReadAndGo = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    }
    if (notif.deputy_id) {
      onSelectDeputy(Number(notif.deputy_id));
    }
    onClose();
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false);
  }

  return (
    <div style={{ position: "absolute", top: 0, right: 0, width: "100%", maxWidth: "400px", background: "var(--bg-surface-lowest)", minHeight: "100vh", zIndex: 100, boxShadow: "-4px 0 15px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1.5rem", borderBottom: "1px solid var(--outline-variant)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-background)" }}>
        <h2 className="headline" style={{ fontSize: "1.25rem", margin: 0 }}>Radares (Alertas)</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={markAllRead} style={{ background: "transparent", border: "none", color: "var(--color-primary-container)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>Marcar Lido</button>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-on-surface)", cursor: "pointer", display: "flex" }}>
               <span className="material-symbols-outlined">close</span>
            </button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {loading ? (
          <p style={{ textAlign: "center", marginTop: "2rem", color: "var(--text-on-surface-variant)" }}>Procurando no radar...</p>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "4rem", color: "var(--text-on-surface-variant)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--outline-variant)" }}>notifications_paused</span>
            <p style={{ marginTop: "1rem", fontWeight: 600 }}>Tudo Limpo!</p>
            <p style={{ fontSize: "0.875rem" }}>Nenhuma atividade suspeita de seus políticos nos radares.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => markAsReadAndGo(n)}
                style={{ 
                  background: n.is_read ? "transparent" : "var(--bg-surface-high)", 
                  padding: "1rem", borderRadius: "12px", cursor: "pointer", 
                  borderLeft: n.is_read ? "none" : "4px solid var(--color-primary)",
                  display: "flex", gap: "1rem", alignItems: "flex-start",
                  border: n.is_read ? "1px solid var(--outline-variant)" : "none"
                }}
              >
                <img 
                  src={n.deputies?.avatar_url || 'https://via.placeholder.com/40'} 
                  alt="avatar" 
                  style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} 
                />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: n.is_read ? 600 : 800, color: "var(--text-on-surface)" }}>{n.title}</h4>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.75rem", color: "var(--text-on-surface-variant)" }}>{n.message}</p>
                  <span style={{ fontSize: "0.625rem", color: "var(--color-primary-container)", fontWeight: 700 }}>
                    {new Date(n.created_at).toLocaleDateString('pt-BR')} • {n.deputies?.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
