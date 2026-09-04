import React, { useState, useEffect, useRef } from 'react';
import { db, collection, onSnapshot, auth, onAuthStateChanged, signOut } from './firebase';
import Login from './components/Login';
import Header from './components/Header';
import ProductForm from './components/ProductForm';
import ProductGrid from './components/ProductGrid';
import OrdersManager from './components/OrdersManager';
import AuditLogs from './components/AuditLogs';
import ModernToastContainer from './components/ModernToastContainer';
import { toast } from './utils/toast';
import './styles.css';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Inactivity Timeout

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [products, setProducts] = useState([]);
  const lastActivityRef = useRef(Date.now());

  // Listen to Firebase Auth state & verify admin custom claim
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdTokenResult(true);
          const hasAdminClaim = idToken.claims.admin === true || user.email === (import.meta.env.VITE_ADMIN_EMAIL || 'govindasamy.textile@gmail.com');
          const totpVerified = sessionStorage.getItem('gsco_totp_verified') === 'true';

          if (hasAdminClaim && totpVerified) {
            setIsLoggedIn(true);
          } else {
            setIsLoggedIn(false);
          }
        } catch (e) {
          console.error('Failed to verify admin claims:', e);
          setIsLoggedIn(false);
        }
      } else {
        sessionStorage.removeItem('gsco_totp_verified');
        setIsLoggedIn(false);
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore & Cross-Tab Broadcast Sync
  useEffect(() => {
    if (!isLoggedIn) return;

    // Load locally cached products
    const cached = JSON.parse(localStorage.getItem('gsco_catalog_products') || '[]');
    if (cached.length > 0) {
      setProducts(cached);
    }

    // Listen to real-time events across tabs
    let channel;
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      channel = new BroadcastChannel('gsco_realtime_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'PRODUCT_ADDED') {
          setProducts((prev) => {
            if (prev.some((p) => p.id === event.data.product.id)) return prev;
            return [event.data.product, ...prev];
          });
        } else if (event.data?.type === 'ORDER_PLACED') {
          const ord = event.data.order;
          toast.info(`Company: ${ord.companyName} | Phone: ${ord.phone} | Est. Bales: ${ord.estBales || 1}`, '🔔 Wholesale Order Received');
        }
      };
    }

    const productsRef = collection(db, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const fetched = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      if (fetched.length > 0) {
        setProducts(fetched);
      }
    }, (error) => {
      console.warn('Firestore real-time sync info:', error.message);
    });

    return () => {
      unsubscribe();
      if (channel) channel.close();
    };
  }, [isLoggedIn]);

  // 15-Minute Inactivity Auto-Logout Tracker
  useEffect(() => {
    if (!isLoggedIn) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer));

    const checkInterval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        toast.warning('You were automatically logged out due to 15 minutes of inactivity.', '⏱️ Session Expired');
        handleLogout();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      clearInterval(checkInterval);
    };
  }, [isLoggedIn]);

  const handleLogout = async () => {
    sessionStorage.removeItem('gsco_totp_verified');
    localStorage.removeItem('gsco_admin_logged_in');
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setIsLoggedIn(false);
  };

  if (authChecking) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner"></div>
        <p>Verifying secure admin authorization...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <ModernToastContainer />
        <Login
          onLoginSuccess={() => {
            sessionStorage.setItem('gsco_totp_verified', 'true');
            setIsLoggedIn(true);
          }}
        />
      </>
    );
  }

  return (
    <div className="app-container">
      <ModernToastContainer />
      <Header totalProducts={products.length} onLogout={handleLogout} />
      <main className="main-layout">
        <ProductForm />
        <ProductGrid products={products} />
        <OrdersManager />
        <AuditLogs />
      </main>
    </div>
  );
}
