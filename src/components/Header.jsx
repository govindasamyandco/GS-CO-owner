import React from 'react';

export default function Header({ totalProducts, onLogout }) {
  return (
    <header className="top-nav">
      <div className="nav-container">
        <div className="brand-group">
          <div className="logo-wrapper">
            <img
              src="/assets/logo.jpg"
              alt="Govindasamy & Co Logo"
              className="brand-logo"
              onError={(e) => { e.target.src = 'https://via.placeholder.com/48?text=GS'; }}
            />
          </div>
          <div className="brand-titles">
            <h1>GOVINDASAMY & CO</h1>
            <span className="brand-tagline">Quality Mat & Textile Products Manufacturer & Wholesaler • Admin Portal</span>
          </div>
        </div>

        <div className="nav-actions">
          <div className="admin-status-pill">
            <i className="fa-solid fa-boxes-stacked"></i>
            <span>{totalProducts} Products</span>
          </div>

          <div className="admin-status-pill admin-badge-glow">
            <i className="fa-solid fa-shield-halved"></i>
            <span>Admin Active</span>
          </div>

          <button
            type="button"
            className="btn btn-logout-pill"
            onClick={onLogout}
            title="Log Out of Admin Portal"
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
