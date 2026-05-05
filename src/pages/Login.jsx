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
        <div className="login-logo">
          <div className="login-icon">🏗️</div>
          <h1>Constructora S4</h1>
          <p>Sistema integral de gestión de obras · v2.0</p>
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

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar al sistema →'}
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
