import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ username: '', password: '' });
  const [error, setError]  = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 60% 0%, rgba(139,92,246,0.12) 0%, var(--bg-base) 60%)',
      padding: 24,
    }}>
      {/* Decorative orbs */}
      <div style={{ position:'fixed', top:-120, right:-80, width:400, height:400, background:'rgba(139,92,246,0.08)', borderRadius:'50%', filter:'blur(80px)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', bottom:-80, left:40, width:280, height:280, background:'rgba(6,182,212,0.07)', borderRadius:'50%', filter:'blur(60px)', pointerEvents:'none' }}/>

      <div className="card page-enter" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div className="gradient-text" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>SpreeTrail</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sign in to your account</div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input id="login-username" className="form-input" name="username" value={form.username} onChange={handle} placeholder="your_username" autoComplete="username" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="login-password" className="form-input" name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" autoComplete="current-password" required />
          </div>

          {error && <p className="form-error" style={{ textAlign:'center' }}>{error}</p>}

          <button id="login-submit" className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <span className="spinner"/> : 'Sign In'}
          </button>
        </form>

        <hr className="divider" />
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--brand-light)', fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
