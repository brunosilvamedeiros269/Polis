import { useState } from 'react';
import { supabase } from '../supabaseClient';

interface LoginScreenProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function LoginScreen({ onClose, onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          onSuccess();
        } else {
          setErrorMsg('Confirme o cadastro no link enviado para seu email.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      <div style={{ 
        width: "100%", 
        backgroundColor: "var(--bg-surface-lowest)", 
        borderTopLeftRadius: "2rem", 
        borderTopRightRadius: "2rem", 
        padding: "2rem", 
        boxShadow: "0 -10px 40px rgba(0,0,0,0.1)",
        animation: "slideUp 0.3s ease-out forwards"
      }}>
        
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h2 className="headline" style={{ fontSize: "1.5rem", color: "var(--color-primary-container)" }}>
              {isSignUp ? 'Criar Conta' : 'Acesse sua Conta'}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-on-surface-variant)", marginTop: "0.25rem" }}>
              Para salvar seus deputados e acessar o Feed.
            </p>
          </div>
          <button onClick={onClose} className="icon-btn" style={{ backgroundColor: "var(--bg-surface-highest)" }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", padding: "1rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem" }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "1rem", borderRadius: "1rem", border: "1px solid var(--outline-variant)", backgroundColor: "var(--bg-surface-low)", fontSize: "1rem", boxSizing: "border-box" }}
              placeholder="seu@email.com"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>Senha</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "1rem", borderRadius: "1rem", border: "1px solid var(--outline-variant)", backgroundColor: "var(--bg-surface-low)", fontSize: "1rem", boxSizing: "border-box" }}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: "100%", padding: "1rem", borderRadius: "1rem", backgroundColor: "var(--color-primary-container)", color: "white", fontSize: "1rem", fontWeight: 700, border: "none", cursor: loading ? "wait" : "pointer", marginTop: "1rem" }}
          >
            {loading ? 'Carregando...' : (isSignUp ? 'Finalizar Cadastro' : 'Entrar no App')}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <button 
            type="button" 
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}
            style={{ background: "none", border: "none", color: "var(--color-secondary)", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
          >
            {isSignUp ? 'Já tem uma conta? Faça Login' : 'Ainda não tem conta? Cadastre-se grátis'}
          </button>
        </div>
      </div>
    </div>
  );
}
