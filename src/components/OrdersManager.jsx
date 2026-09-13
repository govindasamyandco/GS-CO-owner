import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, updateDoc, query, orderBy, limit, getDoc } from '../firebase';
import { toast } from '../utils/toast';
import { printBaleSlips } from '../utils/baleSlipGenerator';
import LottieAnimation from './LottieAnimation';

export default function OrdersManager() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBales, setExpandedBales] = useState({}); // { [orderId]: balesArray | null }

  // Subscribe to real-time wholesale orders from Firestore (bounded to latest 50 orders)
  useEffect(() => {
    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      // Sort by newest first
      fetched.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setOrders(fetched);
      setLoading(false);
    }, (err) => {
      console.warn('Orders Firestore real-time sync notice:', err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      toast.success(`Order status updated to ${newStatus}`, 'Order Status Updated');
    } catch (err) {
      console.error('Failed to update order status:', err);
      toast.error('Failed to update order status: ' + err.message, 'Update Error');
    }
  };

  const toggleBaleDetail = async (orderId) => {
    // If already loaded and visible, collapse
    if (expandedBales[orderId] !== undefined) {
      setExpandedBales((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      return;
    }

    // 1. Check if the order document already contains the pre-computed bales array
    const localOrder = orders.find((o) => o.id === orderId);
    if (localOrder && Array.isArray(localOrder.bales) && localOrder.bales.length > 0) {
      setExpandedBales((prev) => ({ ...prev, [orderId]: localOrder.bales }));
      return;
    }

    // 2. Otherwise fetch bale detail from Firestore master_bales/{orderId}
    try {
      const snap = await getDoc(doc(db, 'master_bales', orderId));
      if (snap.exists()) {
        setExpandedBales((prev) => ({ ...prev, [orderId]: snap.data().bales || [] }));
      } else {
        setExpandedBales((prev) => ({ ...prev, [orderId]: null }));
        toast.info('Bale allocation not yet calculated for this order.', 'No Bale Data');
      }
    } catch (err) {
      console.warn('Failed to fetch bale detail:', err.message);
      setExpandedBales((prev) => ({ ...prev, [orderId]: null }));
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesStatus = filterStatus === 'ALL' || ord.status === filterStatus;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (ord.companyName && ord.companyName.toLowerCase().includes(searchLower)) ||
      (ord.contactPerson && ord.contactPerson.toLowerCase().includes(searchLower)) ||
      (ord.phone && ord.phone.includes(searchTerm));
    return matchesStatus && matchesSearch;
  });

  const pendingCount = orders.filter(o => o.status === 'PENDING' || !o.status).length;
  const confirmedCount = orders.filter(o => o.status === 'CONFIRMED').length;

  return (
    <section className="admin-card orders-manager-section" style={{ marginTop: '2rem' }}>
      <div className="card-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#2563eb' }}></i>
            Wholesale Customer Orders ({orders.length})
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
            Real-time wholesale inquiries submitted from the Customer Portal
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.6rem', borderRadius: '999px', fontWeight: 600 }}>
            {pendingCount} Pending
          </span>
          <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#166534', padding: '0.25rem 0.6rem', borderRadius: '999px', fontWeight: 600 }}>
            {confirmedCount} Confirmed
          </span>
        </div>
      </div>

      <div className="filter-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by company, person, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input"
          style={{ flex: '1', minWidth: '220px', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="form-select"
          style={{ width: '180px', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending Inquiry</option>
          <option value="CONFIRMED">Confirmed Order</option>
          <option value="SHIPPED">Dispatched / Shipped</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          <LottieAnimation animationPath="/assets/loading.json" width={110} height={110} />
          <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>Syncing orders from Cloud Firestore...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <LottieAnimation animationPath="/assets/Error 404.json" width={180} height={160} />
          <h3 style={{ fontSize: '1.05rem', color: '#334155', fontWeight: 700, marginTop: '0.5rem' }}>No Customer Orders Found</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Customer inquiries submitted via the User app will appear here automatically.</p>
        </div>
      ) : (
        <div className="orders-grid" style={{ display: 'grid', gap: '1rem' }}>
          {filteredOrders.map((ord) => {
            const dateStr = ord.createdAt?.seconds 
              ? new Date(ord.createdAt.seconds * 1000).toLocaleString('en-IN')
              : ord.createdAt ? new Date(ord.createdAt).toLocaleString('en-IN') : 'Just now';

            const cleanPhone = (ord.phone || '').replace(/[^0-9]/g, '');

            return (
              <div key={ord.id} className="order-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                      🏢 {ord.companyName || 'Wholesale Buyer'}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      👤 {ord.contactPerson || 'N/A'} • 📞 {ord.phone} {ord.gstNumber && ord.gstNumber !== 'N/A' ? `• GST: ${ord.gstNumber}` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select
                      value={ord.status || 'PENDING'}
                      onChange={(e) => handleUpdateStatus(ord.id, e.target.value)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        border: '1px solid #cbd5e1',
                        backgroundColor: ord.status === 'CONFIRMED' ? '#dcfce7' : ord.status === 'SHIPPED' ? '#dbeafe' : ord.status === 'CANCELLED' ? '#fee2e2' : '#fef3c7',
                        color: ord.status === 'CONFIRMED' ? '#166534' : ord.status === 'SHIPPED' ? '#1e40af' : ord.status === 'CANCELLED' ? '#991b1b' : '#92400e'
                      }}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="SHIPPED">SHIPPED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>

                    {cleanPhone && (
                      <a
                        href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`Hello ${ord.contactPerson || 'Customer'}, regarding your wholesale order from Govindasamy & Co...`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{ background: '#25d366', color: '#ffffff', padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <i className="fa-brands fa-whatsapp"></i> WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem' }}>
                  <strong>📍 Delivery Address:</strong> {ord.deliveryAddress || ord.address || 'N/A'}
                </div>

                {Array.isArray(ord.items) && ord.items.length > 0 && (() => {
                  const itemsSubtotal = ord.itemsSubtotal !== undefined
                    ? ord.itemsSubtotal
                    : ord.items.reduce((s, item) => s + ((item.qty || 1) * (item.unitRate || item.baseRate || 0)), 0);
                  const baleRate = ord.masterBaleRate !== undefined ? ord.masterBaleRate : 100;
                  const baleTotal = ord.masterBaleTotal !== undefined ? ord.masterBaleTotal : ((ord.estBales || 1) * baleRate);
                  const grandTotal = ord.grandTotal !== undefined ? ord.grandTotal : (itemsSubtotal + baleTotal);

                  return (
                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          Ordered Items ({ord.items.length})
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Items Subtotal: <strong style={{ color: '#0f172a' }}>Rs. {itemsSubtotal.toLocaleString('en-IN')}</strong>
                        </span>
                      </div>
                      {ord.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.2rem 0', borderBottom: idx < ord.items.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                          <span>• {item.title || item.name} ({item.qty} {item.unit || 'Bundle(s)'})</span>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>Rs. {((item.qty || 1) * (item.unitRate || item.baseRate || 0)).toLocaleString('en-IN')}</span>
                        </div>
                      ))}

                      {/* Master Bale Cost & Grand Total Row in Admin Order Card */}
                      <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#1e40af', background: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe', fontWeight: 600 }}>
                          📦 Bale Charges: {ord.estBales || 1} Bales @ ₹{baleRate}/bale = <strong>Rs. {baleTotal.toLocaleString('en-IN')}</strong>
                        </span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#031b4e' }}>
                          Grand Total: <strong style={{ color: '#0284c7', fontSize: '1.05rem' }}>Rs. {grandTotal.toLocaleString('en-IN')}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    Est. Bales: <strong>{ord.estBales || 1}</strong> • Total Units: <strong>{ord.totalUnits || 0}</strong>
                    {ord.balesPacked && (
                      <button
                        onClick={() => toggleBaleDetail(ord.id)}
                        style={{ marginLeft: '0.25rem', background: expandedBales[ord.id] !== undefined ? '#dbeafe' : '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.15rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#1e40af', fontWeight: 600 }}
                      >
                        <i className={`fa-solid ${expandedBales[ord.id] !== undefined ? 'fa-chevron-up' : 'fa-layer-group'}`} style={{ marginRight: '0.25rem' }}></i>
                        {expandedBales[ord.id] !== undefined ? 'Hide' : 'Bale Plan'}
                      </button>
                    )}
                    <button
                      onClick={() => printBaleSlips(ord)}
                      style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', cursor: 'pointer', color: '#0f172a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      title="Print Master Bale Dispatch Stickers for Gunny Bags"
                    >
                      <i className="fa-solid fa-print" style={{ color: '#2563eb' }}></i> Print Bale Labels
                    </button>
                  </span>
                  <span>Received: {dateStr}</span>
                </div>

                {/* Expandable Bale Allocation Detail */}
                {expandedBales[ord.id] && Array.isArray(expandedBales[ord.id]) && expandedBales[ord.id].length > 0 && (
                  <div style={{ marginTop: '0.75rem', background: '#f0f9ff', borderRadius: '8px', padding: '0.75rem', border: '1px solid #bae6fd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <i className="fa-solid fa-boxes-stacked" style={{ marginRight: '0.3rem' }}></i>
                        Bale Allocation Plan ({expandedBales[ord.id].length} bales)
                      </div>
                      <button
                        onClick={() => printBaleSlips({ ...ord, bales: expandedBales[ord.id] })}
                        style={{ background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <i className="fa-solid fa-print"></i> Print {expandedBales[ord.id].length} Labels
                      </button>
                    </div>
                    {expandedBales[ord.id].map((bale) => (
                      <div key={bale.baleId} style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px dashed #bae6fd' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0c4a6e' }}>
                            <i className="fa-solid fa-cube" style={{ marginRight: '0.2rem' }}></i>{bale.baleId}
                          </span>
                          <div style={{ flex: 1, height: '6px', background: '#e0f2fe', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, parseFloat(bale.capacityPercent))}%`, background: parseFloat(bale.capacityPercent) >= 90 ? '#16a34a' : parseFloat(bale.capacityPercent) >= 60 ? '#d97706' : '#2563eb', borderRadius: '999px', transition: 'width 0.5s ease' }}></div>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1', whiteSpace: 'nowrap' }}>{bale.capacityPercent}% full</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {bale.items.map((item) => (
                            <span key={item.itemId} style={{ fontSize: '0.72rem', background: '#ffffff', border: '1px solid #bae6fd', borderRadius: '4px', padding: '0.1rem 0.4rem', color: '#0c4a6e' }}>
                              {item.title}: {item.bundleQty}B · {item.capacityPercent}%
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
