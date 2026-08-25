import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot } from './firebase';
import Login from './components/Login';
import Header from './components/Header';
import ProductForm from './components/ProductForm';
import ProductGrid from './components/ProductGrid';
import './styles.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('gsco_admin_logged_in') === 'true'
  );
  const [products, setProducts] = useState([]);

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
      </main>
    </div>
  );
}
