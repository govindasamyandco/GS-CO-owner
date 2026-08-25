import React, { useState } from 'react';
import { db, storage, collection, addDoc, serverTimestamp, ref, uploadBytes, getDownloadURL } from '../firebase';

export default function ProductForm() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Panipat Mat');
  const [newCatInput, setNewCatInput] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  
  const [baseRate, setBaseRate] = useState('');
  const [unitType, setUnitType] = useState('per Bundle');
  const [bundlePieces, setBundlePieces] = useState(10);
  const [minOrderNotice, setMinOrderNotice] = useState('Purchased per full Bundle (10 Pcs only)');
  const [description, setDescription] = useState('');
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUnitChange = (unit) => {
    setUnitType(unit);
    if (unit === 'per Bundle' || unit === 'per Dozen') {
      const pcs = unit === 'per Dozen' ? 12 : 10;
      setBundlePieces(pcs);
      setMinOrderNotice(`Purchased per full ${unit.replace('per ', '')} (${pcs} Pcs only)`);
    } else {
      setBundlePieces(0);
      setMinOrderNotice('Available for individual piece purchase');
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

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !category || !baseRate) {
      alert('Please fill in all required product fields.');
      return;
    }

    setUploading(true);
    let imageUrl = 'public/assets/logo.jpg';

    if (imageFile) {
      try {
        const storageRef = ref(storage, `product-images/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.warn('Storage upload fallback:', err);
        imageUrl = imagePreview || 'public/assets/logo.jpg';
      }
    }

    let bundlesPerPack = 8;
    if (category === 'Export Mat') bundlesPerPack = 10;
    if (category === 'Long Mat') bundlesPerPack = 4;
    if (category === 'Local Mat') bundlesPerPack = 50;

    const newProduct = {
      title: name,
      category,
      baseRate: parseFloat(baseRate),
      unit: unitType,
      bundlePieces: parseInt(bundlePieces) || 0,
      bundlesPerPack,
      compressibility: 0.80,
      minOrderNotice,
      description,
      imageUrl,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'products'), newProduct);
      alert(`Product "${name}" uploaded successfully to Firebase!`);
      // Reset Form
      setName('');
      setBaseRate('');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      console.error('Error adding product:', err);
      alert('Failed to upload product: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className="control-panel">
      <section className="card product-form-card">
        <div className="card-header">
          <h2><i className="fa-solid fa-circle-plus"></i> Upload New Mat Product</h2>
          <p className="section-desc">Add mat details, upload photo, choose category, rate, and purchase conditions.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Image Upload Area */}
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
                  <button type="button" className="btn-remove-img" onClick={() => { setImageFile(null); setImagePreview(null); }}>
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

          {/* Rate & Unit */}
          <div className="form-row">
            <div className="form-group col-6">
              <label><i className="fa-solid fa-indian-rupee-sign"></i> Rate (₹)</label>
              <input
                type="number"
                className="form-control"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                placeholder="e.g. 1800"
                min="1"
                required
              />
            </div>
            <div className="form-group col-6">
              <label><i className="fa-solid fa-ruler-combined"></i> Rate Unit</label>
              <select className="form-control" value={unitType} onChange={(e) => handleUnitChange(e.target.value)}>
                <option value="per Piece">per Piece</option>
                <option value="per Bundle">per Bundle</option>
                <option value="per Dozen">per Dozen</option>
                <option value="per Meter">per Meter</option>
                <option value="per Feet">per Feet</option>
              </select>
            </div>
          </div>

          {/* Pieces Count */}
          {(unitType === 'per Bundle' || unitType === 'per Dozen') && (
            <div className="form-group">
              <label><i className="fa-solid fa-boxes-packing"></i> Pieces per {unitType.replace('per ', '')}</label>
              <input
                type="number"
                className="form-control"
                value={bundlePieces}
                onChange={(e) => setBundlePieces(e.target.value)}
                placeholder="10"
                min="1"
              />
            </div>
          )}

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

          <button type="submit" className="btn btn-primary btn-block" disabled={uploading}>
            <i className="fa-solid fa-plus-circle"></i> {uploading ? 'Uploading to Firebase...' : 'Upload Mat Product'}
          </button>
        </form>
      </section>
    </aside>
  );
}
