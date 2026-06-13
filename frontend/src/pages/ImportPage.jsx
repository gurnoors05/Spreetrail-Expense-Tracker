import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { importApi, anomaliesApi, usersApi } from '../api';

function AnomalyCard({ anomaly, onResolve, allUsers }) {
  const [saving, setSaving]   = useState(false);
  const [resData, setResData] = useState({});
  const [actionLabel, setActionLabel] = useState('');

  const STATUS_COLOR = {
    pending:    ['badge-yellow', '⏳'],
    resolved:   ['badge-green',  '✓'],
    auto_applied:['badge-teal',  '⚡'],
  };
  const [badgeClass, icon] = STATUS_COLOR[anomaly.status] || ['badge-purple', '?'];

  const resolve = async () => {
    setSaving(true);
    try { 
      await anomaliesApi.resolve(anomaly.id, { action_taken: actionLabel || 'Resolved manually', resolution_data: resData }); 
      onResolve(); 
    }
    catch(e) { alert(e.response?.data?.error || 'Resolution failed'); }
    finally { setSaving(false); }
  };

  const renderUI = () => {
    if (anomaly.status !== 'pending') return null;
    
    if (anomaly.anomaly_type === 'Missing/Unknown Payer') {
        return (
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <select className="form-input" onChange={e => {
                    const u = allUsers.find(x => x.id == e.target.value);
                    setResData({ payer_id: u?.id });
                    setActionLabel(`Assigned payer to ${u?.username}`);
                }}>
                    <option value="">Select Payer...</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={resolve} disabled={saving || !resData.payer_id}>
                  {saving ? <span className="spinner"/> : 'Resolve'}
                </button>
            </div>
        );
    }
    if (anomaly.anomaly_type === 'Percentage Sum Mismatch' || anomaly.anomaly_type === 'Validation Error') {
        return (
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <input className="form-input" style={{ flex:1 }} placeholder="e.g. Aisha 27.27%; Rohan 27.27%..." onChange={e => {
                    setResData({ ...resData, split_details: e.target.value });
                    setActionLabel(`Rescaled percentages`);
                }} />
                <button className="btn btn-primary btn-sm" onClick={resolve} disabled={saving || !resData.split_details}>
                  {saving ? <span className="spinner"/> : 'Update'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                    setResData({ action: 'equalize' }); setActionLabel('Equalized split');
                }} disabled={saving}>Set to Equalize</button>
            </div>
        );
    }
    if (anomaly.anomaly_type === 'Non-member in Split') {
        const match = anomaly.description.match(/^(.+) is not a known user/);
        const target_name = match ? match[1] : '';
        return (
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Reassign {target_name} to:</span>
                <select className="form-input" onChange={e => {
                    const u = allUsers.find(x => x.id == e.target.value);
                    setResData({ target_name, reassigned_user_id: u?.id });
                    setActionLabel(`Reassigned ${target_name} to ${u?.username}`);
                }}>
                    <option value="">Select User...</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={resolve} disabled={saving || !resData.reassigned_user_id}>
                  {saving ? <span className="spinner"/> : 'Resolve'}
                </button>
            </div>
        );
    }
    if (anomaly.anomaly_type === 'Conflicting Duplicate') {
        return (
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button className="btn btn-primary btn-sm" onClick={() => {
                    setResData({ action: 'keep' }); setActionLabel('Confirmed new expense');
                }} disabled={saving}>Set to Keep New</button>
                <button className="btn btn-danger btn-sm" onClick={() => {
                    setResData({ action: 'discard' }); setActionLabel('Discarded duplicate');
                }} disabled={saving}>Set to Discard</button>
                <button className="btn btn-primary btn-sm" onClick={resolve} disabled={saving || !resData.action}>Execute</button>
            </div>
        );
    }
    if (anomaly.anomaly_type === 'Split Details Mismatch') {
        return (
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button className="btn btn-primary btn-sm" onClick={() => {
                    setResData({ action: 'force_equal' }); setActionLabel('Forced equal split');
                }} disabled={saving}>Set Force Equal</button>
                <button className="btn btn-primary btn-sm" onClick={resolve} disabled={saving || !resData.action}>Execute</button>
            </div>
        );
    }
    // Fallback
    return (
        <div style={{ display:'flex', gap: 10, alignItems:'center' }}>
            <input className="form-input" style={{ flex:1 }} placeholder="Action taken..." onChange={e => { setActionLabel(e.target.value); }} />
            <button className="btn btn-primary btn-sm" onClick={resolve} disabled={saving || !actionLabel}>
              {saving ? <span className="spinner"/> : 'Resolve'}
            </button>
        </div>
    );
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 10 }}>
        <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
          <span className={`badge ${badgeClass}`}>{icon} {anomaly.status.replace('_', ' ')}</span>
          <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>{anomaly.anomaly_type}</span>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>· {anomaly.row_reference}</span>
        </div>
      </div>
      <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom: anomaly.status === 'pending' ? 14 : 0 }}>
        {anomaly.description}
      </p>
      
      {renderUI()}
      
      {anomaly.status !== 'pending' && anomaly.action_taken && (
        <p style={{ fontSize:13, color:'var(--success)', marginTop: 12, fontWeight: 600 }}>
          ✓ {anomaly.action_taken}
        </p>
      )}
    </div>
  );
}

export default function ImportPage() {
  const [searchParams]   = useSearchParams();
  const defaultGroup     = searchParams.get('group') || '';
  const [groupId, setGroupId] = useState(defaultGroup);
  const [file, setFile]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const [batchId, setBatchId]     = useState(null);
  const [report, setReport]       = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [allUsers, setAllUsers]   = useState([]);
  const [batches, setBatches]     = useState([]);

  useEffect(() => {
    usersApi.list().then(res => setAllUsers(res.data)).catch(console.error);
    if (groupId) {
      fetchBatches(groupId);
    }
  }, [groupId]);

  const fetchBatches = async (gid) => {
    try {
      const res = await importApi.list({ group: gid });
      setBatches(res.data);
    } catch(e) { console.error(e); }
  };

  const upload = async (e) => {
    e.preventDefault();
    if (!file || !groupId) { setError('Select a group and file.'); return; }
    setError(''); setSuccess(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('group_id', groupId);
      const { data } = await importApi.upload(fd);
      setBatchId(data.batch_id);
      await loadReport(data.batch_id);
      fetchBatches(groupId);
      setSuccess('File uploaded and processed successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally { setUploading(false); }
  };

  const loadReport = async (bid) => {
    setReportLoading(true);
    try {
      const { data } = await importApi.report(bid);
      setReport(data);
    } catch(e) { console.error(e); }
    finally { setReportLoading(false); }
  };

  const anomalies       = report?.anomalies || [];
  const pendingCount    = anomalies.filter(a => a.status === 'pending').length;
  const autoCount       = anomalies.filter(a => a.status === 'auto_applied').length;
  const resolvedCount   = anomalies.filter(a => a.status === 'resolved').length;

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Import CSV</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
          Upload your expense export file. Anomalies will be detected and surfaced for review.
        </p>
      </div>

      <div style={{ display:'flex', gap: 32, alignItems:'flex-start', flexWrap:'wrap' }}>
        
        {/* Left Sidebar */}
        <div style={{ flex: 1, minWidth: 300, maxWidth: 360 }}>
          {/* Upload Card */}
          <div className="card" style={{ padding: 28, marginBottom: 28 }}>
            <form onSubmit={upload} style={{ display:'flex', flexDirection:'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Group ID</label>
                <input id="import-group-id" className="form-input" type="number" value={groupId} onChange={e => setGroupId(e.target.value)} placeholder="Group ID" required />
              </div>
              <div className="form-group">
                <label className="form-label">CSV File</label>
                <div style={{
                  border:'2px dashed var(--border)', borderRadius:'var(--radius-md)', padding:'28px 20px',
                  textAlign:'center', cursor:'pointer', transition:'border-color var(--transition)',
                  background: file ? 'rgba(139,92,246,0.05)' : 'transparent',
                }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='var(--brand)'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor='var(--border)'; }}
                onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); e.currentTarget.style.borderColor='var(--border)'; }}
                onClick={() => document.getElementById('csv-file-input').click()}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{file ? '📄' : '⬆'}</div>
                  <div style={{ fontSize:14, color:'var(--text-secondary)', fontWeight:500 }}>
                    {file ? file.name : 'Drag & drop or click to upload'}
                  </div>
                  {!file && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Accepts .csv files</div>}
                  <input id="csv-file-input" type="file" accept=".csv" style={{ display:'none' }}
                    onChange={e => setFile(e.target.files[0])} />
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
              {success && <p style={{ color:'var(--success)', fontWeight:600, fontSize: 14, margin:0 }}>{success}</p>}
              <button id="import-submit" className="btn btn-primary" type="submit" disabled={uploading || !file || !groupId} style={{ alignSelf:'flex-start', minWidth:140 }}>
                {uploading ? <><span className="spinner"/> Processing…</> : '⤒ Upload & Process'}
              </button>
            </form>
          </div>

          {/* History */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Import History</h3>
            {batches.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No past imports found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {batches.map(b => (
                  <div key={b.id} onClick={() => { setBatchId(b.id); loadReport(b.id); }}
                    style={{
                      padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer', background: batchId === b.id ? 'var(--bg-glass-h)' : 'transparent',
                      transition: 'background var(--transition)'
                    }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Batch #{b.id}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{b.file_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {new Date(b.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Content: Report */}
        <div style={{ flex: 2, minWidth: 400 }}>
          {reportLoading && (
            <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" style={{ width:36, height:36 }}/></div>
          )}
          {!reportLoading && !report && (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a batch from history or upload a new file to see the anomaly report.
            </div>
          )}
          {report && !reportLoading && (
            <div>
              {/* Summary */}
              <div style={{ display:'flex', gap: 14, marginBottom: 24, flexWrap:'wrap' }}>
                {[
                  { label:'Total Anomalies', value: anomalies.length,  color:'var(--brand-light)' },
                  { label:'Needs Review',    value: pendingCount,       color:'var(--warning)'    },
                  { label:'Auto-applied',    value: autoCount,          color:'var(--accent-light)'},
                  { label:'Resolved',        value: resolvedCount,      color:'var(--success)'    },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding:'16px 22px', flex:1, minWidth:140 }}>
                    <div className="stat-label">{s.label}</div>
                    <div style={{ fontSize:28, fontWeight:800, color:s.color, marginTop:4 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Anomaly List */}
              <h2 style={{ fontSize:17, fontWeight:700, marginBottom:14 }}>Anomaly Report — Batch #{batchId}</h2>
              {anomalies.length === 0 ? (
                <div className="card" style={{ padding:40, textAlign:'center', color:'var(--success)' }}>
                  🎉 No anomalies detected. All rows imported cleanly!
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
                  {anomalies.map(a => <AnomalyCard key={a.id} anomaly={a} onResolve={() => loadReport(batchId)} allUsers={allUsers} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
