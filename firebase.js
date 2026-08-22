// Firebase SDK Configuration & Initialization for Govindasamy & Co Admin
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDvjfa-nhsPwYGUn1BcAv6ukXiFwmaa9ks",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "govindasamyandco.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "govindasamyandco",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "govindasamyandco.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "154816426732",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:154816426732:web:9bc68ca9632db51c2dabc9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-T98D4GNX9V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
