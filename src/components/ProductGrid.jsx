import React, { useState } from 'react';
import { db, doc, deleteDoc } from '../firebase';

export default function ProductGrid({ products }) {
  const [filterCategory, setFilterCategory] = useState('ALL');

  const handleDelete = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete "${title}" from Firebase?`)) {
      try {
        await deleteDoc(doc(db, 'products', id));
        alert(`Product "${title}" deleted from Firebase!`);
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete product: ' + err.message);
      }
    }
  };

  const filteredProducts = products.filter(p => filterCategory === 'ALL' || p.category === filterCategory);

  return (
    <section className="catalog-section">
      <div className="catalog-header card">
        <div>
          <h2><i className="fa-solid fa-border-all"></i> Mat Products Catalog</h2>
          <p>All mat products displayed with clear customer purchase rules (Bundle / Dozen / Piece).</p>
        </div>
        <div className="catalog-filters">
          <select
            className="filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="Panipat Mat">Panipat Mat</option>
            <option value="Export Mat">Export Mat</option>
            <option value="Local Mat">Local Mat</option>
            <option value="Long Mat">Long Mat</option>
          </select>
        </div>
      </div>

      <div className="product-grid">
        {filteredProducts.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <i className="fa-solid fa-folder-open" style={{ fontSize: '3rem', color: 'var(--brand-emerald)', marginBottom: '1rem' }}></i>
            <h3>No Mat Products Found</h3>
            <p>Upload a product using the form on the left.</p>
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isBulkUnit = (p.unit === 'per Bundle' || p.unit === 'per Dozen') && p.bundlePieces > 0;
            const perPieceRate = isBulkUnit ? Math.round(p.baseRate / p.bundlePieces) : 0;

            return (
              <div key={p.id} className="product-card">
                <div className="card-img-wrapper">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="card-img"
                    onError={(e) => { e.target.src = '/public/assets/logo.jpg'; }}
                  />
                  <span className="category-tag">{p.category}</span>
                  {isBulkUnit && (
                    <span className="bundle-badge">
                      <i className="fa-solid fa-boxes-packing"></i> {p.bundlePieces} Pcs / {p.unit.replace('per ', '')}
                    </span>
                  )}
                </div>

                <div className="card-body">
                  <h3 className="product-title">{p.title}</h3>
                  <p className="product-details">{p.description || 'Quality woven mat product.'}</p>

                  <div className="purchase-rule-box">
                    <i className="fa-solid fa-circle-info"></i>
                    <span>{p.minOrderNotice || 'Available for purchase'}</span>
                  </div>

                  <div className="price-box">
                    <div>
                      <span className="rate-label">Rate</span>
                      <div className="rate-value">
                        ₹{p.baseRate ? p.baseRate.toLocaleString('en-IN') : 0} <span className="unit-label">/{p.unit ? p.unit.replace('per ', '') : ''}</span>
                      </div>
                      {isBulkUnit && (
                        <div className="piece-rate-hint">(~ ₹{perPieceRate.toLocaleString('en-IN')} / pc)</div>
                      )}
                    </div>
                  </div>

                  <div className="card-actions">
                    <button className="btn-action btn-delete" onClick={() => handleDelete(p.id, p.title)}>
                      <i className="fa-solid fa-trash"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
