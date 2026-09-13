import React, { useState, useEffect } from 'react';
import { db, doc, onSnapshot, setDoc, serverTimestamp } from '../firebase';
import { toast } from '../utils/toast';

export default function BaleInfoModal({ isOpen, onClose }) {
  const [rate, setRate] = useState(100);
  const [inputRate, setInputRate] = useState('100');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Real-time sync with Firestore settings/master_bale_config
  useEffect(() => {
    const configDocRef = doc(db, 'settings', 'master_bale_config');
    const unsubscribe = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const activeRate = data.rate !== undefined && data.rate !== null ? Number(data.rate) : 100;
        setRate(activeRate);
        if (!isEditing) setInputRate(String(activeRate));
      } else {
        setDoc(configDocRef, {
          rate: 100,
          unit: 'per Master Bale',
          description: 'Global default rate per packed Master Bale applied to all customer orders',
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    }, (err) => {
      console.warn('Bale info modal sync notice:', err.message);
    });

    return () => unsubscribe();
  }, [isEditing]);

  if (!isOpen) return null;

  const handleSaveRate = async () => {
    const num = parseFloat(inputRate);
    if (isNaN(num) || num < 0) {
      toast.error('Please enter a valid non-negative rate (e.g. 100).', 'Invalid Rate');
      return;
    }

    setSaving(true);
    try {
      const configDocRef = doc(db, 'settings', 'master_bale_config');
      await setDoc(configDocRef, {
        rate: num,
        unit: 'per Master Bale',
        updatedAt: serverTimestamp(),
        lastUpdatedBy: 'Admin'
      }, { merge: true });

      setRate(num);
      setIsEditing(false);

      // Broadcast update across tabs
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const channel = new BroadcastChannel('gsco_realtime_channel');
        channel.postMessage({ type: 'MASTER_BALE_RATE_UPDATED', rate: num });
        channel.close();
      }

      toast.success(`Common Master Bale Rate updated to ₹${num}/bale (applied globally)!`, 'Rate Saved');
    } catch (err) {
      console.error('Failed to update master bale rate:', err);
      toast.error('Failed to save rate: ' + err.message, 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (presetVal) => {
    setInputRate(String(presetVal));
  };

  return (
    <div className="bale-info-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bale-info-modal-wrapper" onClick={(e) => e.stopPropagation()}>
        {/* Prominent X Close Button */}
        <button
          type="button"
          className="btn-bale-info-close"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Modal Header */}
        <div className="bale-info-header">
          <div className="bale-info-icon-badge">
            <i className="fa-solid fa-cube"></i>
          </div>
          <div>
            <h2 className="bale-info-title">Master Bale Information & Costing</h2>
            <p className="bale-info-subtitle">Common Rate Applied Globally Across All Customer Orders & Calculations</p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="bale-info-body">
          {/* Card 1: Common Master Bale Rate (Editable) */}
          <div className="bale-rate-edit-card">
            <div className="bale-rate-card-top">
              <span className="bale-rate-tag-label">COMMON MASTER BALE RATE (GLOBALLY APPLIED)</span>
              <span className="bale-rate-active-pill">
                <i className="fa-solid fa-circle-check"></i> Active in System
              </span>
            </div>

            <div className="bale-rate-main-row">
              <div className="bale-rate-display-box">
                <span className="bale-rate-currency">₹</span>
                <span className="bale-rate-number">{rate}</span>
                <span className="bale-rate-unit">/ Master Bale</span>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  className="btn-edit-bale-rate"
                  onClick={() => setIsEditing(true)}
                  title="Edit the global master bale rate"
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  <span>Edit Rate</span>
                </button>
              )}
            </div>

            {/* Editable Form Section */}
            {isEditing && (
              <div className="bale-rate-editing-panel">
                <label className="bale-input-label">
                  Set New Common Rate (₹ per Master Bale):
                </label>
                <div className="bale-input-group">
                  <span className="bale-input-prefix">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="bale-number-input"
                    value={inputRate}
                    onChange={(e) => setInputRate(e.target.value)}
                    placeholder="100"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-save-bale-rate"
                    onClick={handleSaveRate}
                    disabled={saving}
                  >
                    <i className="fa-solid fa-check"></i>
                    <span>{saving ? 'Saving...' : 'Save Rate'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-cancel-bale-rate"
                    onClick={() => {
                      setInputRate(String(rate));
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="bale-presets-row">
                  <span className="presets-label">Quick Presets:</span>
                  {[100, 120, 150, 200, 0].map((pVal) => (
                    <button
                      key={pVal}
                      type="button"
                      className={`btn-preset-chip ${Number(inputRate) === pVal ? 'preset-active' : ''}`}
                      onClick={() => applyPreset(pVal)}
                    >
                      {pVal === 0 ? '₹0 (Free)' : `₹${pVal}${pVal === 100 ? ' (Default)' : ''}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* System Master Bale Standards Info */}
          <div className="bale-standards-card">
            <h4 className="standards-title">
              <i className="fa-solid fa-circle-info"></i> How Master Bale Packing Works
            </h4>
            <ul className="standards-list">
              <li>
                <strong>Unified Capacity:</strong> 1 Master Bale is packed to 120 standard volumetric units (e.g. 8 bundles of 13x19 Door Mat or 3 bundles of Robo Mat).
              </li>
              <li>
                <strong>Automatic Multi-Item Packing:</strong> Items are algorithmically packed to fill each bale to maximum capacity before opening a new bale.
              </li>
              <li>
                <strong>Live Checkout & PDF Invoices:</strong> Customer order drawer, purchase orders, and PDF invoices compute packing charges dynamically from this global rate.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bale-info-footer">
          <span className="footer-notice">
            <i className="fa-solid fa-shield-halved" style={{ color: '#0284c7' }}></i>
            Changes sync instantly to Customer Portal & Firebase Cloud Database.
          </span>
          <button type="button" className="btn-done-modal" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
