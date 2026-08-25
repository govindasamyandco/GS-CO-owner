import React, { useState, useEffect, useRef } from 'react';
import { db, collection, onSnapshot } from './firebase';
import Login from './components/Login';
import Header from './components/Header';
import ProductForm from './components/ProductForm';
import ProductGrid from './components/ProductGrid';
import AuditLogs from './components/AuditLogs';
import './styles.css';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Inactivity Timeout

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('gsco_admin_logged_in') === 'true'
  );
  const [products, setProducts] = useState([]);
  const lastActivityRef = useRef(Date.now());

  // Real-time Firestore Sync
  useEffect(() => {
    if (!isLoggedIn) return;

    const productsRef = collection(db, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const fetched = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setProducts(fetched);
    }, (error) => {
      console.error('Firestore real-time sync error:', error);
    });

    return () => unsubscribe();
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
        alert('⏱️ Session Expired: You were automatically logged out due to 15 minutes of inactivity for security.');
        handleLogout();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      clearInterval(checkInterval);
    };
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem('gsco_admin_logged_in');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => {
      localStorage.setItem('gsco_admin_logged_in', 'true');
      setIsLoggedIn(true);
    }} />;
  }

  return (
    <div className="app-container">
      <Header totalProducts={products.length} onLogout={handleLogout} />
      <main className="main-layout">
        <ProductForm />
        <ProductGrid products={products} />
        <AuditLogs />
      </main>
    </div>
  );
}
