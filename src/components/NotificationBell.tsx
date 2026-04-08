import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

interface NotificationBellProps {
  userId: string;
  onSelectDeputy?: (id: number) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, onSelectDeputy }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    
    // Subscribe to new notifications
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAsRead = async () => {
    if (unreadCount === 0) return;
    
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      markAsRead();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="notification-bell-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={dropdownRef}>
      <button 
        className="bell-button" 
        onClick={toggleDropdown}
        style={{ 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer', 
          color: 'inherit',
          position: 'relative',
          padding: '8px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>notifications</span>
        {unreadCount > 0 && (
          <span className="badge" style={{ 
            position: 'absolute', 
            top: '4px', 
            right: '4px', 
            background: 'var(--color-error, #ff1744)', 
            color: 'white', 
            borderRadius: '50%', 
            width: '18px', 
            height: '18px', 
            fontSize: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontWeight: 800,
            border: '2px solid var(--bg-surface, #fff)'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown" style={{ 
          position: 'absolute', 
          top: '100%', 
          right: 0, 
          width: '320px', 
          background: 'white', 
          borderRadius: '16px', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          zIndex: 1000,
          marginTop: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.05)'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900 }}>Notificações</h3>
            <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Recentes</span>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', opacity: 0.5 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px' }}>notifications_off</span>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>Nada por aqui ainda.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button 
                  key={n.id} 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔔 Botão de Notificação clicado:', n);
                    if (n.deputy_id && onSelectDeputy) {
                      const id = Number(n.deputy_id);
                      console.log('🚀 Encaminhando para ID:', id);
                      onSelectDeputy(id);
                      setIsOpen(false);
                    } else {
                      console.warn('⚠️ Falha ao encontrar deputy_id na notificação:', n);
                    }
                  }}
                  style={{ 
                    width: '100%',
                    textAlign: 'left',
                    background: n.is_read ? 'transparent' : 'rgba(26, 115, 232, 0.03)',
                    border: 'none',
                    borderBottom: '1px solid #f0f0f0', 
                    padding: '16px', 
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    display: 'block',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(26, 115, 232, 0.03)'}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px', color: 'var(--text-on-surface)' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '8px' }}>
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </div>
                </button>
              ))
            )}
          </div>
          
          {notifications.length > 0 && (
            <div style={{ padding: '12px', textAlign: 'center', background: '#fcfcfc', borderTop: '1px solid #f0f0f0' }}>
              <button 
                style={{ background: 'none', border: 'none', color: 'var(--color-primary, #1a73e8)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setIsOpen(false)}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
