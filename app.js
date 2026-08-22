// Sample Products with Govindasamy & Co Textile Data
let products = [
    {
        id: 'p1',
        title: 'Kanchipuram Zari Pure Silk Saree',
        category: 'Silk Sarees',
        baseRate: 12500,
        unit: 'per Piece',
        description: 'Authentic handwoven mulberry silk with rich zari border and traditional temple motifs.',
        imageUrl: 'public/assets/Visiting card front.png'
    },
    {
        id: 'p2',
        title: 'Premium Organic Cotton Dhoti Set',
        category: 'Pure Cotton Dhotis',
        baseRate: 1200,
        unit: 'per Set',
        description: '100% combed cotton dhoti with gold zari border, ideal for ceremonies and traditional occasions.',
        imageUrl: 'public/assets/Visiting card back.jpg'
    },
    {
        id: 'p3',
        title: 'Raw Jacquard Silk Brocade Material',
        category: 'Designer Fabrics',
        baseRate: 850,
        unit: 'per Meter',
        description: 'Heavyweight floral jacquard fabric suitable for sherwanis, lehengas, and designer wear.',
        imageUrl: 'public/assets/logo.jpg'
    },
    {
        id: 'p4',
        title: 'Super 120s Linen Shirting Fabric',
        category: 'Shirting & Suits',
        baseRate: 650,
        unit: 'per Meter',
        description: 'Breathable high-thread-count linen fabric available in rich festive shades.',
        imageUrl: 'public/assets/logo.jpg'
    }
];

let uploadedImageDataUrl = null;

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    renderProducts();
    updateStats();
}

function setupEventListeners() {
    // Category Filter
    const filterCategory = document.getElementById('filterCategory');
    filterCategory.addEventListener('change', () => {
        renderProducts();
    });

    // Image Upload & Preview Handler
    const imageInput = document.getElementById('imageInput');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImgBtn = document.getElementById('removeImgBtn');

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                uploadedImageDataUrl = evt.target.result;
                imagePreview.src = uploadedImageDataUrl;
                uploadPlaceholder.classList.add('hidden');
                previewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    removeImgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedImageDataUrl = null;
        imageInput.value = '';
        imagePreview.src = '';
        previewContainer.classList.add('hidden');
        uploadPlaceholder.classList.remove('hidden');
    });

    // Product Form Submission
    const productForm = document.getElementById('productForm');
    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = document.getElementById('productName').value;
        const category = document.getElementById('productCategory').value;
        const baseRate = parseFloat(document.getElementById('baseRate').value);
        const unit = document.getElementById('unitType').value;
        const description = document.getElementById('productDesc').value;

        const newProduct = {
            id: 'p_' + Date.now(),
            title,
            category,
            baseRate,
            unit,
            description: description || 'No additional details provided.',
            imageUrl: uploadedImageDataUrl || 'public/assets/logo.jpg'
        };

        products.unshift(newProduct);

        // Reset form & upload zone
        productForm.reset();
        removeImgBtn.click();
        
        renderProducts();
        updateStats();
    });
}

function updateStats() {
    document.getElementById('statTotalProducts').innerText = products.length;
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    const filterCat = document.getElementById('filterCategory').value;
    
    grid.innerHTML = '';

    const filtered = products.filter(p => filterCat === 'ALL' || p.category === filterCat);

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; color: var(--brand-emerald);"></i>
                <p style="font-size: 1.1rem; font-weight: 600;">No products found in this category.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${p.imageUrl}" alt="${p.title}" class="card-img" onerror="this.src='public/assets/logo.jpg'">
                <span class="category-tag">${p.category}</span>
            </div>

            <div class="card-body">
                <h3 class="product-title">${p.title}</h3>
                <p class="product-details">${p.description}</p>
                
                <div class="price-box">
                    <div>
                        <span class="rate-label">Product Rate</span>
                        <div class="rate-value">
                            ₹${p.baseRate.toLocaleString('en-IN')}
                            <span class="unit-label">/${p.unit.replace('per ', '')}</span>
                        </div>
                    </div>
                </div>

                <div class="card-actions">
                    <button type="button" class="btn-action" onclick="quickUpdatePrice('${p.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Edit Rate
                    </button>
                    <button type="button" class="btn-action btn-delete" onclick="deleteProduct('${p.id}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function deleteProduct(id) {
    if (confirm('Are you sure you want to remove this product from the catalog?')) {
        products = products.filter(p => p.id !== id);
        renderProducts();
        updateStats();
    }
}

function quickUpdatePrice(id) {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    const newRate = prompt(`Update Rate (₹) for "${prod.title}":`, prod.baseRate);
    if (newRate && !isNaN(newRate) && parseFloat(newRate) > 0) {
        prod.baseRate = parseFloat(newRate);
        renderProducts();
    }
}
