import React, { useState, useEffect } from 'react';
import { getTotpUri, generateTotpCode, verifyTotpCode, getRemainingTotpSeconds } from '../utils/totpHelper';

export default function MfaEnrollment({ secret, onComplete, onClose }) {
  const [testCode, setTestCode] = useState('');
  const [currentLiveCode, setCurrentLiveCode] = useState('');
  const [remainingSecs, setRemainingSecs] = useState(getRemainingTotpSeconds());
  const [errorMsg, setErrorMsg] = useState('');

  const totpUri = getTotpUri(secret);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`;

  useEffect(() => {
    let timer;
    const updateTimer = async () => {
      const live = await generateTotpCode(secret);
      setCurrentLiveCode(live);
      setRemainingSecs(getRemainingTotpSeconds());
    };

    updateTimer();
    timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [secret]);

  const handleVerifyEnrollment = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const isValid = await verifyTotpCode(secret, testCode);
    if (isValid) {
      alert('✅ TOTP Multi-Factor Authentication successfully enrolled for Admin!');
      onComplete(secret);
    } else {
      setErrorMsg('Invalid 6-digit TOTP code. Check Google Authenticator or try the live generated code.');
    }
  };

  return (
    <div className="layer-backdrop" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: '460px', width: '92%', padding: '2rem', borderRadius: '18px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', background: '#fff' }}>
        <div style={{ textAlignment: 'center', marginBottom: '1.25rem', textAlign: 'center' }}>
          <i className="fa-solid fa-shield-halved" style={{ fontSize: '2.5rem', color: 'var(--brand-emerald)', marginBottom: '0.5rem' }}></i>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--brand-navy)', fontSize: '1.4rem' }}>Setup 6-Digit TOTP Authenticator</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Scan QR Code with Google Authenticator or Authy to enable 30-second changing security codes.</p>
        </div>

        {/* QR Code Container */}
        <div style={{ textAlign: 'center', margin: '1rem 0', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <img src={qrCodeUrl} alt="Authenticator QR Code" style={{ width: '170px', height: '170px', borderRadius: '8px', border: '2px solid var(--brand-gold)' }} />
          <div style={{ marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Manual Setup Secret Key:</span>
            <code style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-navy)', background: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '6px', letterSpacing: '2px' }}>{secret}</code>
          </div>
        </div>

        {/* Live Code Hint Box */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, display: 'block' }}>Current 30s Live Code:</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-emerald)', letterSpacing: '3px' }}>{currentLiveCode}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', color: '#166534' }}>Rotates in:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--brand-gold)', display: 'block' }}>{remainingSecs}s</span>
          </div>
        </div>

        <form onSubmit={handleVerifyEnrollment}>
          <div className="form-group">
            <label><i className="fa-solid fa-key"></i> Enter 6-Digit Authenticator Code</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 123456"
              maxLength="6"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              style={{ textAlign: 'center', fontSize: '1.3rem', letterSpacing: '4px', fontWeight: 800 }}
              required
            />
          </div>

          {errorMsg && (
            <div className="error-msg" style={{ marginBottom: '1rem' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary btn-block">
              <i className="fa-solid fa-circle-check"></i> Verify & Enable MFA
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
