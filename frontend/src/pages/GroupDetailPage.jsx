import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { groupsApi, membershipApi } from '../api';

function fmt(v) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(v);
}

export default function GroupDetailPage() {
  const { id } = useParams();
  const [group, setGroup]     = useState(null);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading]  = useState(true);
  const [tab, setTab]          = useState('members');

  // Add member form
  const [addUsername, setAddUsername] = useState('');
  const [addJoined, setAddJoined]     = useState('');
  const [addErr, setAddErr]           = useState('');
  const [addSaving, setAddSaving]     = useState(false);

  const load = () => {
    Promise.all([groupsApi.detail(id), groupsApi.balances(id)])
      .then(([g, b]) => { setGroup(g.data); setBalances(b.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const addMember = async (e) => {
    e.preventDefault();
    setAddErr(''); setAddSaving(true);
    try {
      // Get user by username — simplified: need to pass user ID in real flow
      // For now demonstrate the flow with a placeholder user lookup
      await membershipApi.create({ group: id, user: addUsername, joined_date: addJoined });
      setAddUsername(''); setAddJoined('');
      load();
    } catch (err) {
      setAddErr(err.response?.data?.user?.[0] || JSON.stringify(err.response?.data));
    } finally { setAddSaving(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width:40, height:40 }}/>
    </div>
  );

  if (!group) return <p style={{ color:'var(--danger)' }}>Group not found.</p>;

  const simplifiedDebts = balances?.simplified_debts || [];

  const TABS = ['members', 'balances', 'add member'];

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, fontSize: 13, color:'var(--text-muted)' }}>
        <Link to="/groups" style={{ color:'var(--text-muted)', textDecoration:'none' }}>Groups</Link>
        {' / '}
        <span style={{ color:'var(--text-primary)' }}>{group.name}</span>
      </div>

      {/* Hero */}
      <div className="card" style={{ padding: '28px 32px', marginBottom: 24, background:'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(6,182,212,0.06))' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background:'linear-gradient(135deg, var(--brand), var(--accent))',
            display:'flex', alignItems:'center', justifyContent:'center', fontWeight: 800, fontSize: 22, color:'#fff',
          }}>
            {group.name[0].toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>{group.name}</h1>
            <div style={{ fontSize: 13, color:'var(--text-muted)', marginTop: 2 }}>
              {group.memberships?.length} members · Created {new Date(group.created_at).toLocaleDateString('en-IN')}
            </div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap: 8 }}>
            <Link to={`/expenses?group=${id}`} className="btn btn-secondary btn-sm">View Expenses</Link>
            <Link to={`/import?group=${id}`} className="btn btn-primary btn-sm">Import CSV</Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap: 4, marginBottom: 20, borderBottom:'1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:'none', border:'none', cursor:'pointer', padding:'8px 16px',
            fontSize: 14, fontWeight: 600, color: tab === t ? 'var(--brand-light)' : 'var(--text-muted)',
            borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
            transition:'all var(--transition)', textTransform:'capitalize',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="card" style={{ overflow:'hidden', padding: 0 }}>
          <table className="tbl">
            <thead><tr><th>Member</th><th>Joined</th><th>Left</th><th>Status</th></tr></thead>
            <tbody>
              {group.memberships?.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg, var(--brand), var(--accent))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, color:'#fff' }}>
                        {m.user_detail?.username?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight:600 }}>{m.user_detail?.username}</span>
                    </div>
                  </td>
                  <td style={{ color:'var(--text-secondary)' }}>{m.joined_date || '—'}</td>
                  <td style={{ color:'var(--text-secondary)' }}>{m.left_date || '—'}</td>
                  <td>
                    <span className={`badge ${m.left_date ? 'badge-red' : 'badge-green'}`}>
                      {m.left_date ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Balances Tab */}
      {tab === 'balances' && (
        <div>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Net Balances</h3>
            {Object.entries(balances?.net_balances || {}).length === 0 ? (
              <p style={{ color:'var(--text-muted)' }}>No expenses yet.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
                {Object.entries(balances?.net_balances || {}).map(([uid, bal]) => {
                  const num = parseFloat(bal);
                  return (
                    <div key={uid} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:14, color:'var(--text-secondary)' }}>User {uid}</span>
                      <span style={{ fontWeight:700, color: num >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {num >= 0 ? '+' : ''}{fmt(num)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Simplified Settlement Plan</h3>
            {simplifiedDebts.length === 0 ? (
              <p style={{ color:'var(--text-muted)' }}>All settled up! 🎉</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
                {simplifiedDebts.map((d, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding:'12px 16px', background:'rgba(239,68,68,0.05)', borderRadius:'var(--radius-sm)', border:'1px solid rgba(239,68,68,0.12)' }}>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>User {d.from_user}</span>
                    <span style={{ color:'var(--danger)', fontWeight:600 }}>owes</span>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>User {d.to_user}</span>
                    <span style={{ marginLeft:'auto', fontWeight:700, color:'var(--warning)' }}>{fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Tab */}
      {tab === 'add member' && (
        <div className="card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Add Member</h3>
          <form onSubmit={addMember} style={{ display:'flex', flexDirection:'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">User ID</label>
              <input id="add-member-user" className="form-input" type="number" value={addUsername} onChange={e => setAddUsername(e.target.value)} placeholder="User ID (numeric)" required />
              <span className="form-error" style={{ fontSize:11, color:'var(--text-muted)' }}>Enter the user's numeric ID</span>
            </div>
            <div className="form-group">
              <label className="form-label">Joined Date</label>
              <input id="add-member-date" className="form-input" type="date" value={addJoined} onChange={e => setAddJoined(e.target.value)} required />
            </div>
            {addErr && <p className="form-error">{addErr}</p>}
            <button id="add-member-submit" className="btn btn-primary" type="submit" disabled={addSaving}>
              {addSaving ? <span className="spinner"/> : 'Add Member'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
