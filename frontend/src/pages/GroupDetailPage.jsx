import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { groupsApi, membershipApi, usersApi } from '../api';

function fmt(v) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(v);
}

// ── Username search dropdown ─────────────────────────────
function UserSelect({ allUsers, value, onChange, existingIds = [] }) {
  const [query, setQuery] = useState('');
  const [open,  setOpen]  = useState(false);

  const filtered = allUsers.filter(u =>
    !existingIds.includes(u.id) &&
    (u.username.toLowerCase().includes(query.toLowerCase()) ||
     u.email?.toLowerCase().includes(query.toLowerCase()))
  );
  const selected = allUsers.find(u => u.id === value);

  return (
    <div style={{ position: 'relative' }}>
      <div
        id="add-member-user"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 14,
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          transition: 'border-color var(--transition)',
          ...(open ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 3px rgba(139,92,246,0.15)' } : {}),
        }}
      >
        <span>
          {selected
            ? <><strong>{selected.username}</strong>{selected.email ? ` — ${selected.email}` : ''}</>
            : 'Search by username or email…'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-surface)', border: '1px solid var(--border-h)',
          borderRadius: 'var(--radius-sm)', marginTop: 4,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              className="form-input"
              style={{ fontSize: 13, padding: '7px 10px' }}
              placeholder="Type to filter…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                No users found
              </div>
            ) : filtered.map(u => (
              <div
                key={u.id}
                onClick={() => { onChange(u.id); setOpen(false); setQuery(''); }}
                style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background var(--transition)',
                  background: u.id === value ? 'rgba(139,92,246,0.12)' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-h)'}
                onMouseLeave={e => e.currentTarget.style.background = u.id === value ? 'rgba(139,92,246,0.12)' : 'transparent'}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand), var(--accent))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0,
                }}>
                  {u.username[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.username}</div>
                  {u.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>}
                </div>
                {u.id === value && <span style={{ marginLeft: 'auto', color: 'var(--brand-light)' }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────
export default function GroupDetailPage() {
  const { id } = useParams();
  const [group,       setGroup]       = useState(null);
  const [balances,    setBalances]    = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [allUsers,    setAllUsers]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('members');

  // Add member form
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [addJoined,      setAddJoined]      = useState('');   // intentionally empty — user must pick
  const [addErr,         setAddErr]         = useState('');
  const [addSaving,      setAddSaving]      = useState(false);
  const [addSuccess,     setAddSuccess]     = useState('');

  // Inline edit state
  const [editingId,    setEditingId]    = useState(null);  // membership id being edited
  const [editJoined,   setEditJoined]   = useState('');
  const [editLeft,     setEditLeft]     = useState('');
  const [editSaving,   setEditSaving]   = useState(false);
  const [editErr,      setEditErr]      = useState('');

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditJoined(m.joined_date || '');
    setEditLeft(m.left_date || '');
    setEditErr('');
  };
  const cancelEdit = () => { setEditingId(null); setEditErr(''); };

  const saveEdit = async (membershipId) => {
    setEditSaving(true); setEditErr('');
    try {
      await membershipApi.update(membershipId, {
        joined_date: editJoined || null,
        left_date:   editLeft   || null,
      });
      setEditingId(null);
      load();
    } catch (err) {
      const d = err.response?.data;
      setEditErr(d?.joined_date?.[0] || d?.left_date?.[0] || d?.non_field_errors?.[0] || JSON.stringify(d));
    } finally { setEditSaving(false); }
  };

  const load = () => {
    Promise.all([
      groupsApi.detail(id), 
      groupsApi.balances(id), 
      import('../api').then(m => m.settlementsApi.list(id))
    ])
      .then(([g, b, s]) => { setGroup(g.data); setBalances(b.data); setSettlements(s.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    usersApi.list().then(r => setAllUsers(r.data));
  }, [id]);

  // IDs already in this group
  const existingMemberIds = group?.memberships?.map(m => m.user) || [];

  const addMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) { setAddErr('Please select a user.'); return; }
    setAddErr(''); setAddSuccess(''); setAddSaving(true);
    try {
      await membershipApi.create({ group: id, user: selectedUserId, joined_date: addJoined });
      const addedUser = allUsers.find(u => u.id === selectedUserId);
      setAddSuccess(`${addedUser?.username} added to the group!`);
      setSelectedUserId(null);
      setAddJoined('');
      load();
    } catch (err) {
      const d = err.response?.data;
      setAddErr(d?.user?.[0] || d?.non_field_errors?.[0] || JSON.stringify(d));
    } finally { setAddSaving(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 40, height: 40 }}/>
    </div>
  );

  if (!group) return <p style={{ color: 'var(--danger)' }}>Group not found.</p>;

  const simplifiedDebts = balances?.simplified_debts || [];
  const TABS = ['members', 'balances', 'settlements', 'add member'];

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        <Link to="/groups" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Groups</Link>
        {' / '}
        <span style={{ color: 'var(--text-primary)' }}>{group.name}</span>
      </div>

      {/* Hero */}
      <div className="card" style={{ padding: '28px 32px', marginBottom: 24, background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(6,182,212,0.06))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, var(--brand), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: '#fff',
          }}>
            {group.name[0].toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>{group.name}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {group.memberships?.length} members · Created {new Date(group.created_at).toLocaleDateString('en-IN')}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Link to={`/expenses?group=${id}`} className="btn btn-secondary btn-sm">View Expenses</Link>
            <Link to={`/import?group=${id}`} className="btn btn-primary btn-sm">Import CSV</Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
            fontSize: 14, fontWeight: 600,
            color: tab === t ? 'var(--brand-light)' : 'var(--text-muted)',
            borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
            transition: 'all var(--transition)', textTransform: 'capitalize',
          }}>
            {t}{t === 'add member' && ' +'}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th><th>Joined</th><th>Left</th><th>Status</th>
                <th style={{ width: 80, textAlign: 'right' }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {group.memberships?.map(m => (
                editingId === m.id ? (
                  // ── Inline edit row ──────────────────────────────
                  <tr key={m.id} style={{ background: 'rgba(139,92,246,0.06)' }}>
                    <td colSpan={5} style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                        {/* Avatar + name (read-only) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff' }}>
                            {m.user_detail?.username?.[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{m.user_detail?.username}</span>
                        </div>
                        {/* Joined date */}
                        <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                          <label className="form-label">Joined Date</label>
                          <input
                            id={`edit-joined-${m.id}`}
                            className="form-input"
                            type="date"
                            value={editJoined}
                            onChange={e => setEditJoined(e.target.value)}
                            required
                          />
                        </div>
                        {/* Left date */}
                        <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                          <label className="form-label">Left Date <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(blank = still active)</span></label>
                          <input
                            id={`edit-left-${m.id}`}
                            className="form-input"
                            type="date"
                            value={editLeft}
                            onChange={e => setEditLeft(e.target.value)}
                            min={editJoined || undefined}
                          />
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
                          <button
                            id={`save-edit-${m.id}`}
                            className="btn btn-primary btn-sm"
                            onClick={() => saveEdit(m.id)}
                            disabled={editSaving || !editJoined}
                          >
                            {editSaving ? <span className="spinner"/> : '✓ Save'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                      {editErr && <p className="form-error" style={{ marginTop: 8 }}>⚠ {editErr}</p>}
                    </td>
                  </tr>
                ) : (
                  // ── Normal read row ──────────────────────────────
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>
                          {m.user_detail?.username?.[0]?.toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{m.user_detail?.username}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{m.joined_date || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{m.left_date || '—'}</td>
                    <td>
                      <span className={`badge ${m.left_date ? 'badge-red' : 'badge-green'}`}>
                        {m.left_date ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        id={`edit-member-${m.id}`}
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(m)}
                        title="Edit dates"
                      >
                        ✎ Edit
                      </button>
                    </td>
                  </tr>
                )
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
              <p style={{ color: 'var(--text-muted)' }}>No expenses yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(balances?.net_balances || {}).map(([uid, bal]) => {
                  const num = parseFloat(bal);
                  // Resolve username from allUsers
                  const uname = allUsers.find(u => u.id === parseInt(uid))?.username || `User ${uid}`;
                  return (
                    <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff' }}>
                          {uname[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{uname}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: num >= 0 ? 'var(--success)' : 'var(--danger)' }}>
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
              <p style={{ color: 'var(--text-muted)' }}>All settled up! 🎉</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {simplifiedDebts.map((d, i) => {
                  const fromName = allUsers.find(u => u.id === d.from_user)?.username || `User ${d.from_user}`;
                  const toName   = allUsers.find(u => u.id === d.to_user)?.username   || `User ${d.to_user}`;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(239,68,68,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.12)' }}>
                      <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13 }}>{fromName}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→ pays →</span>
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13 }}>{toName}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--warning)' }}>{fmt(d.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settlements Tab */}
      {tab === 'settlements' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Paid By</th><th>Paid To</th><th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No settlements recorded yet.
                  </td>
                </tr>
              ) : settlements.map(s => {
                const fromName = allUsers.find(u => u.id === s.paid_by)?.username || `User ${s.paid_by}`;
                const toName   = allUsers.find(u => u.id === s.paid_to)?.username || `User ${s.paid_to}`;
                return (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.date}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-glass-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--brand-light)' }}>
                          {fromName[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{fromName}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-glass-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>
                          {toName[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{toName}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--warning)' }}>
                      {fmt(s.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Member Tab */}
      {tab === 'add member' && (
        <div className="card" style={{ padding: 28, maxWidth: 480 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Add Member</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Select a registered user and their join date.
          </p>
          <form onSubmit={addMember} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">User</label>
              <UserSelect
                allUsers={allUsers}
                value={selectedUserId}
                onChange={setSelectedUserId}
                existingIds={existingMemberIds}
              />
              {selectedUserId && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Selected:</span>
                  <span className="badge badge-purple">{allUsers.find(u => u.id === selectedUserId)?.username}</span>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }} onClick={() => setSelectedUserId(null)}>✕ clear</button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Joined Date</label>
              <input
                id="add-member-date"
                className="form-input"
                type="date"
                value={addJoined}
                onChange={e => setAddJoined(e.target.value)}
                required
              />
            </div>
            {addErr     && <p className="form-error">⚠ {addErr}</p>}
            {addSuccess && <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ {addSuccess}</p>}
            <button
              id="add-member-submit"
              className="btn btn-primary"
              type="submit"
              disabled={addSaving || !selectedUserId}
              style={{ alignSelf: 'flex-start', minWidth: 130 }}
            >
              {addSaving ? <span className="spinner"/> : 'Add Member'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
