import React, { useState, useEffect } from 'react';
import { db, doc, onSnapshot, setDoc, serverTimestamp } from '../firebase';
import { toast } from '../utils/toast';

export default function MasterBaleConfigCard({ onRateChange }) {
  const [rate, setRate] = useState(100);
  const [inputRate, setInputRate] = useState('100');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simBales, setSimBales] = useState(40);

  // Sync global master bale rate from Firestore settings/master_bale_config
  useEffect(() => {
    const configDocRef = doc(db, 'settings', 'master_bale_config');
    const unsubscribe = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const activeRate = data.rate !== undefined && data.rate !== null ? Number(data.rate) : 100;
        setRate(activeRate);
        if (!isEditing) setInputRate(String(activeRate));
        if (onRateChange) onRateChange(activeRate);
      } else {
        // Initialize default ₹100 if document does not exist
        setDoc(configDocRef, {
          rate: 100,
          unit: 'per Master Bale',
          description: 'Global default rate per packed Master Bale applied to all customer orders',
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    }, (err) => {
      console.warn('Master bale config sync notice:', err.message);
    });

    return () => unsubscribe();
  }, [isEditing]);

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

      toast.success(`Global Master Bale Rate updated to ₹${num} / Master Bale!`, 'Rate Saved');
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

  const calculatedCost = simBales * (isEditing ? (parseFloat(inputRate) || 0) : rate);

  return (
    <section className="admin-card master-bale-config-section" id="master-bale-settings" style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      border: '1.5px solid #bae6fd',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 4px 20px rgba(2, 132, 199, 0.08)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>
              <i className="fa-solid fa-cube"></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c4a6e', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                Master Bale Costing & Rate Settings
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                Global common amount applied to all bales across wholesale orders (Re-editable at any time)
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            background: '#e0f2fe',
            color: '#0369a1',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            fontSize: '0.82rem',
            fontWeight: 700,
            border: '1px solid #bae6fd'
          }}>
            <i className="fa-solid fa-calculator" style={{ marginRight: '0.35rem' }}></i>
            Formula: Bales × Rate = Total
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.25rem',
        alignItems: 'stretch'
      }}>
        {/* Left Column: Live Rate & Edit Controls */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Current Active Global Rate
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.35rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0369a1', fontFamily: 'Outfit, sans-serif' }}>
                ₹{rate}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748b' }}>
                / Master Bale
              </span>
            </div>

            {isEditing ? (
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Enter New Rate (₹ per Master Bale):
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={inputRate}
                    onChange={(e) => setInputRate(e.target.value)}
                    placeholder="e.g. 100"
                    style={{
                      flex: 1,
                      padding: '0.55rem 0.85rem',
                      borderRadius: '8px',
                      border: '1.5px solid #0284c7',
                      fontSize: '1rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveRate}
                    disabled={saving}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.55rem 1.15rem',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <i className="fa-solid fa-check"></i>
                    {saving ? 'Saving...' : 'Save Rate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputRate(String(rate));
                      setIsEditing(false);
                    }}
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.55rem 0.85rem',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Presets:</span>
                  {[100, 120, 150, 200, 0].map((pVal) => (
                    <button
                      key={pVal}
                      type="button"
                      onClick={() => applyPreset(pVal)}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.15rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        cursor: 'pointer'
                      }}
                    >
                      {pVal === 0 ? '₹0 (Free)' : `₹${pVal}`}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.55rem 1.15rem',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                }}
              >
                <i className="fa-solid fa-pen-to-square"></i>
                <span>Edit Master Bale Rate</span>
              </button>
            )}
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#64748b' }}>
            <i className="fa-solid fa-info-circle" style={{ color: '#0284c7', marginRight: '0.3rem' }}></i>
            Updates take effect immediately on all new customer orders and invoice calculations.
          </div>
        </div>

        {/* Right Column: Dynamic Live Calculation Simulator */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Live Costing Simulator
            </span>
            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label htmlFor="bale-sim-input" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Ordered Master Bales:
                </label>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284c7' }}>
                  {simBales} Bales
                </span>
              </div>
              <input
                id="bale-sim-input"
                type="range"
                min="1"
                max="200"
                value={simBales}
                onChange={(e) => setSimBales(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
              />
            </div>

            <div style={{
              marginTop: '1rem',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                  Total Master Bale Cost
                </span>
                <span style={{ fontSize: '0.8rem', color: '#166534' }}>
                  {simBales} Bales × ₹{isEditing ? (parseFloat(inputRate) || 0) : rate}/bale
                </span>
              </div>
              <strong style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d', fontFamily: 'Outfit, sans-serif' }}>
                ₹{calculatedCost.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>

          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.76rem', color: '#94a3b8', fontStyle: 'italic' }}>
            Example: If a buyer orders items packing into 40 master bales at ₹100, the calculated packing charge is ₹4,000.
          </p>
        </div>
      </div>
    </section>
  );
}
