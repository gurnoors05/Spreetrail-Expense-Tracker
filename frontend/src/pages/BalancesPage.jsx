import { useEffect, useState } from 'react';
import { groupsApi } from '../api';

function fmt(v) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(v);
}

export default function BalancesPage() {
  const [groups, setGroups]      = useState([]);
  const [selected, setSelected]  = useState('');
  const [balances, setBalances]  = useState(null);
  const [loading,  setLoading]   = useState(false);
  const [gLoading, setGLoading]  = useState(true);

  useEffect(() => { groupsApi.list().then(r => setGroups(r.data)).finally(() => setGLoading(false)); }, []);

  const load = async (gid) => {
    setSelected(gid); setLoading(true); setBalances(null);
    try { const { data } = await groupsApi.balances(gid); setBalances(data); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const simplified = balances?.simplified_debts || [];
  const pairwise   = balances?.pairwise         || [];
  const net        = balances?.net_balances      || {};

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Balances</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
          View who owes whom across your groups, with automatic debt simplification.
        </p>
      </div>

      {/* Group Selector */}
      <div className="card" style={{ padding: 20, marginBottom: 28, display:'flex', gap: 12, alignItems:'flex-end' }}>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Select Group</label>
          <select id="balance-group-select" className="form-select" value={selected} onChange={e => load(e.target.value)} disabled={gLoading}>
            <option value="">— choose a group —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        {loading && <div className="spinner" style={{ marginBottom: 10 }}/>}
      </div>

      {/* Results */}
      {balances && !loading && (
        <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
          {/* Net Balances */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:18 }}>Net Balance per Member</h2>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
              {Object.entries(net).length === 0 ? (
                <p style={{ color:'var(--text-muted)' }}>No data.</p>
              ) : Object.entries(net).map(([uid, bal]) => {
                const n = parseFloat(bal);
                const isPos = n >= 0;
                return (
                  <div key={uid} className="card" style={{
                    padding:'16px 20px', minWidth:160, flex:1,
                    background: isPos ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${isPos ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, marginBottom:4 }}>User {uid}</div>
                    <div style={{ fontSize:22, fontWeight:800, color: isPos ? 'var(--success)' : 'var(--danger)' }}>
                      {isPos ? '+' : ''}{fmt(n)}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                      {isPos ? 'is owed' : 'owes'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simplified Debts */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>Settlement Plan</h2>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:18 }}>Minimum transactions to settle all debts (greedy algorithm).</p>
            {simplified.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'var(--success)', fontSize:15, fontWeight:600 }}>
                🎉 All settled up!
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {simplified.map((d, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'14px 18px',
                    background:'rgba(245,158,11,0.06)', borderRadius:'var(--radius-sm)',
                    border:'1px solid rgba(245,158,11,0.15)',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                      <span style={{
                        background:'rgba(239,68,68,0.15)', color:'var(--danger)', padding:'4px 10px',
                        borderRadius:'var(--radius-sm)', fontWeight:700, fontSize:13,
                      }}>User {d.from_user}</span>
                      <span style={{ color:'var(--text-muted)', fontSize:13 }}>→ pays →</span>
                      <span style={{
                        background:'rgba(16,185,129,0.15)', color:'var(--success)', padding:'4px 10px',
                        borderRadius:'var(--radius-sm)', fontWeight:700, fontSize:13,
                      }}>User {d.to_user}</span>
                    </div>
                    <span style={{ fontSize:18, fontWeight:800, color:'var(--warning)' }}>{fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pairwise */}
          {pairwise.length > 0 && (
            <div className="card" style={{ padding: 0, overflow:'hidden' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)' }}>
                <h2 style={{ fontSize:16, fontWeight:700 }}>Pairwise Balances</h2>
              </div>
              <table className="tbl">
                <thead><tr><th>From</th><th>To</th><th>Amount</th></tr></thead>
                <tbody>
                  {pairwise.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight:600, color:'var(--danger)' }}>User {p.from_user}</td>
                      <td style={{ fontWeight:600, color:'var(--success)' }}>User {p.to_user}</td>
                      <td style={{ fontWeight:700, color:'var(--warning)' }}>{fmt(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selected && !loading && (
        <div className="empty-state card" style={{ padding:60 }}>
          <h3>Select a group</h3>
          <p>Choose a group above to see balances and the settlement plan.</p>
        </div>
      )}
    </div>
  );
}
