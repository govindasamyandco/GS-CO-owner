import React, { useState } from 'react';
import { db, storage, doc, deleteDoc, updateDoc, ref, uploadBytes, getDownloadURL, functions, httpsCallable } from '../firebase';
import { toast } from '../utils/toast';

export default function ProductGrid({ products }) {
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    category: 'Panipat Mat',
    baseRate: '',
    unit: 'per Bundle',
    bundlePieces: 10,
    stockQty: 100,
    seasonNotice: 'Price may differ based on the season item or the stock quantity',
    minOrderNotice: '',
    description: '',
    imageUrl: '',
    imageFile: null,
    imagePreview: null,
    isDisabled: false
  });
  const [updating, setUpdating] = useState(false);

  // Open Edit Modal with Image & Disabled State
  const handleStartEdit = (prod) => {
    setEditingProduct(prod);
    setEditForm({
      title: prod.title || '',
      category: prod.category || 'Panipat Mat',
      baseRate: prod.baseRate || '',
      unit: prod.unit || 'per Bundle',
      bundlePieces: prod.bundlePieces || 10,
      stockQty: prod.stockQty !== undefined ? prod.stockQty : 100,
      seasonNotice: prod.seasonNotice || 'Price may differ based on the season item or the stock quantity',
      minOrderNotice: prod.minOrderNotice || '',
      description: prod.description || '',
      imageUrl: prod.imageUrl || '/public/assets/logo.jpg',
      imageFile: null,
      imagePreview: null,
      isDisabled: !!prod.isDisabled
    });
  };

  // Handle New Image Selection inside Edit Modal
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.warning('Please select a valid image file (JPG, PNG, WEBP).', 'Invalid Image');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('Image file size must be less than 5MB.', 'File Too Large');
        return;
      }
      setEditForm(prev => ({
        ...prev,
        imageFile: file,
        imagePreview: URL.createObjectURL(file)
      }));
    }
  };

  // Quick Toggle Disabled State (Move to last when disabled, restore actual position when enabled)
  const handleToggleDisabled = async (prod) => {
    const newDisabled = !prod.isDisabled;
    const actionText = newDisabled ? 'disable' : 'enable';
    
    try {
      const updatePayload = { isDisabled: newDisabled };

      try {
        const updateProductFunction = httpsCallable(functions, 'updateProduct');
        await updateProductFunction({ productId: prod.id, ...updatePayload });
      } catch (funcErr) {
        console.warn('Cloud Function fallback to Firestore updateDoc:', funcErr);
        await updateDoc(doc(db, 'products', prod.id), updatePayload);
      }

      // Update local storage & broadcast channel
      const cached = JSON.parse(localStorage.getItem('gsco_catalog_products') || '[]');
      const updatedList = cached.map(p => p.id === prod.id ? { ...p, ...updatePayload } : p);
      localStorage.setItem('gsco_catalog_products', JSON.stringify(updatedList));

      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const channel = new BroadcastChannel('gsco_realtime_channel');
        channel.postMessage({
          type: 'PRODUCT_UPDATED',
          product: { id: prod.id, ...updatePayload }
        });
        channel.close();
      }

      toast.success(`Product "${prod.title}" ${newDisabled ? 'disabled and moved to last' : 'enabled and restored to actual position'}!`, 'Catalog Updated');
    } catch (err) {
      console.error('Toggle disable error:', err);
      toast.error(`Failed to ${actionText} product: ` + err.message, 'Operation Failed');
    }
  };

  // Save Product Changes (Update with Image & Disabled State)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    setUpdating(true);
    let finalImageUrl = editForm.imageUrl;

    try {
      // 1. Upload new image if selected
      if (editForm.imageFile) {
        try {
          const imageRef = ref(storage, `product-images/${Date.now()}_${editForm.imageFile.name}`);
          await uploadBytes(imageRef, editForm.imageFile);
          finalImageUrl = await getDownloadURL(imageRef);
        } catch (imgErr) {
          console.warn('Image upload fallback to preview/local:', imgErr);
          finalImageUrl = editForm.imagePreview || editForm.imageUrl;
        }
      }

      const updatePayload = {
        title: editForm.title.trim(),
        category: editForm.category.trim(),
        baseRate: parseFloat(editForm.baseRate),
        unit: editForm.unit,
        bundlePieces: parseInt(editForm.bundlePieces) || 0,
        stockQty: parseInt(editForm.stockQty) || 0,
        seasonNotice: editForm.seasonNotice.trim(),
        minOrderNotice: editForm.minOrderNotice.trim(),
        description: editForm.description.trim(),
        imageUrl: finalImageUrl,
        isDisabled: editForm.isDisabled
      };

      try {
        const updateProductFunction = httpsCallable(functions, 'updateProduct');
        await updateProductFunction({ productId: editingProduct.id, ...updatePayload });
      } catch (funcErr) {
        console.warn('Cloud Function fallback to Firestore updateDoc:', funcErr);
        await updateDoc(doc(db, 'products', editingProduct.id), updatePayload);
      }

      // Update local storage cache & broadcast
      const cached = JSON.parse(localStorage.getItem('gsco_catalog_products') || '[]');
      const updatedList = cached.map(p => p.id === editingProduct.id ? { ...p, ...updatePayload } : p);
      localStorage.setItem('gsco_catalog_products', JSON.stringify(updatedList));

      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const channel = new BroadcastChannel('gsco_realtime_channel');
        channel.postMessage({
          type: 'PRODUCT_UPDATED',
          product: { id: editingProduct.id, ...updatePayload }
        });
        channel.close();
      }

      toast.success(`Product "${updatePayload.title}" updated successfully!`, 'Product Updated');
      setEditingProduct(null);
    } catch (err) {
      console.error('Update error:', err);
      toast.error('Failed to update product: ' + err.message, 'Update Failed');
    } finally {
      setUpdating(false);
    }
  };

  // Modern Confirmation Delete Product
  const handleDelete = (id, title) => {
    toast.confirm({
      title: 'Delete Mat Product?',
      message: `Are you sure you want to permanently delete "${title}"? This will remove it from the live catalog.`,
      confirmText: 'Yes, Delete Product',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          try {
            const deleteProductFunction = httpsCallable(functions, 'deleteProduct');
            await deleteProductFunction({ productId: id });
          } catch (funcErr) {
            console.warn('Cloud Function fallback to Firestore deleteDoc:', funcErr);
            await deleteDoc(doc(db, 'products', id));
          }

          const cached = JSON.parse(localStorage.getItem('gsco_catalog_products') || '[]');
          const updatedList = cached.filter(p => p.id !== id);
          localStorage.setItem('gsco_catalog_products', JSON.stringify(updatedList));

          if (typeof window !== 'undefined' && window.BroadcastChannel) {
            const channel = new BroadcastChannel('gsco_realtime_channel');
            channel.postMessage({ type: 'PRODUCT_DELETED', productId: id });
            channel.close();
          }

          toast.success(`Product "${title}" deleted successfully!`, 'Product Deleted');
        } catch (err) {
          console.error('Delete error:', err);
          toast.error('Failed to delete product: ' + err.message, 'Delete Failed');
        }
      }
    });
  };

  // Filter products by category
  const categoryFiltered = products.filter(p => filterCategory === 'ALL' || p.category === filterCategory);

  // Sorting logic: Disabled items ALWAYS move to the LAST; enabled items remain in their actual position!
  const sortedProducts = [...categoryFiltered].sort((a, b) => {
    const aDisabled = !!a.isDisabled;
    const bDisabled = !!b.isDisabled;
    if (aDisabled && !bDisabled) return 1;  // a is disabled, move to last
    if (!aDisabled && bDisabled) return -1; // b is disabled, move to last
    
    // In same disabled state, maintain actual order by creation time
    const aTime = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
    const bTime = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
    return bTime - aTime;
  });

  return (
    <section className="catalog-section">
      <div className="catalog-header card">
        <div>
          <h2><i className="fa-solid fa-border-all"></i> Mat Products Catalog</h2>
          <p>Manage, Edit, Update Rates, Stock Quantities & Seasonal Notices.</p>
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
        {sortedProducts.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <i className="fa-solid fa-folder-open" style={{ fontSize: '3rem', color: 'var(--brand-emerald)', marginBottom: '1rem' }}></i>
            <h3>No Mat Products Found</h3>
            <p>Upload a product using the form on the left.</p>
          </div>
        ) : (
          sortedProducts.map((p) => {
            const isBulkUnit = (p.unit === 'per Bundle' || p.unit === 'per Dozen') && p.bundlePieces > 0;
            const perPieceRate = isBulkUnit ? Math.round(p.baseRate / p.bundlePieces) : 0;
            const isDisabled = !!p.isDisabled;

            return (
              <div
                key={p.id}
                className="product-card"
                style={{
                  opacity: isDisabled ? 0.72 : 1,
                  filter: isDisabled ? 'grayscale(35%)' : 'none',
                  border: isDisabled ? '1.5px dashed #94a3b8' : undefined,
                  borderTop: isDisabled ? '3.5px solid #64748b' : undefined,
                  transition: 'all 0.3s ease'
                }}
              >
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
                  {isDisabled && (
                    <span style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.35rem 0.75rem',
                      borderRadius: '20px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      zIndex: 5
                    }}>
                      <i className="fa-solid fa-ban"></i> Disabled (Moved to Last)
                    </span>
                  )}
                </div>

                <div className="card-body">
                  <h3 className="product-title" style={{ color: isDisabled ? '#64748b' : undefined }}>
                    {p.title}
                  </h3>
                  <p className="product-details">{p.description || 'Quality woven mat product.'}</p>

                  <div className="purchase-rule-box">
                    <i className="fa-solid fa-circle-info"></i>
                    <span>{p.minOrderNotice || 'Available for purchase'}</span>
                  </div>

                  {/* Stock & Seasonal Info Display */}
                  <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '0.6rem 0', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: 'var(--brand-navy)', fontWeight: 600 }}>
                      <span><i className="fa-solid fa-warehouse"></i> Stock: {p.stockQty !== undefined ? `${p.stockQty} Bundles` : 'In Stock'}</span>
                      {isDisabled && <span style={{ color: '#ef4444' }}>Status: Disabled</span>}
                    </div>
                    <div style={{ color: '#b45309', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <i className="fa-solid fa-tags" style={{ fontSize: '0.75rem' }}></i>
                      <span>{p.seasonNotice || 'Price may differ based on the season item or the stock quantity'}</span>
                    </div>
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

                  {/* Card Action Buttons: Edit, Toggle Disable, Delete */}
                  <div className="card-actions" style={{ display: 'flex', gap: '0.4rem', marginTop: '0.8rem' }}>
                    <button
                      type="button"
                      className="btn-action"
                      style={{ flex: 1.2, background: 'var(--brand-navy)', color: '#fff', padding: '0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}
                      onClick={() => handleStartEdit(p)}
                    >
                      <i className="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button
                      type="button"
                      className="btn-action"
                      style={{
                        flex: 1.2,
                        background: isDisabled ? '#16a34a' : '#d97706',
                        color: '#fff',
                        padding: '0.45rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.82rem'
                      }}
                      onClick={() => handleToggleDisabled(p)}
                      title={isDisabled ? 'Enable product and restore actual position' : 'Disable product and move to last'}
                    >
                      <i className={`fa-solid ${isDisabled ? 'fa-eye' : 'fa-eye-slash'}`}></i> {isDisabled ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      type="button"
                      className="btn-action btn-delete"
                      style={{ flex: 1, padding: '0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}
                      onClick={() => handleDelete(p.id, p.title)}
                    >
                      <i className="fa-solid fa-trash"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '580px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--brand-navy)', fontSize: '1.2rem', margin: 0 }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--brand-emerald)', marginRight: '0.5rem' }}></i>
                Edit Mat Product
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              {/* Image in Edit Option */}
              <div style={{
                background: '#f8fafc',
                padding: '0.85rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <img
                  src={editForm.imagePreview || editForm.imageUrl || '/public/assets/logo.jpg'}
                  alt="Product preview"
                  style={{
                    width: '75px',
                    height: '75px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1'
                  }}
                  onError={(e) => { e.target.src = '/public/assets/logo.jpg'; }}
                />
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem', color: 'var(--brand-navy)' }}>
                    <i className="fa-solid fa-image" style={{ color: 'var(--brand-emerald)', marginRight: '0.3rem' }}></i>
                    Product Photo (Edit / Replace Image)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ fontSize: '0.82rem', width: '100%' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                    Select new image to replace current photo (JPG, PNG, WEBP)
                  </span>
                </div>
              </div>

              {/* Disable / Enable Toggle in Edit Modal */}
              <div style={{
                background: editForm.isDisabled ? '#fef2f2' : '#f0fdf4',
                border: `1.5px solid ${editForm.isDisabled ? '#fca5a5' : '#86efac'}`,
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: editForm.isDisabled ? '#991b1b' : '#166534', display: 'block' }}>
                    <i className={`fa-solid ${editForm.isDisabled ? 'fa-ban' : 'fa-circle-check'}`} style={{ marginRight: '0.4rem' }}></i>
                    Product Status: {editForm.isDisabled ? 'Disabled (Moves to Last)' : 'Active (Actual Position)'}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: editForm.isDisabled ? '#b91c1c' : '#15803d' }}>
                    {editForm.isDisabled ? 'Item is placed at the end of catalog.' : 'Item is displayed in normal catalog position.'}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={editForm.isDisabled}
                    onChange={(e) => setEditForm({ ...editForm, isDisabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  Disable
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mat Name / Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Category</label>
                  <select
                    className="form-control"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    <option value="Panipat Mat">Panipat Mat</option>
                    <option value="Export Mat">Export Mat</option>
                    <option value="Local Mat">Local Mat</option>
                    <option value="Long Mat">Long Mat</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Base Rate (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.baseRate}
                    onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })}
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rate Unit</label>
                  <select
                    className="form-control"
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  >
                    <option value="per Bundle">per Bundle</option>
                    <option value="per Dozen">per Dozen</option>
                    <option value="per Piece">per Piece</option>
                    <option value="per Meter">per Meter</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Available Stock Qty</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.stockQty}
                    onChange={(e) => setEditForm({ ...editForm, stockQty: e.target.value })}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#b45309' }}>
                  <i className="fa-solid fa-tags"></i> Season & Stock Price Notice (Notice for Customers)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.seasonNotice}
                  onChange={(e) => setEditForm({ ...editForm, seasonNotice: e.target.value })}
                  placeholder="Price may differ based on the season item or the stock quantity"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Purchase Rule Notice</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.minOrderNotice}
                  onChange={(e) => setEditForm({ ...editForm, minOrderNotice: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Description</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingProduct(null)}
                  style={{ padding: '0.6rem 1.2rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updating}
                  style={{ padding: '0.6rem 1.4rem' }}
                >
                  <i className="fa-solid fa-check"></i> {updating ? 'Saving Changes...' : 'Save Product Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
