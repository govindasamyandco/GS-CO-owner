import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword, googleProvider, signInWithPopup } from '../firebase';
import { generateTotpSecret, verifyTotpCode } from '../utils/totpHelper';
import { RateLimiter, sanitizeInput } from '../utils/security';
import { verifyBiometricFingerprint } from '../utils/biometricHelper';
import { toast } from '../utils/toast';
import MfaEnrollment from './MfaEnrollment';

const limiter = new RateLimiter(5, 300); // 5 max attempts, 300s (5-minute) lockout

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Two-Step Authentication State
  const [step, setStep] = useState(1); // 1 = Email/Pass, 2 = 6-Digit TOTP Code
  const [totpCode, setTotpCode] = useState('');
  const [totpSecret, setTotpSecret] = useState(
    localStorage.getItem('gsco_admin_totp_secret') || ''
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

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      // Verify admin custom claim from Firebase Auth token or configured admin email
      const idToken = await userCredential.user.getIdTokenResult(true);
      const hasAdminAuth = idToken.claims.admin === true || userCredential.user.email === (import.meta.env.VITE_ADMIN_EMAIL || 'govindasamy.textile@gmail.com');
      if (!hasAdminAuth) {
        setErrorMsg('🚨 Access Denied: This account lacks verified admin authorization.');
        return;
      }
      limiter.resetAttempts();

      // If no TOTP secret is enrolled yet, trigger enrollment
      const existingSecret = localStorage.getItem('gsco_admin_totp_secret');
      if (!existingSecret) {
        const newSec = generateTotpSecret();
        setTotpSecret(newSec);
        setShowEnrollmentModal(true);
      } else {
        setStep(2); // Advance to 6-digit TOTP MFA step
      }
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

  // Step 1 Alternative: Google Sign-In with Store Admin Authorization
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    const lockStatus = limiter.isLockedOut();
    if (lockStatus.locked) {
      setErrorMsg(`⚠️ Too many failed attempts. Security lockout active for ${lockStatus.remainingSecs} seconds.`);
      return;
    }

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const idToken = await userCredential.user.getIdTokenResult(true);
      const hasAdminAuth = idToken.claims.admin === true || userCredential.user.email === (import.meta.env.VITE_ADMIN_EMAIL || 'govindasamy.textile@gmail.com');

      if (!hasAdminAuth) {
        setErrorMsg(`🚨 Access Denied: Google account (${userCredential.user.email}) is not authorized as store admin.`);
        return;
      }

      limiter.resetAttempts();

      const existingSecret = localStorage.getItem('gsco_admin_totp_secret');
      if (!existingSecret) {
        const newSec = generateTotpSecret();
        setTotpSecret(newSec);
        setShowEnrollmentModal(true);
      } else {
        setStep(2); // Advance to 6-digit TOTP MFA step
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      setErrorMsg('Google Sign-In: ' + (err.message || err.code));
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
    toast.success('Authenticator setup complete! Use the 6-digit code from Google Authenticator on your phone to log in.', 'MFA Enrolled');
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
                  placeholder={import.meta.env.VITE_ADMIN_EMAIL || "admin@example.com"}
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

            <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>or</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="btn btn-secondary btn-block"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                background: '#ffffff',
                color: '#1e293b',
                border: '1.5px solid #cbd5e1',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                cursor: 'pointer'
              }}
            >
              <i className="fa-brands fa-google" style={{ color: '#ea4335', fontSize: '1.1rem' }}></i>
              Sign In with Google Account
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
