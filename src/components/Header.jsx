import React from 'react';

export default function Header({
  totalProducts,
  onLogout,
  onOpenBaleInfo,
  activeView = 'CATALOG',
  onNavigateView,
  pendingOrdersCount = 0,
  globalHidePrices = false,
  onToggleGlobalHidePrices
}) {
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
          {/* GLOBAL MASTER PRICE VISIBILITY TOGGLE SWITCH AT TOP */}
          <button
            type="button"
            className="admin-status-pill"
            onClick={onToggleGlobalHidePrices}
            style={{
              background: globalHidePrices ? '#dc2626' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              padding: '0.45rem 0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '9999px',
              fontSize: '0.82rem',
              boxShadow: globalHidePrices ? '0 0 12px rgba(220, 38, 38, 0.4)' : 'none',
              transition: 'all 0.25s ease'
            }}
            title={globalHidePrices ? 'All customer prices are HIDDEN. Click to SHOW numerical prices.' : 'All customer prices are VISIBLE. Click to HIDE prices globally.'}
          >
            <i className={`fa-solid ${globalHidePrices ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            <span>{globalHidePrices ? 'Prices Hidden (Customer Site)' : 'Hide All Prices'}</span>
          </button>

          {/* Navigation View Switchers */}
          <button
            type="button"
            className={`admin-status-pill nav-view-tab ${activeView === 'CATALOG' ? 'active-nav-tab' : ''}`}
            onClick={() => onNavigateView && onNavigateView('CATALOG')}
            title="Switch to Catalog & Product Management"
          >
            <i className="fa-solid fa-boxes-stacked"></i>
            <span>Catalog ({totalProducts})</span>
          </button>

          <button
            type="button"
            className={`admin-status-pill nav-view-tab ${activeView === 'ORDERS' ? 'active-nav-tab' : ''}`}
            onClick={() => onNavigateView && onNavigateView('ORDERS')}
            title="Open Wholesale Customer Orders Page"
          >
            <i className="fa-solid fa-file-invoice-dollar" style={{ color: activeView === 'ORDERS' ? '#ffffff' : '#2563eb' }}></i>
            <span>Wholesale Orders</span>
            {pendingOrdersCount > 0 && (
              <span className="nav-pending-badge">{pendingOrdersCount}</span>
            )}
          </button>

          <button
            type="button"
            className="admin-status-pill btn-bale-info-nav"
            onClick={onOpenBaleInfo}
            title="Click to view & edit Common Master Bale Rate"
          >
            <i className="fa-solid fa-cube" style={{ color: '#0284c7' }}></i>
            <span>Bale Info</span>
          </button>

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
