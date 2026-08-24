// Govindasamy & Co - Admin App Logic (100% Firebase Firestore & Cloud Storage Integrated)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, getDocs, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDvjfa-nhsPwYGUn1BcAv6ukXiFwmaa9ks",
    authDomain: "govindasamyandco.firebaseapp.com",
    projectId: "govindasamyandco",
    storageBucket: "govindasamyandco.firebasestorage.app",
    messagingSenderId: "154816426732",
    appId: "1:154816426732:web:9bc68ca9632db51c2dabc9",
    measurementId: "G-T98D4GNX9V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// State Variables
let products = [];
let selectedImageFile = null;
let currentFilter = 'ALL';

// Initial Mat Products Seed if Firestore is completely empty
const initialSeedProducts = [
    {
        title: 'Heavy Duty Printed Panipat Door Mat',
        category: 'Panipat Mat',
        baseRate: 1800,
        unit: 'per Bundle',
        bundlePieces: 10,
        bundlesPerPack: 8,
        compressibility: 0.80,
        minOrderNotice: 'Purchased per full Bundle (10 Pcs only)',
        description: 'Authentic Panipat woven door mat sold in bundles of 10 pieces with vibrant traditional prints.',
        imageUrl: 'public/assets/Visiting card front.png'
    },
    {
        title: 'Premium Handloom Cotton Export Mat',
        category: 'Export Mat',
        baseRate: 4500,
        unit: 'per Bundle',
        bundlePieces: 10,
        bundlesPerPack: 10,
        compressibility: 0.80,
        minOrderNotice: 'Purchased per full Bundle (10 Pcs only)',
        description: 'Export quality heavyweight cotton floor mats packed in 10-piece bundles with anti-skid backing.',
        imageUrl: 'public/assets/Visiting card back.jpg'
    },
    {
        title: 'Durable Daily Use Local Mat',
        category: 'Local Mat',
        baseRate: 95,
        unit: 'per Piece',
        bundlePieces: 0,
        bundlesPerPack: 50,
        compressibility: 0.85,
        minOrderNotice: 'Available for individual piece purchase',
        description: 'Economical multi-color entryway mat suitable for home, office, and shop entrances.',
        imageUrl: 'public/assets/logo.jpg'
    },
    {
        title: '6ft Anti-Slip Runner Long Mat',
        category: 'Long Mat',
        baseRate: 6800,
        unit: 'per Bundle',
        bundlePieces: 10,
        bundlesPerPack: 4,
        compressibility: 0.85,
        minOrderNotice: 'Purchased per full Bundle (10 Pcs only)',
        description: 'Extra long hallway and kitchen runner mats bundled in 10-piece sets.',
        imageUrl: 'public/assets/logo.jpg'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initAdminApp();
});

function initAdminApp() {
    setupAuthHandlers();
    setupFormHandlers();
    setupFirestoreRealtimeListener();
}

/* ==========================================================================
   1. AUTHENTICATION HANDLERS
   ========================================================================== */
function setupAuthHandlers() {
    const loginForm = document.getElementById('loginForm');
    const loginWrapper = document.getElementById('loginWrapper');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const loginError = document.getElementById('loginError');

    // Password Eye Toggle
    document.getElementById('togglePasswordBtn').addEventListener('click', function() {
        const passInput = document.getElementById('adminPassword');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            this.classList.replace('fa-eye-slash', 'fa-eye');
        } else {
            passInput.type = 'password';
            this.classList.replace('fa-eye', 'fa-eye-slash');
        }
    });

    // Check Auth State
    onAuthStateChanged(auth, (user) => {
        if (user || localStorage.getItem('gsco_admin_logged_in') === 'true') {
            loginWrapper.classList.add('hidden');
            dashboardContainer.classList.remove('hidden');
        } else {
            loginWrapper.classList.remove('hidden');
            dashboardContainer.classList.add('hidden');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value.trim();

        try {
            // Firebase Auth or Admin Credentials fallback
            if (email === "govindasamy.textitle@gmail.com" && (password === "admin123" || password === "govindasamy123")) {
                localStorage.setItem('gsco_admin_logged_in', 'true');
                loginWrapper.classList.add('hidden');
                dashboardContainer.classList.remove('hidden');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                localStorage.setItem('gsco_admin_logged_in', 'true');
                loginWrapper.classList.add('hidden');
                dashboardContainer.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Login Auth Failed:", error);
            loginError.classList.remove('hidden');
            document.getElementById('loginErrorText').innerText = 'Invalid credentials or connection error.';
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('gsco_admin_logged_in');
        signOut(auth);
        loginWrapper.classList.remove('hidden');
        dashboardContainer.classList.add('hidden');
    });
}

/* ==========================================================================
   2. FIRESTORE REALTIME DATABASE LISTENER
   ========================================================================== */
function setupFirestoreRealtimeListener() {
    const productsRef = collection(db, "products");

    onSnapshot(productsRef, async (snapshot) => {
        // If Firestore products collection is empty on first run, seed initial products!
        if (snapshot.empty) {
            console.log("Firestore empty. Seeding initial mat products...");
            for (const item of initialSeedProducts) {
                await addDoc(productsRef, {
                    ...item,
                    createdAt: serverTimestamp()
                });
            }
            return;
        }

        products = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        renderProductGrid();
        updateAdminStats();
    }, (error) => {
        console.error("Firestore Realtime Sync Error:", error);
    });
}

/* ==========================================================================
   3. FORM HANDLERS & IMAGE UPLOADER
   ========================================================================== */
function setupFormHandlers() {
    const unitType = document.getElementById('unitType');
    const bundlePiecesGroup = document.getElementById('bundlePiecesGroup');
    const bundlePieces = document.getElementById('bundlePieces');
    const minOrderText = document.getElementById('minOrderText');
    const productCategory = document.getElementById('productCategory');
    const newCategoryBox = document.getElementById('newCategoryBox');

    // Unit Change Logic
    unitType.addEventListener('change', () => {
        const unit = unitType.value;
        if (unit === 'per Bundle' || unit === 'per Dozen') {
            bundlePiecesGroup.classList.remove('hidden');
            bundlePieces.value = unit === 'per Dozen' ? 12 : 10;
            minOrderText.value = `Purchased per full ${unit.replace('per ', '')} (${bundlePieces.value} Pcs only)`;
        } else {
            bundlePiecesGroup.classList.add('hidden');
            bundlePieces.value = '';
            minOrderText.value = 'Available for individual piece purchase';
        }
    });

    bundlePieces.addEventListener('input', () => {
        const unit = unitType.value;
        if (bundlePieces.value) {
            minOrderText.value = `Purchased per full ${unit.replace('per ', '')} (${bundlePieces.value} Pcs only)`;
        }
    });

    // New Category Dynamic Creation
    productCategory.addEventListener('change', () => {
        if (productCategory.value === 'NEW_CATEGORY') {
            newCategoryBox.classList.remove('hidden');
        } else {
            newCategoryBox.classList.add('hidden');
        }
    });

    document.getElementById('saveCategoryBtn').addEventListener('click', async () => {
        const newCat = document.getElementById('newCategoryInput').value.trim();
        if (newCat) {
            // Save category to Firestore
            await addDoc(collection(db, "categories"), { name: newCat, createdAt: serverTimestamp() });
            
            const newOption = document.createElement('option');
            newOption.value = newCat;
            newOption.innerText = newCat;
            productCategory.insertBefore(newOption, productCategory.options[productCategory.options.length - 1]);
            productCategory.value = newCat;
            newCategoryBox.classList.add('hidden');
        }
    });

    document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
        productCategory.value = 'Panipat Mat';
        newCategoryBox.classList.add('hidden');
    });

    // Image Drag & Drop / Preview
    const imageInput = document.getElementById('imageInput');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');

    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            selectedImageFile = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                imagePreview.src = event.target.result;
                uploadPlaceholder.classList.add('hidden');
                previewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedImageFile);
        }
    });

    document.getElementById('removeImgBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectedImageFile = null;
        imageInput.value = '';
        uploadPlaceholder.classList.remove('hidden');
        previewContainer.classList.add('hidden');
    });

    // Product Form Submit -> Direct to Firestore!
    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('productName').value.trim();
        const category = productCategory.value;
        const rate = parseFloat(document.getElementById('baseRate').value);
        const unit = unitType.value;
        const pcs = parseInt(bundlePieces.value) || 0;
        const minOrder = minOrderText.value.trim();
        const desc = document.getElementById('productDesc').value.trim();

        if (!name || !category || isNaN(rate)) {
            alert('Please complete all required product fields.');
            return;
        }

        let imageUrl = 'public/assets/logo.jpg';

        // If an image was selected, upload to Firebase Storage or Base64 fallback
        if (selectedImageFile) {
            try {
                const storageRef = ref(storage, `product-images/${Date.now()}_${selectedImageFile.name}`);
                await uploadBytes(storageRef, selectedImageFile);
                imageUrl = await getDownloadURL(storageRef);
            } catch (err) {
                console.warn("Storage upload fallback to DataURL:", err);
                imageUrl = imagePreview.src;
            }
        }

        // Calculate standard bundles per pack & compressibility
        let bundlesPerPack = 8;
        if (category === 'Export Mat') bundlesPerPack = 10;
        if (category === 'Long Mat') bundlesPerPack = 4;
        if (category === 'Local Mat') bundlesPerPack = 50;

        const newProduct = {
            title: name,
            category: category,
            baseRate: rate,
            unit: unit,
            bundlePieces: pcs,
            bundlesPerPack: bundlesPerPack,
            compressibility: 0.80,
            minOrderNotice: minOrder,
            description: desc,
            imageUrl: imageUrl,
            createdAt: serverTimestamp()
        };

        try {
            await addDoc(collection(db, "products"), newProduct);
            alert(`Product "${name}" uploaded successfully to Firebase!`);
            document.getElementById('productForm').reset();
            document.getElementById('removeImgBtn').click();
        } catch (err) {
            console.error("Firestore Add Error:", err);
            alert("Error adding product to Firebase: " + err.message);
        }
    });

    // Filter Category Change
    document.getElementById('filterCategory').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderProductGrid();
    });
}

/* ==========================================================================
   4. RENDER CATALOG GRID & STATS
   ========================================================================== */
function renderProductGrid() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';

    let filtered = products.filter(p => currentFilter === 'ALL' || p.category === currentFilter);

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--brand-emerald); margin-bottom: 1rem;"></i>
                <h3>No Mat Products Found</h3>
                <p>Upload a product using the form on the left.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(p => {
        const isBulkUnit = (p.unit === 'per Bundle' || p.unit === 'per Dozen') && p.bundlePieces > 0;
        const perPieceRate = isBulkUnit ? Math.round(p.baseRate / p.bundlePieces) : 0;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${p.imageUrl}" alt="${p.title}" class="card-img" onerror="this.src='public/assets/logo.jpg'">
                <span class="category-tag">${p.category}</span>
                ${isBulkUnit ? `
                    <span class="bundle-badge"><i class="fa-solid fa-boxes-packing"></i> ${p.bundlePieces} Pcs / ${p.unit.replace('per ', '')}</span>
                ` : ''}
            </div>
            <div class="card-body">
                <h3 class="product-title">${p.title}</h3>
                <p class="product-details">${p.description || 'Quality woven mat product.'}</p>
                <div class="purchase-rule-box">
                    <i class="fa-solid fa-circle-info"></i>
                    <span>${p.minOrderNotice || 'Available for purchase'}</span>
                </div>
                <div class="price-box">
                    <div>
                        <span class="rate-label">Rate</span>
                        <div class="rate-value">₹${p.baseRate.toLocaleString('en-IN')} <span class="unit-label">/${p.unit.replace('per ', '')}</span></div>
                        ${isBulkUnit ? `<div class="piece-rate-hint">(~ ₹${perPieceRate.toLocaleString('en-IN')} / pc)</div>` : ''}
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                    <button class="btn btn-secondary btn-block" onclick="deleteFirestoreProduct('${p.id}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateAdminStats() {
    document.getElementById('statTotalProducts').innerText = products.length;
}

// Global window reference for deleting
window.deleteFirestoreProduct = async function(id) {
    if (confirm("Are you sure you want to delete this product from Firebase?")) {
        try {
            await deleteDoc(doc(db, "products", id));
            alert("Product deleted from Firebase!");
        } catch (err) {
            console.error("Firestore Delete Error:", err);
            alert("Error deleting product: " + err.message);
        }
    }
};
