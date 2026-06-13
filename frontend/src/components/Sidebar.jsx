import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { to: '/dashboard',  icon: '⬡', label: 'Dashboard'  },
  { to: '/groups',     icon: '◈', label: 'Groups'      },
  { to: '/expenses',   icon: '⊕', label: 'Expenses'    },
  { to: '/import',     icon: '⤒', label: 'Import CSV'  },
  { to: '/balances',   icon: '⇌', label: 'Balances'    },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      padding: '24px 0', position: 'fixed', top: 0, left: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 24px 28px' }}>
        <div className="gradient-text" style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
          SpreeTrail
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Expense Tracker</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 12px' }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 'var(--radius-sm)', marginBottom: 2, textDecoration: 'none',
            fontSize: 14, fontWeight: 500, transition: 'all var(--transition)',
            background: isActive ? 'rgba(139,92,246,0.15)' : 'transparent',
            color: isActive ? 'var(--brand-light)' : 'var(--text-secondary)',
            borderLeft: isActive ? '2px solid var(--brand)' : '2px solid transparent',
          })}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          {user?.username}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{user?.email}</div>
        <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ width: '100%' }}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
