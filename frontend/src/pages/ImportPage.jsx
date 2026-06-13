import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { importApi, anomaliesApi } from '../api';

function AnomalyCard({ anomaly, onResolve }) {
  const [action, setAction]   = useState('');
  const [saving, setSaving]   = useState(false);

  const STATUS_COLOR = {
    pending:    ['badge-yellow', '⏳'],
    resolved:   ['badge-green',  '✓'],
    auto_applied:['badge-teal',  '⚡'],
  };
  const [badgeClass, icon] = STATUS_COLOR[anomaly.status] || ['badge-purple', '?'];

  const resolve = async () => {
    setSaving(true);
    try { await anomaliesApi.resolve(anomaly.id, { action_taken: action }); onResolve(); }
    catch(e) { console.error(e); }
    finally { setSaving(false); }
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
      {anomaly.status === 'pending' && (
        <div style={{ display:'flex', gap: 10, alignItems:'center' }}>
          <input
            className="form-input" style={{ flex:1 }}
            placeholder="Describe the action taken (e.g., rescaled percentages)…"
            value={action} onChange={e => setAction(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={resolve} disabled={saving || !action}>
            {saving ? <span className="spinner"/> : 'Resolve'}
          </button>
        </div>
      )}
      {anomaly.status !== 'pending' && anomaly.action_taken && (
        <p style={{ fontSize:12, color:'var(--text-muted)', marginTop: 8, fontStyle:'italic' }}>
          Action: {anomaly.action_taken}
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

      {/* Report */}
      {reportLoading && (
        <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" style={{ width:36, height:36 }}/></div>
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
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {anomalies.map(a => (
                <AnomalyCard key={a.id} anomaly={a} onResolve={() => loadReport(batchId)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
