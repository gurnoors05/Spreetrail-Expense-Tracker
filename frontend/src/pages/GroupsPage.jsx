import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi, membershipApi } from '../api';

export default function GroupsPage() {
  const [groups, setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName]      = useState('');
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState('');

  const load = () => groupsApi.list().then(r => setGroups(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await groupsApi.create({ name });
      setName(''); setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.name?.[0] || 'Failed to create group.');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Groups</h1>
          <p style={{ color:'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Manage your shared expense groups.</p>
        </div>
        <button id="create-group-btn" className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>
          {showCreate ? '✕ Cancel' : '+ New Group'}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <form onSubmit={create} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            <div style={{ display:'flex', gap: 12, alignItems:'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Group Name</label>
                <input
                  id="group-name-input"
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Goa Trip 2026"
                  required
                />
              </div>
              <button id="group-create-submit" className="btn btn-primary" type="submit" disabled={saving} style={{ height: 42, minWidth: 90 }}>
                {saving ? <span className="spinner"/> : 'Create'}
              </button>
            </div>
            {error && (
              <p className="form-error" style={{ marginTop: 4 }}>⚠ {error}</p>
            )}
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding: 60 }}><div className="spinner" style={{ width:36, height:36 }}/></div>
      ) : groups.length === 0 ? (
        <div className="empty-state card" style={{ padding: 60 }}>
          <h3>No groups yet</h3>
          <p>Create your first group to start tracking expenses.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
          {groups.map(g => (
            <Link key={g.id} to={`/groups/${g.id}`} style={{ textDecoration:'none' }}>
              <div className="card" style={{ padding: '20px 24px', display:'flex', alignItems:'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--brand), var(--accent))',
                  display:'flex', alignItems:'center', justifyContent:'center', fontWeight: 800, fontSize: 18, color:'#fff', flexShrink:0,
                }}>
                  {g.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{g.name}</div>
                  <div style={{ fontSize: 13, color:'var(--text-muted)', marginTop: 2 }}>
                    {g.memberships?.length || 0} member{g.memberships?.length !== 1 ? 's' : ''}
                    {' · '}Created {new Date(g.created_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
                  {g.memberships?.slice(0,4).map(m => (
                    <div key={m.id} title={m.user_detail?.username} style={{
                      width: 30, height: 30, borderRadius: '50%', background:'var(--bg-glass-h)',
                      border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize: 12, fontWeight: 700, color:'var(--brand-light)',
                    }}>
                      {m.user_detail?.username?.[0]?.toUpperCase()}
                    </div>
                  ))}
                </div>
                <span style={{ color:'var(--text-muted)', fontSize: 20 }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
