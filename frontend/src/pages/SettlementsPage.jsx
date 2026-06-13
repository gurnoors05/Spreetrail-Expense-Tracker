import { useEffect, useState } from 'react';
import { groupsApi, settlementsApi, usersApi } from '../api';

function fmt(v) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(v);
}

export default function SettlementsPage() {
  const [groups, setGroups]      = useState([]);
  const [users, setUsers]        = useState([]);
  const [selected, setSelected]  = useState('');
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading]    = useState(false);
  const [gLoading, setGLoading]  = useState(true);

  useEffect(() => {
    groupsApi.list().then(r => setGroups(r.data)).finally(() => setGLoading(false));
    usersApi.list().then(r => setUsers(r.data)).catch(console.error);
  }, []);

  const getUserName = (id) => {
    const user = users.find(u => u.id === parseInt(id));
    return user ? user.username : `User ${id}`;
  };

  const load = async (gid) => {
    setSelected(gid); setLoading(true); setSettlements([]);
    try {
      const { data } = await settlementsApi.list(gid);
      setSettlements(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Settlements</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
          View all manual and imported settlements to track direct payments.
        </p>
      </div>

      {/* Group Selector */}
      <div className="card" style={{ padding: 20, marginBottom: 28, display:'flex', gap: 12, alignItems:'flex-end' }}>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Select Group</label>
          <select id="settlement-group-select" className="form-select" value={selected} onChange={e => load(e.target.value)} disabled={gLoading}>
            <option value="">— choose a group —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        {loading && <div className="spinner" style={{ marginBottom: 10 }}/>}
      </div>

      {selected && !loading && (
        <div className="card" style={{ padding: 0, overflow:'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Paid By</th><th>Paid To</th><th>Notes / Source</th><th style={{ textAlign:'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
                    No settlements recorded yet.
                  </td>
                </tr>
              ) : settlements.map(s => {
                const fromName = getUserName(s.paid_by);
                const toName = getUserName(s.paid_to);
                return (
                  <tr key={s.id}>
                    <td style={{ color:'var(--text-secondary)' }}>{s.date}</td>
                    <td style={{ fontWeight:600, textTransform:'capitalize' }}>{fromName}</td>
                    <td style={{ fontWeight:600, textTransform:'capitalize' }}>{toName}</td>
                    <td style={{ color:'var(--text-muted)', fontSize:13 }}>{s.note || 'Manual Settlement'}</td>
                    <td style={{ textAlign:'right', fontWeight:800, color:'var(--warning)' }}>{fmt(s.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {!selected && !loading && (
        <div className="empty-state card" style={{ padding:60 }}>
          <h3>Select a group</h3>
          <p>Choose a group above to see its settlements.</p>
        </div>
      )}
    </div>
  );
}
