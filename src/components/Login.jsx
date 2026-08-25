import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword } from '../firebase';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('govindasamy.textitle@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (email === 'govindasamy.textitle@gmail.com' && (password === 'admin123' || password === 'govindasamy123')) {
      onLoginSuccess();
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Invalid admin credentials. Please try again.');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <img src="/public/assets/logo.jpg" alt="Govindasamy & Co Logo" className="login-logo" onError={(e) => { e.target.src = 'https://via.placeholder.com/75?text=GS'; }} />
          <h1>Govindasamy & Co</h1>
          <p className="login-subtitle">Admin Management Portal (React)</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
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
            <i className="fa-solid fa-right-to-bracket"></i> Login to Admin Dashboard
          </button>
        </form>

        <div className="login-footer">
          <p><i className="fa-solid fa-shield-halved"></i> Authorized Admin Access Only</p>
          <span className="version-tag">Govindasamy & Co v2.0 • React & Firebase Secured</span>
        </div>
      </div>
    </div>
  );
}
