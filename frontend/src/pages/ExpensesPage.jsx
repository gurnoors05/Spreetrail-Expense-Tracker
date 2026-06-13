import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { expensesApi, groupsApi } from '../api';
import { useAuth } from '../contexts/AuthContext';

function fmt(v) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(v);
}

const SPLIT_TYPES = ['equal', 'unequal', 'percentage', 'share'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const { user }                = useAuth();
  const [searchParams]          = useSearchParams();

  const [form, setForm] = useState({
    group: searchParams.get('group') || '',
    description: '', date: '', paid_by: user?.id || '',
    amount: '', original_amount: '', original_currency: 'INR',
    split_type: 'equal', notes: '',
    split_details: [{ user: '', value: '' }],
  });

  const load = () => {
    const params = searchParams.get('group') ? { group: searchParams.get('group') } : {};
    Promise.all([expensesApi.list(params), groupsApi.list()])
      .then(([e, g]) => { setExpenses(e.data); setGroups(g.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateSplit = (i, k, v) => setForm(f => {
    const sd = [...f.split_details];
    sd[i] = { ...sd[i], [k]: v };
    return { ...f, split_details: sd };
  });
  const addSplitRow    = () => setForm(f => ({ ...f, split_details: [...f.split_details, { user:'', value:'' }] }));
  const removeSplitRow = (i) => setForm(f => ({ ...f, split_details: f.split_details.filter((_, j) => j !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        original_amount: parseFloat(form.original_amount || form.amount),
        split_details: form.split_details.map(sd => ({
          user: parseInt(sd.user),
          ...(form.split_type !== 'equal' ? { value: parseFloat(sd.value) } : {}),
        })),
      };
      await expensesApi.create(payload);
      setShowForm(false);
      load();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.split_details || d?.amount || d?.non_field_errors || JSON.stringify(d));
    } finally { setSaving(false); }
  };

  const BADGE_MAP = { equal:'badge-purple', unequal:'badge-teal', percentage:'badge-yellow', share:'badge-green' };

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Expenses</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>Track and split your group expenses.</p>
        </div>
        <button id="add-expense-btn" className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ Add Expense'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card" style={{ padding: 28, marginBottom: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>New Expense</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap: 16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Group</label>
                <select id="exp-group" className="form-select" value={form.group} onChange={e => updateField('group', e.target.value)} required>
                  <option value="">Select a group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input id="exp-date" className="form-input" type="date" value={form.date} onChange={e => updateField('date', e.target.value)} required />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Description</label>
                <input id="exp-desc" className="form-input" value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="e.g. February Rent" required />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (INR)</label>
                <input id="exp-amount" className="form-input" type="number" min="0.01" step="0.01" value={form.amount} onChange={e => updateField('amount', e.target.value)} placeholder="0.00" required />
              </div>
              <div className="form-group">
                <label className="form-label">Split Type</label>
                <select id="exp-split-type" className="form-select" value={form.split_type} onChange={e => updateField('split_type', e.target.value)}>
                  {SPLIT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Paid By (User ID)</label>
                <input id="exp-paid-by" className="form-input" type="number" value={form.paid_by} onChange={e => updateField('paid_by', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input id="exp-notes" className="form-input" value={form.notes} onChange={e => updateField('notes', e.target.value)} placeholder="Optional" />
              </div>
            </div>

            {/* Split Details */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
                <span className="form-label">Split Members</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addSplitRow}>+ Add Row</button>
              </div>
              {form.split_details.map((sd, i) => (
                <div key={i} style={{ display:'flex', gap: 10, marginBottom: 8, alignItems:'center' }}>
                  <input className="form-input" type="number" placeholder="User ID" value={sd.user} onChange={e => updateSplit(i, 'user', e.target.value)} style={{ flex:1 }} />
                  {form.split_type !== 'equal' && (
                    <input className="form-input" type="number" step="0.01"
                      placeholder={form.split_type === 'percentage' ? '%' : form.split_type === 'share' ? 'shares' : 'amount'}
                      value={sd.value} onChange={e => updateSplit(i, 'value', e.target.value)} style={{ flex:1 }} />
                  )}
                  {form.split_details.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeSplitRow(i)}>✕</button>
                  )}
                </div>
              ))}
            </div>

            {error && <p className="form-error">{typeof error === 'object' ? JSON.stringify(error) : error}</p>}
            <button id="exp-submit" className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf:'flex-start', minWidth:120 }}>
              {saving ? <span className="spinner"/> : 'Save Expense'}
            </button>
          </form>
        </div>
      )}

      {/* Expenses Table */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="spinner" style={{ width:36, height:36 }}/></div>
      ) : expenses.length === 0 ? (
        <div className="empty-state card" style={{ padding:60 }}>
          <h3>No expenses yet</h3>
          <p>Add your first group expense to get started.</p>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Description</th><th>Amount</th><th>Date</th><th>Split</th><th>Splits</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id}>
                  <td style={{ fontWeight:600 }}>{exp.description}</td>
                  <td style={{ color:'var(--brand-light)', fontWeight:700 }}>{fmt(exp.amount)}</td>
                  <td style={{ color:'var(--text-muted)' }}>{exp.date}</td>
                  <td><span className={`badge ${BADGE_MAP[exp.split_type] || 'badge-purple'}`}>{exp.split_type}</span></td>
                  <td style={{ color:'var(--text-muted)', fontSize:12 }}>
                    {exp.splits?.length || 0} member{exp.splits?.length !== 1 ? 's' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
