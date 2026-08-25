import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyDvjfa-nhsPwYGUn1BcAv6ukXiFwmaa9ks",
    authDomain: "govindasamyandco.firebaseapp.com",
    projectId: "govindasamyandco",
    storageBucket: "govindasamyandco.firebasestorage.app",
    messagingSenderId: "154816426732",
    appId: "1:154816426732:web:9bc68ca9632db51c2dabc9",
    measurementId: "G-T98D4GNX9V"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

export {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
  signInWithEmailAndPassword,
  signOut,
  httpsCallable
};

export default app;
