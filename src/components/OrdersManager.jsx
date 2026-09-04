import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, updateDoc } from '../firebase';
import { toast } from '../utils/toast';

export default function OrdersManager() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Subscribe to real-time wholesale orders from Firestore
  useEffect(() => {
    const ordersRef = collection(db, 'orders');
    const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
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
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}></i>
          <p>Syncing orders from Cloud Firestore...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <i className="fa-solid fa-inbox" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '0.5rem' }}></i>
          <h3 style={{ fontSize: '1rem', color: '#475569' }}>No Customer Orders Found</h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Customer inquiries submitted via the User app will appear here automatically.</p>
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

                {Array.isArray(ord.items) && ord.items.length > 0 && (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                      Ordered Items ({ord.items.length})
                    </div>
                    {ord.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.2rem 0', borderBottom: idx < ord.items.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                        <span>• {item.title || item.name} ({item.qty} {item.unit || 'Bundle(s)'})</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>Rs. {((item.qty || 1) * (item.unitRate || item.baseRate || 0)).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Est. Bales: <strong>{ord.estBales || 1}</strong> • Total Units: <strong>{ord.totalUnits || 0}</strong></span>
                  <span>Received: {dateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
