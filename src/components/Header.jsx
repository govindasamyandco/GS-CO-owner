import React from 'react';

export default function Header({ totalProducts, onLogout }) {
  return (
    <header className="top-nav">
      <div className="brand-group">
        <img src="/public/assets/logo.jpg" alt="Govindasamy & Co Logo" className="brand-logo" onError={(e) => { e.target.src = 'https://via.placeholder.com/55?text=GS'; }} />
        <div className="brand-titles">
          <h1>Govindasamy & Co</h1>
          <span className="brand-tagline">Mat & Textile Products Admin Dashboard (React)</span>
        </div>
      </div>

      <div className="quick-stats">
        <div className="stat-badge">
          <i className="fa-solid fa-rug"></i>
          <div>
            <span className="stat-value">{totalProducts}</span>
            <span className="stat-label">Total Mat Products</span>
          </div>
        </div>

        <div className="stat-badge admin-user-badge">
          <i className="fa-solid fa-user-shield"></i>
          <div>
            <span className="stat-value">govindasamy</span>
            <span className="stat-label">Admin Logged In</span>
          </div>
        </div>

        <button type="button" className="btn btn-logout" onClick={onLogout} title="Log Out">
          <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
        </button>
      </div>
    </header>
  );
}
