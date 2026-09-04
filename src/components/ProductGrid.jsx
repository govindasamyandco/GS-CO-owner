import React, { useState, useEffect } from 'react';
import { db, storage, collection, onSnapshot, doc, deleteDoc, updateDoc, ref, uploadBytes, getDownloadURL, functions, httpsCallable } from '../firebase';
import { toast } from '../utils/toast';

export default function ProductGrid({ products }) {
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [firestoreCategories, setFirestoreCategories] = useState([]);

  // Subscribe to real-time categories from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats = snapshot.docs.map((d) => d.data().name).filter(Boolean);
      if (cats.length > 0) {
        setFirestoreCategories(cats);
      }
    }, (err) => {
      console.warn('Firestore categories sync notice:', err.message);
    });

    return () => unsubscribe();
  }, []);
  const [sortOption, setSortOption] = useState('default');
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
    const isCurrentlyInStock = prod.inStock !== false && prod.stockStatus !== 'OUT_OF_STOCK';
    setEditingProduct(prod);
    setEditForm({
      title: prod.title || '',
      category: prod.category || 'Panipat Mat',
      baseRate: prod.baseRate || '',
      unit: prod.unit || 'per Bundle',
      bundlePieces: prod.bundlePieces || 10,
      stockStatus: isCurrentlyInStock ? 'IN_STOCK' : 'OUT_OF_STOCK',
      stockQty: isCurrentlyInStock ? 100 : 0,
      seasonNotice: prod.seasonNotice || 'Price may differ based on the season item or the stock quantity',
      minOrderNotice: prod.minOrderNotice || '',
      description: prod.description || '',
      imageUrl: prod.imageUrl || '/assets/logo.jpg',
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
        await updateDoc(doc(db, 'products', prod.id), updatePayload);
        try {
          const updateProductFunction = httpsCallable(functions, 'updateProduct');
          updateProductFunction({ productId: prod.id, ...updatePayload }).catch(() => {});
        } catch (_) {}
      } catch (dbErr) {
        console.warn('Direct Firestore update error, attempting Cloud Function fallback:', dbErr);
        const updateProductFunction = httpsCallable(functions, 'updateProduct');
        await updateProductFunction({ productId: prod.id, ...updatePayload });
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

  // Quick Toggle Stock Status (In Stock vs Out of Stock)
  const handleToggleStock = async (prod) => {
    const isCurrentlyInStock = prod.inStock !== false && prod.stockStatus !== 'OUT_OF_STOCK';
    const newInStock = !isCurrentlyInStock;
    const newStatus = newInStock ? 'IN_STOCK' : 'OUT_OF_STOCK';

    try {
      const updatePayload = {
        inStock: newInStock,
        stockStatus: newStatus,
        stockQty: newInStock ? 100 : 0
      };

      try {
        await updateDoc(doc(db, 'products', prod.id), updatePayload);
        try {
          const updateProductFunction = httpsCallable(functions, 'updateProduct');
          updateProductFunction({ productId: prod.id, ...updatePayload }).catch(() => {});
        } catch (_) {}
      } catch (dbErr) {
        console.warn('Direct Firestore update error:', dbErr);
      }

      toast.success(`Product "${prod.title}" marked as ${newInStock ? 'In Stock' : 'Out of Stock'}!`, 'Stock Updated');
    } catch (err) {
      console.error('Toggle stock error:', err);
      toast.error('Failed to update stock status: ' + err.message, 'Operation Failed');
    }
  };

  // Save Product Changes (Update with Image & Disabled State)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    setUpdating(true);
    let finalImageUrl = editForm.imageUrl;

    try {
      if (editForm.imageFile) {
        try {
          const imageRef = ref(storage, `product-images/${Date.now()}_${editForm.imageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
          await uploadBytes(imageRef, editForm.imageFile);
          finalImageUrl = await getDownloadURL(imageRef);
        } catch (imgErr) {
          console.warn('Image upload fallback to compressed Data URL:', imgErr);
          try {
            finalImageUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > 800) { h = Math.round((h * 800) / w); w = 800; }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.75));
                  } catch (cErr) { resolve(e.target.result); }
                };
                img.onerror = () => resolve(e.target.result);
                img.src = e.target.result;
              };
              reader.onerror = (rErr) => reject(rErr);
              reader.readAsDataURL(editForm.imageFile);
            });
          } catch (b64Err) {
            finalImageUrl = editForm.imageUrl;
          }
        }
      }

      const isEditInStock = editForm.stockStatus === 'IN_STOCK';
      const updatePayload = {
        title: editForm.title.trim(),
        category: editForm.category.trim(),
        baseRate: parseFloat(editForm.baseRate),
        unit: editForm.unit,
        bundlePieces: parseInt(editForm.bundlePieces) || 0,
        inStock: isEditInStock,
        stockStatus: editForm.stockStatus,
        stockQty: isEditInStock ? 100 : 0,
        seasonNotice: editForm.seasonNotice.trim(),
        minOrderNotice: editForm.minOrderNotice.trim(),
        description: editForm.description.trim(),
        imageUrl: finalImageUrl,
        isDisabled: editForm.isDisabled
      };

      try {
        await updateDoc(doc(db, 'products', editingProduct.id), updatePayload);
        try {
          const updateProductFunction = httpsCallable(functions, 'updateProduct');
          updateProductFunction({ productId: editingProduct.id, ...updatePayload }).catch(() => {});
        } catch (_) {}
      } catch (dbErr) {
        console.warn('Direct Firestore update error, attempting Cloud Function fallback:', dbErr);
        const updateProductFunction = httpsCallable(functions, 'updateProduct');
        await updateProductFunction({ productId: editingProduct.id, ...updatePayload });
      }

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
            await deleteDoc(doc(db, 'products', id));
            try {
              const deleteProductFunction = httpsCallable(functions, 'deleteProduct');
              deleteProductFunction({ productId: id }).catch(() => {});
            } catch (_) {}
          } catch (dbErr) {
            console.warn('Direct Firestore delete error, attempting Cloud Function fallback:', dbErr);
            const deleteProductFunction = httpsCallable(functions, 'deleteProduct');
            await deleteProductFunction({ productId: id });
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

  const baseCategories = [
    { id: 'ALL', label: 'All Products', icon: 'fa-table-cells-large' },
    { id: 'Panipat Mat', label: 'Panipat Mat', icon: 'fa-layer-group' },
    { id: 'Export Mat', label: 'Export Mat', icon: 'fa-globe' },
    { id: 'Local Mat', label: 'Local Mat', icon: 'fa-location-dot' },
    { id: 'Long Mat', label: 'Long Mat', icon: 'fa-pen-ruler' }
  ];

  const customTabs = firestoreCategories
    .filter(catName => !baseCategories.some(b => b.id === catName))
    .map(catName => ({ id: catName, label: catName, icon: 'fa-rug' }));

  const categories = [...baseCategories, ...customTabs];

  // Filter products by category
  const categoryFiltered = products.filter(p => filterCategory === 'ALL' || p.category === filterCategory);

  // Sorting logic: Disabled items ALWAYS move to the LAST; enabled items remain in their actual position!
  const sortedProducts = [...categoryFiltered].sort((a, b) => {
    const aDisabled = !!a.isDisabled;
    const bDisabled = !!b.isDisabled;
    if (aDisabled && !bDisabled) return 1;  // a is disabled, move to last
    if (!aDisabled && bDisabled) return -1; // b is disabled, move to last
    
    if (sortOption === 'price-low') {
      return a.baseRate - b.baseRate;
    } else if (sortOption === 'price-high') {
      return b.baseRate - a.baseRate;
    } else if (sortOption === 'stock') {
      return (b.stockQty || 0) - (a.stockQty || 0);
    }

    const aTime = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
    const bTime = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
    return bTime - aTime;
  });

  return (
    <section className="catalog-section">
      {/* Category Navigation Bar matching Reference Layout */}
      <div className="catalog-nav-bar">
        <div className="category-tabs-group">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`tab-btn-pill ${filterCategory === cat.id ? 'active' : ''}`}
              onClick={() => setFilterCategory(cat.id)}
            >
              <i className={`fa-solid ${cat.icon}`}></i>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Straight-line Section Heading & Modern Sort By */}
      <div className="catalog-section-header-row">
        <h2 className="catalog-section-title">
          {filterCategory === 'ALL' ? 'All Mat Products' : filterCategory} (Admin Management)
        </h2>

        <div className="straight-line-sort-box">
          <label htmlFor="admin-sort-select" className="sort-label">
            <i className="fa-solid fa-arrow-down-short-wide"></i> Sort By:
          </label>
          <select
            id="admin-sort-select"
            className="sort-dropdown-modern"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="default">Default Order</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="stock">Stock Quantity</option>
          </select>
        </div>
      </div>

      <div className="pricing-notice-box">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          <strong>Wholesale Pricing Notice:</strong> Quoted rates are factory standard wholesale rates. Final rates may vary based on order quantity, destination & delivery terms.
        </span>
      </div>

      <div className="product-cards-grid">
        {sortedProducts.length === 0 ? (
          <div className="no-products-box">
            <i className="fa-solid fa-boxes-stacked"></i>
            <h3>No Mat Products Found</h3>
            <p>Upload a product using the form above or on the left.</p>
          </div>
        ) : (
          sortedProducts.map((p) => {
            const isBulkUnit = (p.unit === 'per Bundle' || p.unit === 'per Dozen') && p.bundlePieces > 0;
            const perPieceRate = isBulkUnit ? Math.round(p.baseRate / p.bundlePieces) : 0;
            const isDisabled = !!p.isDisabled;

            return (
              <div
                key={p.id}
                className={`product-card ${isDisabled ? 'product-card-disabled' : ''}`}
              >
                {/* Card Top Bar */}
                <div className="card-top-bar">
                  <span className="card-category-badge">{p.category}</span>
                  {isBulkUnit && (
                    <span className="card-bundle-pill">
                      {p.bundlePieces} Pcs/{p.unit.replace('per ', '')}
                    </span>
                  )}
                  {isDisabled && (
                    <span style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '9999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      <i className="fa-solid fa-ban"></i> Disabled (Moved to Last)
                    </span>
                  )}
                </div>

                {/* Card Main Split */}
                <div className="card-main-split">
                  <div className="card-image-box">
                    <img
                      src={p.imageUrl || '/assets/logo.jpg'}
                      alt={p.title}
                      className="card-product-img"
                      onError={(e) => { e.target.src = '/assets/logo.jpg'; }}
                    />
                  </div>

                  <div className="card-info-col">
                    <h3 className="card-title">{p.title}</h3>
                    <p className="card-desc">{p.description || 'Quality woven mat product.'}</p>

                    <div className="card-tags-list">
                      <div className="card-tag-yellow">
                        <i className="fa-solid fa-box-open"></i>
                        <span>{p.minOrderNotice || (isBulkUnit ? 'Purchased per full Bundle only' : 'Available for purchase')}</span>
                      </div>
                      <div className="card-tag-yellow">
                        <i className="fa-solid fa-circle-info"></i>
                        <span>{p.seasonNotice || 'Price may differ based on quantity & location'}</span>
                      </div>
                    </div>

                    <div className="card-stock-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <i className="fa-solid fa-warehouse"></i>
                        Status: 
                        <strong style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: (p.inStock !== false && p.stockStatus !== 'OUT_OF_STOCK') ? '#dcfce7' : '#fee2e2',
                          color: (p.inStock !== false && p.stockStatus !== 'OUT_OF_STOCK') ? '#166534' : '#991b1b'
                        }}>
                          {(p.inStock !== false && p.stockStatus !== 'OUT_OF_STOCK') ? '🟢 In Stock' : '🔴 Out of Stock'}
                        </strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleStock(p)}
                        title="Click to toggle stock availability"
                        style={{
                          background: (p.inStock !== false && p.stockStatus !== 'OUT_OF_STOCK') ? '#fef2f2' : '#f0fdf4',
                          color: (p.inStock !== false && p.stockStatus !== 'OUT_OF_STOCK') ? '#991b1b' : '#166534',
                          border: `1px solid ${(p.inStock !== false && p.stockStatus !== 'OUT_OF_STOCK') ? '#fca5a5' : '#86efac'}`,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {(p.inStock !== false && p.stockStatus !== 'OUT_OF_STOCK') ? 'Mark Out of Stock' : 'Mark In Stock'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Rate on left, Admin Actions on right */}
                <div className="card-footer-row">
                  <div className="card-rate-col">
                    <span className="card-rate-label">WHOLESALE RATE</span>
                    <div className="card-rate-price">
                      ₹{p.baseRate ? p.baseRate.toLocaleString('en-IN') : 0}
                      <span className="card-rate-unit">/{p.unit ? p.unit.replace('per ', '') : 'Bundle'}</span>
                    </div>
                    {isBulkUnit && (
                      <div className="card-per-pc-hint">(~ ₹{perPieceRate.toLocaleString('en-IN')}/pc)</div>
                    )}
                  </div>

                  <div className="card-admin-actions" style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn-select-pill"
                      style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}
                      onClick={() => handleStartEdit(p)}
                    >
                      <i className="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button
                      type="button"
                      className="btn-select-pill"
                      style={{
                        background: isDisabled ? '#16a34a' : '#d97706',
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.82rem'
                      }}
                      onClick={() => handleToggleDisabled(p)}
                      title={isDisabled ? 'Enable product and restore actual position' : 'Disable product and move to last'}
                    >
                      <i className={`fa-solid ${isDisabled ? 'fa-eye' : 'fa-eye-slash'}`}></i> {isDisabled ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      type="button"
                      className="btn-select-pill"
                      style={{ background: '#ef4444', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
                      onClick={() => handleDelete(p.id, p.title)}
                    >
                      <i className="fa-solid fa-trash"></i>
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
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(8px)',
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
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--brand-navy)', fontSize: '1.25rem', fontWeight: 800, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--brand-gold)', marginRight: '0.5rem' }}></i>
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
                  src={editForm.imagePreview || editForm.imageUrl || '/assets/logo.jpg'}
                  alt="Product preview"
                  style={{
                    width: '75px',
                    height: '75px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff'
                  }}
                  onError={(e) => { e.target.src = '/assets/logo.jpg'; }}
                />
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem', color: 'var(--brand-navy)' }}>
                    <i className="fa-solid fa-image" style={{ color: 'var(--brand-gold)', marginRight: '0.3rem' }}></i>
                    Product Photo (Edit / Replace Image)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Disable / Enable Toggle */}
              <div style={{
                background: editForm.isDisabled ? '#fef2f2' : '#eff6ff',
                border: `1.5px solid ${editForm.isDisabled ? '#fca5a5' : '#bfdbfe'}`,
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: editForm.isDisabled ? '#991b1b' : 'var(--brand-navy)', display: 'block' }}>
                    <i className={`fa-solid ${editForm.isDisabled ? 'fa-ban' : 'fa-circle-check'}`} style={{ marginRight: '0.4rem' }}></i>
                    Product Status: {editForm.isDisabled ? 'Disabled (Moves to Last)' : 'Active (Actual Position)'}
                  </strong>
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

              <div className="form-group-custom" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Mat Name / Title</label>
                <input
                  type="text"
                  className="form-control-custom"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Category</label>
                  <select
                    className="form-control-custom"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    <option value="Panipat Mat">Panipat Mat</option>
                    <option value="Export Mat">Export Mat</option>
                    <option value="Local Mat">Local Mat</option>
                    <option value="Long Mat">Long Mat</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Base Rate (₹)</label>
                  <input
                    type="number"
                    className="form-control-custom"
                    value={editForm.baseRate}
                    onChange={(e) => setEditForm({ ...editForm, baseRate: e.target.value })}
                    required
                    min="1"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Rate Unit</label>
                  <select
                    className="form-control-custom"
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  >
                    <option value="per Bundle">per Bundle</option>
                    <option value="per Dozen">per Dozen</option>
                    <option value="per Piece">per Piece</option>
                    <option value="per Meter">per Meter</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Stock Availability</label>
                  <select
                    className="form-control-custom"
                    value={editForm.stockStatus || 'IN_STOCK'}
                    onChange={(e) => setEditForm({ ...editForm, stockStatus: e.target.value })}
                    style={{
                      fontWeight: 700,
                      color: editForm.stockStatus === 'IN_STOCK' ? '#166534' : '#991b1b',
                      backgroundColor: editForm.stockStatus === 'IN_STOCK' ? '#f0fdf4' : '#fef2f2'
                    }}
                  >
                    <option value="IN_STOCK">🟢 In Stock</option>
                    <option value="OUT_OF_STOCK">🔴 Out of Stock</option>
                  </select>
                </div>
              </div>

              <div className="form-group-custom" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#b45309', display: 'block', marginBottom: '0.3rem' }}>
                  <i className="fa-solid fa-tags"></i> Season & Stock Price Notice
                </label>
                <input
                  type="text"
                  className="form-control-custom"
                  value={editForm.seasonNotice}
                  onChange={(e) => setEditForm({ ...editForm, seasonNotice: e.target.value })}
                />
              </div>

              <div className="form-group-custom" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Purchase Rule Notice</label>
                <input
                  type="text"
                  className="form-control-custom"
                  value={editForm.minOrderNotice}
                  onChange={(e) => setEditForm({ ...editForm, minOrderNotice: e.target.value })}
                />
              </div>

              <div className="form-group-custom" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Description</label>
                <textarea
                  className="form-control-custom"
                  rows="2"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: '9999px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-select-pill"
                >
                  <i className="fa-solid fa-check"></i> {updating ? 'Saving...' : 'Save Product Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
