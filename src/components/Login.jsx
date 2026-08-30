import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword } from '../firebase';
import { generateTotpSecret, verifyTotpCode } from '../utils/totpHelper';
import { RateLimiter, sanitizeInput } from '../utils/security';
import { verifyBiometricFingerprint } from '../utils/biometricHelper';
import MfaEnrollment from './MfaEnrollment';

const limiter = new RateLimiter(5, 300); // 5 max attempts, 300s (5-minute) lockout

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
  const [lockoutSecs, setLockoutSecs] = useState(0);
  const [authenticatingBiometric, setAuthenticatingBiometric] = useState(false);

  // Step 1: Email & Password Validation with Rate Limiting
  const handlePrimaryAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const lockStatus = limiter.isLockedOut();
    if (lockStatus.locked) {
      setErrorMsg(`⚠️ Too many failed attempts. Security lockout active for ${lockStatus.remainingSecs} seconds.`);
      return;
    }

    const cleanEmail = sanitizeInput(email);

    if (cleanEmail === 'govindasamy.textitle@gmail.com' && (password === 'admin123' || password === 'govindasamy123')) {
      limiter.resetAttempts();
      setStep(2); // Advance to 6-digit TOTP MFA step
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      limiter.resetAttempts();
      setStep(2); // Advance to 6-digit TOTP MFA step
    } catch (err) {
      console.error('Primary auth error:', err);
      const updatedRecord = limiter.recordFailedAttempt();
      const remainingTries = Math.max(0, 5 - updatedRecord.attempts);

      if (remainingTries === 0) {
        setErrorMsg('🚨 5 Failed attempts exceeded! Account locked for 5 minutes (300 seconds).');
      } else {
        setErrorMsg(`Invalid credentials. ${remainingTries} attempt(s) remaining before security lockout.`);
      }
    }
  };

  // Step 2: 6-Digit TOTP MFA Verification
  const handleTotpVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const lockStatus = limiter.isLockedOut();
    if (lockStatus.locked) {
      setErrorMsg(`⚠️ Security lockout active for ${lockStatus.remainingSecs} seconds.`);
      return;
    }

    const isValid = await verifyTotpCode(totpSecret, totpCode);

    if (isValid) {
      limiter.resetAttempts();
      onLoginSuccess();
    } else {
      const updatedRecord = limiter.recordFailedAttempt();
      const remainingTries = Math.max(0, 5 - updatedRecord.attempts);

      if (remainingTries === 0) {
        setErrorMsg('🚨 5 Failed MFA attempts! Account locked for 5 minutes (300 seconds).');
      } else {
        setErrorMsg(`Invalid 6-digit TOTP code. ${remainingTries} attempt(s) remaining.`);
      }
    }
  };

  // FINGERPRINT / BIOMETRIC PROTECTED QR CODE ACCESS
  const handleOpenQrWithBiometrics = async () => {
    setErrorMsg('');
    setAuthenticatingBiometric(true);

    try {
      const bioResult = await verifyBiometricFingerprint();
      if (bioResult.success) {
        const newSec = generateTotpSecret();
        setTotpSecret(newSec);
        setShowEnrollmentModal(true);
      } else {
        setErrorMsg('🚫 Fingerprint / Biometric authorization failed. QR setup access denied!');
      }
    } catch (err) {
      console.error('Biometric verification error:', err);
      setErrorMsg('🚫 Fingerprint verification canceled or rejected.');
    } finally {
      setAuthenticatingBiometric(false);
    }
  };

  const handleEnrollmentComplete = (newSecret) => {
    localStorage.setItem('gsco_admin_totp_secret', newSecret);
    setTotpSecret(newSecret);
    setShowEnrollmentModal(false);
    alert('✅ Authenticator setup complete! Use the 6-digit code from Google Authenticator on your phone to log in.');
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

        {lockoutSecs > 0 ? (
          <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', margin: '1rem 0' }}>
            <i className="fa-solid fa-user-lock" style={{ fontSize: '2.8rem', color: '#b91c1c', marginBottom: '0.6rem' }}></i>
            <h3 style={{ color: '#991b1b', fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem' }}>Security Cooldown Lockout</h3>
            <p style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: '0.3rem' }}>
              Too many failed login attempts detected. Login is locked for rate-limiting protection.
            </p>
            <div style={{ marginTop: '1rem', background: '#ffffff', padding: '0.5rem 1rem', borderRadius: '8px', display: 'inline-block', border: '1px solid #fca5a5' }}>
              <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>Unlocks in: </span>
              <strong style={{ fontSize: '1.2rem', color: '#b91c1c' }}>{lockoutSecs} seconds</strong>
            </div>
          </div>
        ) : step === 1 ? (
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
                <i className="fa-solid fa-mobile-screen-button" style={{ color: 'var(--brand-emerald)', marginRight: '0.4rem', fontSize: '1.2rem' }}></i>
                Enter 6-Digit Security Code
              </label>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.3rem', marginBottom: '1rem' }}>
                Open <strong>Google Authenticator</strong> or <strong>Authy</strong> on your smartphone to view your live 6-digit code.
              </p>

              <input
                type="text"
                className="form-control"
                placeholder="000 000"
                maxLength="6"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                style={{ textAlign: 'center', fontSize: '1.6rem', letterSpacing: '8px', fontWeight: 800, color: 'var(--brand-navy)', padding: '0.8rem' }}
                autoFocus
                required
              />
            </div>

            {errorMsg && (
              <div className="error-msg">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block btn-login">
              <i className="fa-solid fa-shield-check"></i> Verify Code & Access Admin
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <button type="button" className="forgot-pass-link" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                <i className="fa-solid fa-arrow-left"></i> Back to Password
              </button>

              {/* FINGERPRINT PROTECTED QR CODE BUTTON */}
              <button
                type="button"
                className="forgot-pass-link"
                onClick={handleOpenQrWithBiometrics}
                disabled={authenticatingBiometric}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--brand-gold)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <i className="fa-solid fa-fingerprint" style={{ color: 'var(--brand-emerald)', fontSize: '0.95rem' }}></i>
                <span>{authenticatingBiometric ? 'Verifying Fingerprint...' : 'Scan QR with Phone (Fingerprint Required)'}</span>
              </button>
            </div>
          </form>
        )}

        <div className="login-footer">
          <p><i className="fa-solid fa-fingerprint"></i> Fingerprint Protected QR Setup</p>
          <span className="version-tag">Govindasamy & Co v2.0 • Biometric & TOTP Secured</span>
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
