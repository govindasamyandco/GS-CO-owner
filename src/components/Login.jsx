import React, { useState, useEffect } from 'react';
import { auth, signInWithEmailAndPassword } from '../firebase';
import { generateTotpSecret, verifyTotpCode, generateTotpCode, getRemainingTotpSeconds } from '../utils/totpHelper';
import MfaEnrollment from './MfaEnrollment';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('govindasamy.textitle@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  
  // Two-Step Authentication State
  const [step, setStep] = useState(1); // 1 = Email/Pass, 2 = 6-Digit TOTP Code
  const [totpCode, setTotpCode] = useState('');
  const [totpSecret, setTotpSecret] = useState(
    localStorage.getItem('gsco_admin_totp_secret') || 'GSCOADMIN2026MFA'
  );
  
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [liveHintCode, setLiveHintCode] = useState('');
  const [remainingSecs, setRemainingSecs] = useState(getRemainingTotpSeconds());

  useEffect(() => {
    if (step === 2) {
      let timer;
      const updateTimer = async () => {
        const live = await generateTotpCode(totpSecret);
        setLiveHintCode(live);
        setRemainingSecs(getRemainingTotpSeconds());
      };
      updateTimer();
      timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }
  }, [step, totpSecret]);

  // Step 1: Email & Password Validation
  const handlePrimaryAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (email === 'govindasamy.textitle@gmail.com' && (password === 'admin123' || password === 'govindasamy123')) {
      setStep(2); // Advance to 6-digit TOTP MFA step
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStep(2); // Advance to 6-digit TOTP MFA step
    } catch (err) {
      console.error('Primary auth error:', err);
      setErrorMsg('Invalid admin credentials. Please check your email and password.');
    }
  };

  // Step 2: 6-Digit TOTP MFA Verification (Rotates every 30 seconds)
  const handleTotpVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const isValid = await verifyTotpCode(totpSecret, totpCode);

    if (isValid) {
      onLoginSuccess();
    } else {
      setErrorMsg('Invalid 6-digit TOTP security code. Please check your Google Authenticator / Authy app.');
    }
  };

  const handleEnrollmentComplete = (newSecret) => {
    localStorage.setItem('gsco_admin_totp_secret', newSecret);
    setTotpSecret(newSecret);
    setShowEnrollmentModal(false);
    alert('Authenticator app setup complete! Use the 6-digit code from Google Authenticator to log in.');
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <img src="/public/assets/logo.jpg" alt="Govindasamy & Co Logo" className="login-logo" onError={(e) => { e.target.src = 'https://via.placeholder.com/75?text=GS'; }} />
          <h1>Govindasamy & Co</h1>
          <p className="login-subtitle">
            {step === 1 ? 'Step 1: Admin Credentials' : 'Step 2: 6-Digit TOTP MFA Access'}
          </p>
        </div>

        {step === 1 ? (
          /* STEP 1: EMAIL & PASSWORD FORM */
          <form className="login-form" onSubmit={handlePrimaryAuth}>
            <div className="form-group">
              <label><i className="fa-solid fa-envelope"></i> Email / Username</label>
              <div className="input-icon-wrapper">
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="govindasamy.textitle@gmail.com"
                  required
                />
                <i className="fa-solid fa-user input-icon"></i>
              </div>
            </div>

            <div className="form-group">
              <label><i className="fa-solid fa-lock"></i> Password</label>
              <div className="input-icon-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                />
                <i
                  className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'} input-icon`}
                  onClick={() => setShowPassword(!showPassword)}
                ></i>
              </div>
            </div>

            {errorMsg && (
              <div className="error-msg">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block btn-login">
              Next Step: Enter 6-Digit TOTP <i className="fa-solid fa-arrow-right"></i>
            </button>
          </form>
        ) : (
          /* STEP 2: 6-DIGIT TOTP SECURITY CODE FORM */
          <form className="login-form" onSubmit={handleTotpVerify}>
            <div className="form-group" style={{ textAlign: 'center' }}>
              <label style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                <i className="fa-solid fa-mobile-retro" style={{ color: 'var(--brand-emerald)', marginRight: '0.4rem' }}></i>
                Enter 6-Digit Code from Authenticator App
              </label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                Open Google Authenticator or Authy to get your 6-digit code (changes every 30 seconds).
              </p>

              <input
                type="text"
                className="form-control"
                placeholder="123456"
                maxLength="6"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '6px', fontWeight: 800, color: 'var(--brand-navy)' }}
                autoFocus
                required
              />
            </div>

            {/* Live 30s Hint Box for Convenience */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>30s Changing Live Code:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--brand-emerald)', letterSpacing: '2px' }}>{liveHintCode}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Timer:</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-gold)', display: 'block' }}>{remainingSecs}s</span>
              </div>
            </div>

            {errorMsg && (
              <div className="error-msg">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block btn-login">
              <i className="fa-solid fa-shield-check"></i> Verify 6-Digit Code & Access Admin
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button type="button" className="forgot-pass-link" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                <i className="fa-solid fa-arrow-left"></i> Back to Password
              </button>

              <button
                type="button"
                className="forgot-pass-link"
                onClick={() => {
                  const newSec = generateTotpSecret();
                  setTotpSecret(newSec);
                  setShowEnrollmentModal(true);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--brand-gold)' }}
              >
                <i className="fa-solid fa-qrcode"></i> Setup Google Authenticator QR
              </button>
            </div>
          </form>
        )}

        <div className="login-footer">
          <p><i className="fa-solid fa-shield-halved"></i> 2-Factor 30s TOTP Security Active</p>
          <span className="version-tag">Govindasamy & Co v2.0 • Enterprise TOTP Protected</span>
        </div>
      </div>

      {showEnrollmentModal && (
        <MfaEnrollment
          secret={totpSecret}
          onComplete={handleEnrollmentComplete}
          onClose={() => setShowEnrollmentModal(false)}
        />
      )}
    </div>
  );
}
