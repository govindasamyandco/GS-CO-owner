import React, { useState, useEffect } from 'react';
import { auth, signInWithEmailAndPassword, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from '../firebase';
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
  const [honeypot, setHoneypot] = useState('');

  // Step 1: Email & Password Validation with Rate Limiting
  const handlePrimaryAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Anti-Bot Honeypot Defense: Silent drop for automated spam bots
    if (honeypot) {
      console.warn('Bot activity blocked by honeypot.');
      return;
    }

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

  // Check redirect result on mount if redirect auth was triggered
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const userCredential = await getRedirectResult(auth);
        if (userCredential && userCredential.user) {
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
            setStep(2);
          }
        }
      } catch (err) {
        console.error('Redirect sign-in error:', err);
        if (err.code !== 'auth/popup-closed-by-user') {
          setErrorMsg('Google Sign-In: ' + (err.message || err.code));
        }
      }
    };

    handleRedirectResult();
  }, []);

  // Step 1 Alternative: Google Sign-In with Store Admin Authorization
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    const lockStatus = limiter.isLockedOut();
    if (lockStatus.locked) {
      setErrorMsg(`⚠️ Too many failed attempts. Security lockout active for ${lockStatus.remainingSecs} seconds.`);
      return;
    }

    // Google OAuth Authorized Domains in Firebase include 'localhost', not '127.0.0.1'
    if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
      window.location.replace(window.location.href.replace('//127.0.0.1:', '//localhost:'));
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
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized domain')) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        if (currentHost === '127.0.0.1') {
          toast.info('Switching to http://localhost:5173 for authorized Google Sign-In...', 'Authorizing Domain');
          window.location.replace(window.location.href.replace('//127.0.0.1:', '//localhost:'));
          return;
        }
        setErrorMsg(`Domain Unauthorized: Please add "${currentHost}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
        return;
      }

      // If browser blocked the popup or user environment closed popup, seamlessly fall back to redirect
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        toast.info('Popup blocked by browser. Redirecting directly to Google Sign-In...', 'Google Sign-In');
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          console.error('Redirect sign-in error:', redirectErr);
          setErrorMsg('Google Sign-In: ' + (redirectErr.message || redirectErr.code));
          return;
        }
      }

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
          <img src="/assets/logo.jpg" alt="Govindasamy & Co Logo" className="login-logo" onError={(e) => { e.target.src = 'https://via.placeholder.com/75?text=GS'; }} />
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
            {/* Anti-Bot Honeypot field (hidden from real users) */}
            <input
              type="text"
              name="hp_field"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ display: 'none', position: 'absolute', left: '-9999px', opacity: 0 }}
              tabIndex="-1"
              autoComplete="off"
            />

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
              Next: Enter 6-Digit TOTP <i className="fa-solid fa-arrow-right"></i>
            </button>

            <div style={{ margin: '0.6rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>or</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="btn btn-secondary btn-block btn-google-signin"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                background: '#ffffff',
                color: '#1f2937',
                border: '1.5px solid #cbd5e1',
                fontWeight: 600,
                fontSize: '0.84rem',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                cursor: 'pointer'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>Sign In with Google Account</span>
            </button>
          </form>
        ) : (
          /* STEP 2: 6-DIGIT TOTP SECURITY CODE FORM */
          <form className="login-form" onSubmit={handleTotpVerify}>
            <div className="form-group" style={{ textAlign: 'center' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                <i className="fa-solid fa-mobile-screen-button" style={{ color: 'var(--brand-emerald)', marginRight: '0.35rem' }}></i>
                Enter 6-Digit Security Code
              </label>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginBottom: '0.65rem' }}>
                Open <strong>Google Authenticator</strong> or <strong>Authy</strong> for your 6-digit code.
              </p>

              <input
                type="text"
                className="form-control"
                placeholder="000 000"
                maxLength="6"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '6px', fontWeight: 800, color: 'var(--brand-navy)', padding: '0.55rem' }}
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
              <i className="fa-solid fa-shield-check"></i> Verify & Access Admin
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button type="button" className="forgot-pass-link" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.76rem' }}>
                <i className="fa-solid fa-arrow-left"></i> Back to Login
              </button>

              {/* FINGERPRINT PROTECTED QR CODE BUTTON */}
              <button
                type="button"
                className="forgot-pass-link"
                onClick={handleOpenQrWithBiometrics}
                disabled={authenticatingBiometric}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.76rem', color: 'var(--brand-gold)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <i className="fa-solid fa-fingerprint" style={{ color: 'var(--brand-emerald)', fontSize: '0.85rem' }}></i>
                <span>{authenticatingBiometric ? 'Verifying Fingerprint...' : 'Scan QR via Phone'}</span>
              </button>
            </div>
          </form>
        )}

        <div className="login-footer">
          <p><i className="fa-solid fa-shield-halved" style={{ color: 'var(--brand-emerald)', marginRight: '0.3rem' }}></i>Govindasamy & Co • Biometric & TOTP Secured</p>
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
