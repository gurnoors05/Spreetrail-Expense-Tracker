import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ username: '', email: '', password: '' });
  const [error, setError]  = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      const d = err.response?.data;
      setError(d?.username?.[0] || d?.email?.[0] || d?.password?.[0] || 'Registration failed.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 40% 0%, rgba(6,182,212,0.10) 0%, var(--bg-base) 60%)',
      padding: 24,
    }}>
      <div style={{ position:'fixed', top:-100, left:-60, width:360, height:360, background:'rgba(139,92,246,0.08)', borderRadius:'50%', filter:'blur(80px)', pointerEvents:'none' }}/>

      <div className="card page-enter" style={{ width: '100%', maxWidth: 440, padding: 40 }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div className="gradient-text" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Create Account</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Join your group on SpreeTrail</div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input id="reg-username" className="form-input" name="username" value={form.username} onChange={handle} placeholder="aisha_khan" required />
          </div>
          <div className="form-group">
            <label className="form-label">Email <span style={{color:'var(--text-muted)'}}>(optional)</span></label>
            <input id="reg-email" className="form-input" name="email" type="email" value={form.email} onChange={handle} placeholder="aisha@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="reg-password" className="form-input" name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" required />
          </div>

          {error && <p className="form-error" style={{ textAlign:'center' }}>{error}</p>}

          <button id="reg-submit" className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <span className="spinner"/> : 'Create Account'}
          </button>
        </form>

        <hr className="divider" />
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--brand-light)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
