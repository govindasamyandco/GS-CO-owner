import React, { useState } from 'react';
import { getTotpUri, verifyTotpCode } from '../utils/totpHelper';

export default function MfaEnrollment({ secret, onComplete, onClose }) {
  const [testCode, setTestCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const totpUri = getTotpUri(secret);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(totpUri)}`;

  const handleVerifyEnrollment = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const isValid = await verifyTotpCode(secret, testCode);
    if (isValid) {
      onComplete(secret);
    } else {
      setErrorMsg('Invalid 6-digit TOTP code. Please check your Google Authenticator or Authy app on your phone.');
    }
  };

  return (
    <div className="layer-backdrop" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: '460px', width: '92%', padding: '2rem', borderRadius: '18px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', background: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <i className="fa-solid fa-qrcode" style={{ fontSize: '2.5rem', color: 'var(--brand-emerald)', marginBottom: '0.4rem' }}></i>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--brand-navy)', fontSize: '1.4rem' }}>Scan QR Code with Phone</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Open <strong>Google Authenticator</strong> or <strong>Authy</strong> on your phone, tap <strong>"+"</strong> and scan this QR code.
          </p>
        </div>

        {/* QR Code Container */}
        <div style={{ textAlign: 'center', margin: '1rem 0', background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <img src={qrCodeUrl} alt="Authenticator QR Code" style={{ width: '180px', height: '180px', borderRadius: '8px', border: '3px solid var(--brand-gold)' }} />
          <div style={{ marginTop: '0.85rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Manual Setup Secret Key:</span>
            <code style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--brand-navy)', background: '#e2e8f0', padding: '0.25rem 0.65rem', borderRadius: '6px', letterSpacing: '2px' }}>{secret}</code>
          </div>
        </div>

        <form onSubmit={handleVerifyEnrollment}>
          <div className="form-group">
            <label style={{ textAlign: 'center', display: 'block' }}><i className="fa-solid fa-key"></i> Enter 6-Digit Code Generated on Your Phone</label>
            <input
              type="text"
              className="form-control"
              placeholder="000 000"
              maxLength="6"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '6px', fontWeight: 800, color: 'var(--brand-navy)' }}
              autoFocus
              required
            />
          </div>

          {errorMsg && (
            <div className="error-msg" style={{ marginBottom: '1rem' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary btn-block">
              <i className="fa-solid fa-circle-check"></i> Complete Setup
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
