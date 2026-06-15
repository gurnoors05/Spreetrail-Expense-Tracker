import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi, expensesApi } from '../api';
import { useAuth } from '../contexts/AuthContext';

function StatCard({ label, value, sub, color = 'var(--brand-light)' }) {
  return (
    <div className="card" style={{ padding: '24px 28px', flex: 1, minWidth: 180 }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function fmt(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [groups, setGroups]   = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([groupsApi.list(), expensesApi.list()])
      .then(([g, e]) => { setGroups(g.data); setExpenses(e.data); })
      .finally(() => setLoading(false));
  }, []);

  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const myExpenses = expenses.filter(e => e.paid_by === user?.id);
  const myTotal = myExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          Welcome back, <span className="gradient-text">{user?.username}</span> 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Here's an overview of your group finances.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="Total Groups"    value={loading ? '—' : groups.length} color="var(--brand-light)" />
        <StatCard label="Total Expenses"  value={loading ? '—' : expenses.length} color="var(--accent-light)" />
        <StatCard label="Group Spent"     value={loading ? '—' : fmt(totalSpent)} color="#6ee7b7" sub="all-time INR" />
        <StatCard label="Paid by You"     value={loading ? '—' : fmt(myTotal)} color="#fcd34d" sub="across all groups" />
      </div>

      {/* Recent Expenses */}
      <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Expenses</h2>
            <Link to="/expenses" className="btn btn-secondary btn-sm">View all</Link>
          </div>
          {loading ? (
            <div style={{ padding: 40, display:'flex', justifyContent:'center' }}><div className="spinner"/></div>
          ) : expenses.length === 0 ? (
            <div className="empty-state"><p>No expenses yet. Add your first!</p></div>
          ) : (
            <div className="table-responsive">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Description</th><th>Amount</th><th>Date</th><th>Split</th>
                </tr>
              </thead>
              <tbody>
                {expenses.slice(0, 8).map(exp => (
                  <tr key={exp.id}>
                    <td style={{ fontWeight: 500 }}>{exp.description}</td>
                    <td style={{ color: 'var(--brand-light)', fontWeight: 600 }}>{fmt(exp.amount)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{exp.date}</td>
                    <td><span className="badge badge-purple">{exp.split_type}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Groups sidebar */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>My Groups</h2>
            <Link to="/groups" className="btn btn-secondary btn-sm">Manage</Link>
          </div>
          {loading ? (
            <div style={{ padding: 40, display:'flex', justifyContent:'center' }}><div className="spinner"/></div>
          ) : groups.length === 0 ? (
            <div className="empty-state"><p>No groups yet.</p></div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {groups.map(g => (
                <Link key={g.id} to={`/groups/${g.id}`} style={{ textDecoration:'none' }}>
                  <div style={{
                    padding: '14px 24px', display:'flex', alignItems:'center', gap: 12,
                    transition:'background var(--transition)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg-glass-h)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--brand), var(--accent))',
                      display:'flex', alignItems:'center', justifyContent:'center', fontWeight: 700, fontSize: 14, color:'#fff',
                      flexShrink: 0,
                    }}>
                      {g.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.memberships?.length || 0} members</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
