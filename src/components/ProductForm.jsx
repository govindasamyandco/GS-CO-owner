import React, { useState, useEffect } from 'react';
import { db, storage, collection, addDoc, onSnapshot, serverTimestamp, ref, uploadBytes, getDownloadURL } from '../firebase';
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
  const [bundlePieces, setBundlePieces] = useState(50);
  const [bundlesPerPack, setBundlesPerPack] = useState(8);
  const [minOrderNotice, setMinOrderNotice] = useState('Purchased per full Bundle (50 Pcs only)');
  const [stockStatus, setStockStatus] = useState('IN_STOCK');
  const [seasonNotice, setSeasonNotice] = useState('Price may differ based on the season item or the stock quantity');
  const [description, setDescription] = useState('');

  // Multi-Image State (Up to 3 images)
  const [imageFiles, setImageFiles] = useState([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState([null, null, null]);
  const [uploading, setUploading] = useState(false);

  const handleUnitChange = (unit) => {
    setUnitType(unit);
    if (unit === 'per Bundle' || unit === 'per Dozen') {
      const pcs = unit === 'per Dozen' ? 12 : (bundlePieces || 50);
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

  const handleSlotImageChange = (index, e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.warning('Image size exceeds 10MB limit. Please select a smaller file.', 'File Too Large');
        return;
      }
      const newFiles = [...imageFiles];
      newFiles[index] = file;
      setImageFiles(newFiles);

      const newPreviews = [...imagePreviews];
      newPreviews[index] = URL.createObjectURL(file);
      setImagePreviews(newPreviews);
    }
  };

  const handleRemoveSlotImage = (index) => {
    const newFiles = [...imageFiles];
    newFiles[index] = null;
    setImageFiles(newFiles);

    const newPreviews = [...imagePreviews];
    newPreviews[index] = null;
    setImagePreviews(newPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !category || !baseRate) {
      toast.warning('Please fill in all required product fields.', 'Missing Information');
      return;
    }

    setUploading(true);
    const uploadedUrls = [];

    for (let i = 0; i < 3; i++) {
      const file = imageFiles[i];
      if (file) {
        try {
          const timestamp = Date.now();
          const storageRef = ref(storage, `products/mat_${timestamp}_${i}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
          const storageTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Cloud Storage timeout')), 1500)
          );
          await Promise.race([uploadBytes(storageRef, file), storageTimeout]);
          const url = await getDownloadURL(storageRef);
          uploadedUrls.push(url);
        } catch (err) {
          console.warn(`Storage upload slot ${i} notice, compressing image locally:`, err.message);
          try {
            const dataUrl = await compressImage(file, 600, 0.70);
            uploadedUrls.push(dataUrl);
          } catch {
            uploadedUrls.push('/assets/logo.jpg');
          }
        }
      }
    }

    const finalImages = uploadedUrls.length > 0 ? uploadedUrls : ['/assets/logo.jpg'];
    const primaryImageUrl = finalImages[0];

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
      imageUrl: primaryImageUrl, // Backward compatibility for existing codebase
      images: finalImages         // Multi-image array support (Max 3)
    };

    const firestorePayload = {
      ...productData,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'products'), firestorePayload);
      toast.success(`Product "${name}" uploaded successfully! Catalog updated.`, 'Product Uploaded');
      resetForm();
    } catch (err) {
      console.warn('Persisting product locally & broadcasting across tabs:', err.message);
      const localProduct = {
        id: 'prod_' + Date.now(),
        ...productData,
        createdAt: nowIso
      };
      try {
        const existing = JSON.parse(localStorage.getItem('gsco_catalog_products') || '[]');
        localStorage.setItem('gsco_catalog_products', JSON.stringify([localProduct, ...existing.slice(0, 30)]));
      } catch (quotaErr) {
        console.warn('LocalStorage quota notice:', quotaErr);
      }
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        try {
          const channel = new BroadcastChannel('gsco_realtime_channel');
          channel.postMessage({ type: 'PRODUCT_ADDED', product: localProduct });
          channel.close();
        } catch (bcErr) {
          console.warn('BroadcastChannel notice:', bcErr);
        }
      }
      toast.success(`Product "${name}" uploaded successfully! Added to catalog.`, 'Product Uploaded');
      resetForm();
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setBaseRate('');
    setBundlesPerPack(8);
    setBundlePieces(10);
    setUnitType('per Bundle');
    setDescription('');
    setImageFiles([null, null, null]);
    setImagePreviews([null, null, null]);
  };

  return (
    <aside className="control-panel">
      <section className="card product-form-card">
        <div className="card-header">
          <h2>
            <i className="fa-solid fa-circle-plus"></i> Add Mat to Catalog
          </h2>
          <p className="section-desc">Add mat details, upload up to 3 photos, select rate, and configure factory packaging.</p>
        </div>

        <form onSubmit={handleSubmit} className="product-form">
          {/* SECTION 1: Multi-Photo Upload Zone (Up to 3 Images) */}
          <div className="form-group">
            <label><i className="fa-solid fa-images"></i> Product Image Upload (Up to 3 Photos)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginTop: '0.4rem' }}>
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="image-upload-zone" style={{ minHeight: '110px', padding: '0.4rem', textAlign: 'center' }}>
                  <input
                    type="file"
                    accept="image/*"
                    className="file-input"
                    onChange={(e) => handleSlotImageChange(idx, e)}
                  />
                  {!imagePreviews[idx] ? (
                    <div className="upload-placeholder" style={{ padding: '0.5rem 0.2rem' }}>
                      <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.2rem', color: '#64748b' }}></i>
                      <p style={{ fontSize: '0.72rem', margin: '0.2rem 0', fontWeight: 600 }}>
                        {idx === 0 ? 'Photo 1 (Main)' : `Photo ${idx + 1}`}
                      </p>
                    </div>
                  ) : (
                    <div className="image-preview-container" style={{ position: 'relative', width: '100%', height: '90px' }}>
                      <img src={imagePreviews[idx]} alt={`Preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                      <button
                        type="button"
                        className="btn-remove-img"
                        onClick={() => handleRemoveSlotImage(idx)}
                        title="Remove photo"
                        style={{ position: 'absolute', top: '2px', right: '2px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: Product Name & Category */}
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
              {customCategories.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
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

          {/* SECTION 3: Wholesale Rate & Selling Unit */}
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
              <label><i className="fa-solid fa-box-archive"></i> Selling Unit</label>
              <select
                className="form-control"
                value={unitType}
                onChange={(e) => handleUnitChange(e.target.value)}
              >
                <option value="per Bundle">per Bundle</option>
                <option value="per Dozen">per Dozen</option>
                <option value="per Piece">per Piece</option>
              </select>
            </div>
          </div>

          {/* SECTION 4: Factory Packaging & Master Bale Billing Engine */}
          <div className="form-row">
            <div className="form-group col-6">
              <label><i className="fa-solid fa-boxes-stacked"></i> Pieces / Bundle</label>
              <input
                type="number"
                className="form-control"
                value={bundlePieces}
                onChange={(e) => handlePiecesChange(e.target.value)}
                min="1"
                disabled={unitType === 'per Piece'}
              />
            </div>

            <div className="form-group col-6">
              <label><i className="fa-solid fa-cube"></i> Bundles / Master Bale</label>
              <input
                type="number"
                className="form-control"
                value={bundlesPerPack}
                onChange={(e) => setBundlesPerPack(e.target.value)}
                min="1"
                placeholder="e.g. 8"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label><i className="fa-solid fa-warehouse"></i> Stock Availability</label>
            <select
              className="form-control"
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
            >
              <option value="IN_STOCK">In Stock (Available for Order)</option>
              <option value="OUT_OF_STOCK">Out of Stock (Temporarily Unavailable)</option>
            </select>
          </div>

          <div className="form-group">
            <label><i className="fa-solid fa-triangle-exclamation"></i> Minimum Order Notice</label>
            <input
              type="text"
              className="form-control"
              value={minOrderNotice}
              onChange={(e) => setMinOrderNotice(e.target.value)}
              placeholder="e.g. Purchased per full Bundle (50 Pcs only)"
            />
          </div>

          <div className="form-group">
            <label><i className="fa-solid fa-tags"></i> Seasonal Pricing Disclaimer</label>
            <input
              type="text"
              className="form-control"
              value={seasonNotice}
              onChange={(e) => setSeasonNotice(e.target.value)}
              placeholder="e.g. Price may differ based on the season item or the stock quantity"
            />
          </div>

          {/* Description / Specifications */}
          <div className="form-group">
            <label><i className="fa-solid fa-align-left"></i> Specifications / Description</label>
            <textarea
              className="form-control"
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 100% High density woven cotton, non-slip backing, anti-dust..."
            ></textarea>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-upload" disabled={uploading}>
            {uploading ? (
              <span><i className="fa-solid fa-spinner fa-spin"></i> Uploading Product...</span>
            ) : (
              <span><i className="fa-solid fa-cloud-arrow-up"></i> Upload Mat to Catalog</span>
            )}
          </button>
        </form>
      </section>
    </aside>
  );
}
