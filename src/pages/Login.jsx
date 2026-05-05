import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo-container" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="S4 Corporativo" style={{ width: '180px', height: 'auto', filter: 'drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.4))' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text2)', fontSize: '0.9rem', letterSpacing: '1px' }}>SISTEMA INTEGRAL DE GESTIÓN v2.0</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>CORREO ELECTRÓNICO</label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="admin@s4chile.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>CONTRASEÑA</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn-corp" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'INGRESANDO...' : 'INGRESAR AL SISTEMA'}
          </button>
        </form>

        <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.8 }}>
            🔒 Acceso restringido — Solo personal autorizado de Constructora S4
          </p>
        </div>
      </div>
    </div>
  );
}
