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
    <section className="card audit-card-section" style={{ gridColumn: '1/-1', marginTop: '1.25rem' }}>
      <div className="audit-header-bar">
        <div className="audit-title-block">
          <h2><i className="fa-solid fa-shield-halved" style={{ color: 'var(--brand-gold)', marginRight: '0.4rem' }}></i> Security Audit Logs</h2>
          <p className="section-desc">Server-logged activities for all admin modifications & Cloud Function executions.</p>
        </div>
        <div className="audit-immutable-pill">
          <i className="fa-solid fa-lock"></i>
          <span>Server Immutable</span>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '1rem' }}>Loading security logs...</p>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-user-shield" style={{ fontSize: '2rem', color: 'var(--brand-navy)', marginBottom: '0.5rem' }}></i>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>No audit activity recorded yet.</p>
          <span style={{ fontSize: '0.78rem' }}>Actions executed via Cloud Functions will log automatically.</span>
        </div>
      ) : (
        <div className="audit-table-scroll">
          <table className="audit-table-clean">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action Type</th>
                <th>Admin User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 15).map((log) => {
                const dateStr = log.timestamp?.seconds
                  ? new Date(log.timestamp.seconds * 1000).toLocaleString('en-IN')
                  : 'Just now';

                let badgeClass = 'audit-badge-navy';
                if (log.action === 'ADD_PRODUCT') badgeClass = 'audit-badge-green';
                if (log.action === 'DELETE_PRODUCT') badgeClass = 'audit-badge-red';
                if (log.action === 'UPDATE_PRODUCT') badgeClass = 'audit-badge-gold';

                return (
                  <tr key={log.id}>
                    <td className="cell-time">{dateStr}</td>
                    <td>
                      <span className={`audit-badge ${badgeClass}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="cell-admin">{log.adminEmail}</td>
                    <td className="cell-details">
                      {log.details ? (typeof log.details === 'object' ? JSON.stringify(log.details) : log.details) : 'N/A'}
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
