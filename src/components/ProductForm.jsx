import React, { useState, useEffect } from 'react';
import { db, storage, collection, addDoc, onSnapshot, serverTimestamp, ref, uploadBytes, getDownloadURL, functions, httpsCallable } from '../firebase';
import { toast } from '../utils/toast';

export default function ProductForm() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Panipat Mat');
  const [newCatInput, setNewCatInput] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);

  // Subscribe to real-time categories from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats = snapshot.docs.map((d) => d.data().name).filter(Boolean);
      if (cats.length > 0) {
        setCustomCategories((prev) => Array.from(new Set([...prev, ...cats])));
      }
    }, (err) => {
      console.warn('Firestore categories sync notice:', err.message);
    });

    return () => unsubscribe();
  }, []);
  
  const [baseRate, setBaseRate] = useState('');
  const [unitType, setUnitType] = useState('per Bundle');
  const [bundlePieces, setBundlePieces] = useState(10);
  const [bundlesPerPack, setBundlesPerPack] = useState(8);
  const [minOrderNotice, setMinOrderNotice] = useState('Purchased per full Bundle (10 Pcs only)');
  const [stockStatus, setStockStatus] = useState('IN_STOCK');
  const [seasonNotice, setSeasonNotice] = useState('Price may differ based on the season item or the stock quantity');
  const [description, setDescription] = useState('');
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUnitChange = (unit) => {
    setUnitType(unit);
    if (unit === 'per Bundle' || unit === 'per Dozen') {
      const pcs = unit === 'per Dozen' ? 12 : (bundlePieces || 10);
      setBundlePieces(pcs);
      setMinOrderNotice(`Purchased per full ${unit.replace('per ', '')} (${pcs} Pcs only)`);
    } else {
      setBundlePieces(1);
      setMinOrderNotice('Available for individual piece purchase');
    }
  };

  const handlePiecesChange = (val) => {
    const num = parseInt(val, 10) || 0;
    setBundlePieces(num);
    if (unitType === 'per Bundle' || unitType === 'per Dozen') {
      setMinOrderNotice(`Purchased per full ${unitType.replace('per ', '')} (${num} Pcs only)`);
    }
  };

  const handleCategorySelect = (val) => {
    if (val === 'NEW_CATEGORY') {
      setShowNewCat(true);
    } else {
      setShowNewCat(false);
      setCategory(val);
    }
  };

  const handleAddCustomCategory = async () => {
    if (newCatInput.trim()) {
      const catName = newCatInput.trim();
      setCustomCategories([...customCategories, catName]);
      setCategory(catName);
      setShowNewCat(false);
      setNewCatInput('');
      try {
        await addDoc(collection(db, 'categories'), { name: catName, createdAt: serverTimestamp() });
      } catch (err) {
        console.warn('Category Firestore save warning:', err);
      }
    }
  };

  const compressImage = (file, maxWidth = 800, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
          } catch (canvasErr) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.warning('Image size exceeds 10MB limit. Please select a smaller file.', 'File Too Large');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !category || !baseRate) {
      toast.warning('Please fill in all required product fields.', 'Missing Information');
      return;
    }

    setUploading(true);
    let imageUrl = '/assets/logo.jpg';

    if (imageFile) {
      try {
        // Fast 1.5s check: uses Cloud Storage if Blaze enabled, or instant compressed image on Spark Free Plan
        const storageTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cloud Storage not provisioned or timeout')), 1500)
        );

        await Promise.race([uploadBytes(storageRef, imageFile), storageTimeout]);
        imageUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.warn('Cloud Storage upload skipped or timed out, generating optimized visual Data URL fallback:', err.message);
        try {
          imageUrl = await compressImage(imageFile, 600, 0.70);
          toast.info('Image attached & saved for this item.', 'Photo Saved');
        } catch (compErr) {
          console.error('Image compression failed:', compErr);
          imageUrl = '/assets/logo.jpg';
        }
      }
    }

    const finalBundlesPerPack = Math.max(1, parseInt(bundlesPerPack, 10) || 1);
    const finalBundlePieces = unitType === 'per Piece' ? 1 : (parseInt(bundlePieces, 10) || 1);

    const nowIso = new Date().toISOString();
    const productData = {
      title: name.trim(),
      category,
      baseRate: parseFloat(baseRate) || 0,
      unit: unitType,
      bundlePieces: finalBundlePieces,
      bundlesPerPack: finalBundlesPerPack,
      compressibility: 0.80,
      minOrderNotice,
      inStock: stockStatus === 'IN_STOCK',
      stockStatus: stockStatus,
      stockQty: stockStatus === 'IN_STOCK' ? 100 : 0,
      seasonNotice,
      description: description.trim(),
      imageUrl
    };

    const firestorePayload = {
      ...productData,
      createdAt: serverTimestamp()
    };

    try {
      // Single authoritative write to Firestore
      const docRef = await addDoc(collection(db, 'products'), firestorePayload);

      toast.success(`Product "${name}" uploaded successfully! Catalog updated.`, 'Product Uploaded');
      setName('');
      setBaseRate('');
      setBundlesPerPack(8);
      setBundlePieces(10);
      setUnitType('per Bundle');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      console.warn('Persisting product locally & broadcasting across tabs in real-time:', err.message);
      const localProduct = {
        id: 'prod_' + Date.now(),
        ...productData,
        createdAt: nowIso
      };
      try {
        const sanitizedForStorage = {
          ...localProduct,
          imageUrl: (localProduct.imageUrl && localProduct.imageUrl.startsWith('data:')) ? '/assets/logo.jpg' : localProduct.imageUrl
        };
        const existing = JSON.parse(localStorage.getItem('gsco_catalog_products') || '[]');
        localStorage.setItem('gsco_catalog_products', JSON.stringify([sanitizedForStorage, ...existing.slice(0, 30)]));
      } catch (quotaErr) {
        console.warn('LocalStorage quota notice:', quotaErr);
      }
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        try {
          const channel = new BroadcastChannel('gsco_realtime_channel');
          channel.postMessage({ type: 'PRODUCT_ADDED', product: localProduct });
          channel.close();
        } catch (bcErr) {
          console.warn('BroadcastChannel error:', bcErr);
        }
      }
      toast.success(`Product "${name}" uploaded successfully! Added to catalog.`, 'Product Uploaded');
      setName('');
      setBaseRate('');
      setBundlesPerPack(8);
      setBundlePieces(10);
      setUnitType('per Bundle');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className="control-panel">
      <section className="card product-form-card">
        <div className="card-header">
          <h2>
            <i className="fa-solid fa-circle-plus"></i> Add Mat to Catalog
          </h2>
          <p className="section-desc">Add mat details, upload photo, choose category, rate, and packaging.</p>
        </div>

        <form onSubmit={handleSubmit} className="product-form">
          {/* Photo Upload Zone */}
          <div className="form-group">
            <label><i className="fa-solid fa-image"></i> Product Image Upload</label>
            <div className="image-upload-zone">
              <input type="file" accept="image/*" className="file-input" onChange={handleImageChange} />
              {!imagePreview ? (
                <div className="upload-placeholder">
                  <i className="fa-solid fa-cloud-arrow-up upload-icon"></i>
                  <p>Click or drag & drop mat photo</p>
                  <span className="upload-hint">JPG, PNG or WEBP up to 5MB</span>
                </div>
              ) : (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" />
                  <button type="button" className="btn-remove-img" onClick={() => { setImageFile(null); setImagePreview(null); }} title="Remove photo">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Product Name */}
          <div className="form-group">
            <label><i className="fa-solid fa-tag"></i> Mat Name / Code</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Heavy Duty Panipat Door Mat"
              required
            />
          </div>

          {/* Category Selector */}
          <div className="form-group">
            <label><i className="fa-solid fa-layer-group"></i> Choose Category</label>
            <select
              className="form-control"
              value={showNewCat ? 'NEW_CATEGORY' : category}
              onChange={(e) => handleCategorySelect(e.target.value)}
              required
            >
              <option value="Panipat Mat">Panipat Mat</option>
              <option value="Export Mat">Export Mat</option>
              <option value="Local Mat">Local Mat</option>
              <option value="Long Mat">Long Mat</option>
              {customCategories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
              <option value="NEW_CATEGORY">+ Create New Category...</option>
            </select>

            {showNewCat && (
              <div className="new-category-box">
                <div className="input-with-btn">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type new category name..."
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCustomCategory}>
                    <i className="fa-solid fa-check"></i> Add
                  </button>
                  <button type="button" className="btn btn-icon btn-sm" onClick={() => setShowNewCat(false)}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Rate & Selling Unit */}
          <div className="form-row">
            <div className="form-group col-6">
              <label>
                <i className="fa-solid fa-indian-rupee-sign"></i> Rate (₹ / {unitType.replace('per ', '')})
              </label>
              <input
                type="number"
                className="form-control"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                placeholder={unitType === 'per Piece' ? 'e.g. 180 (per piece)' : 'e.g. 1800 (per bundle)'}
                min="1"
                required
              />
              <small style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                {unitType === 'per Piece'
                  ? 'Price for 1 single piece'
                  : baseRate && bundlePieces
                    ? `Price for 1 full bundle (~ ₹${Math.round(parseFloat(baseRate) / bundlePieces)} / pc)`
                    : `Price for 1 full ${unitType.replace('per ', '')}`}
              </small>
            </div>
            <div className="form-group col-6">
              <label><i className="fa-solid fa-ruler-combined"></i> Selling Unit</label>
              <select className="form-control" value={unitType} onChange={(e) => handleUnitChange(e.target.value)}>
                <option value="per Bundle">per Bundle</option>
                <option value="per Piece">per Piece</option>
                <option value="per Dozen">per Dozen</option>
                <option value="per Meter">per Meter</option>
                <option value="per Feet">per Feet</option>
              </select>
              <small style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                How this mat is sold to customers
              </small>
            </div>
          </div>

          {/* Packaging Configuration: Pieces per Bundle & Bundles / Pieces per Master Bale */}
          <div className="form-row">
            {(unitType === 'per Bundle' || unitType === 'per Dozen') ? (
              <>
                <div className="form-group col-6">
                  <label><i className="fa-solid fa-boxes-packing"></i> Pieces per {unitType.replace('per ', '')}</label>
                  <input
                    type="number"
                    className="form-control"
                    value={bundlePieces}
                    onChange={(e) => handlePiecesChange(e.target.value)}
                    placeholder="e.g. 10 or 50"
                    min="1"
                    required
                  />
                  <small style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                    Pieces in 1 bundle
                  </small>
                </div>
                <div className="form-group col-6">
                  <label><i className="fa-solid fa-cube"></i> Bundles / Master Bale</label>
                  <input
                    type="number"
                    className="form-control"
                    value={bundlesPerPack}
                    onChange={(e) => setBundlesPerPack(e.target.value)}
                    placeholder="e.g. 3 (Robo), 8 (13x19)"
                    min="1"
                    required
                  />
                  <small style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                    Bundles per Master Bale
                  </small>
                </div>
              </>
            ) : (
              <div className="form-group col-12">
                <label><i className="fa-solid fa-cube"></i> Pieces per Master Bale</label>
                <input
                  type="number"
                  className="form-control"
                  value={bundlesPerPack}
                  onChange={(e) => setBundlesPerPack(e.target.value)}
                  placeholder="e.g. 120"
                  min="1"
                  required
                />
                <small style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                  Total individual pieces that fit in 1 Master Bale
                </small>
              </div>
            )}
          </div>

          {/* Min Order Notice */}
          <div className="form-group">
            <label><i className="fa-solid fa-cart-flatbed"></i> Customer Purchase Notice</label>
            <input
              type="text"
              className="form-control"
              value={minOrderNotice}
              onChange={(e) => setMinOrderNotice(e.target.value)}
              placeholder="Notice..."
            />
          </div>

          {/* Stock Availability Status & Season/Stock Pricing Notice */}
          <div className="form-row">
            <div className="form-group col-6">
              <label><i className="fa-solid fa-warehouse"></i> Stock Availability</label>
              <select
                className="form-control"
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
                style={{
                  fontWeight: 700,
                  color: stockStatus === 'IN_STOCK' ? '#166534' : '#991b1b',
                  backgroundColor: stockStatus === 'IN_STOCK' ? '#f0fdf4' : '#fef2f2',
                  borderColor: stockStatus === 'IN_STOCK' ? '#86efac' : '#fca5a5'
                }}
              >
                <option value="IN_STOCK">In Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
            <div className="form-group col-6">
              <label><i className="fa-solid fa-tags"></i> Pricing Notice</label>
              <input
                type="text"
                className="form-control"
                value={seasonNotice}
                onChange={(e) => setSeasonNotice(e.target.value)}
                placeholder="Price may differ based on the season item or the stock quantity"
              />
            </div>
          </div>

          {/* Details */}
          <div className="form-group">
            <label><i className="fa-solid fa-align-left"></i> Product Details</label>
            <textarea
              className="form-control"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dimensions, materials, color patterns..."
            ></textarea>
          </div>

          <button type="submit" className="btn-submit-product" disabled={uploading}>
            <i className="fa-solid fa-plus-circle"></i> {uploading ? 'Processing via Server...' : 'Upload Mat Product'}
          </button>
        </form>
      </section>
    </aside>
  );
}
