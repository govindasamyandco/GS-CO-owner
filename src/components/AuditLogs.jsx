import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy, limit } from '../firebase';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Limit to latest 25 logs to prevent unbounded read operations
    const auditQuery = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );
    const unsubscribe = onSnapshot(auditQuery, (snapshot) => {
      const fetched = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setLogs(fetched);
      setLoading(false);
    }, (err) => {
      console.warn('Audit logs listener warning:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <section className="card" style={{ gridColumn: '1/-1', marginTop: '1rem' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2><i className="fa-solid fa-shield-cat"></i> Security Audit Logs</h2>
          <p className="section-desc">Server-logged activities for all admin modifications & Cloud Function executions.</p>
        </div>
        <span className="bundle-badge" style={{ background: 'var(--brand-navy)' }}>
          <i className="fa-solid fa-lock"></i> Server Immutable
        </span>
      </div>

      {loading ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem' }}>Loading security logs...</p>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-user-shield" style={{ fontSize: '2rem', color: 'var(--brand-emerald)', marginBottom: '0.5rem' }}></i>
          <p style={{ fontWeight: 600 }}>No audit activity recorded yet.</p>
          <span style={{ fontSize: '0.8rem' }}>Actions executed via Cloud Functions will log automatically.</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem', color: 'var(--brand-navy)' }}>Timestamp</th>
                <th style={{ padding: '0.75rem', color: 'var(--brand-navy)' }}>Action Type</th>
                <th style={{ padding: '0.75rem', color: 'var(--brand-navy)' }}>Admin Email</th>
                <th style={{ padding: '0.75rem', color: 'var(--brand-navy)' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 15).map((log) => {
                const dateStr = log.timestamp?.seconds
                  ? new Date(log.timestamp.seconds * 1000).toLocaleString('en-IN')
                  : 'Just now';

                let badgeColor = 'var(--brand-navy)';
                if (log.action === 'ADD_PRODUCT') badgeColor = 'var(--brand-emerald)';
                if (log.action === 'DELETE_PRODUCT') badgeColor = '#ef4444';
                if (log.action === 'UPDATE_PRODUCT') badgeColor = 'var(--brand-gold)';

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{dateStr}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ background: badgeColor, color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>{log.adminEmail}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                      {log.details ? JSON.stringify(log.details) : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
