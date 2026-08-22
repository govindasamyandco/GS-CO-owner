// Sample Products with Govindasamy & Co Mat Products & Bundle Data
let products = [
    {
        id: 'p1',
        title: 'Heavy Duty Printed Panipat Door Mat',
        category: 'Panipat Mat',
        baseRate: 1800,
        unit: 'per Bundle',
        bundlePieces: 10,
        description: 'Authentic Panipat woven door mat sold in bundles of 10 pieces with vibrant traditional prints.',
        imageUrl: 'public/assets/Visiting card front.png'
    },
    {
        id: 'p2',
        title: 'Premium Handloom Cotton Export Mat',
        category: 'Export Mat',
        baseRate: 4500,
        unit: 'per Bundle',
        bundlePieces: 10,
        description: 'Export quality heavyweight cotton floor mats packed in 10-piece bundles with anti-skid backing.',
        imageUrl: 'public/assets/Visiting card back.jpg'
    },
    {
        id: 'p3',
        title: 'Durable Daily Use Local Mat',
        category: 'Local Mat',
        baseRate: 95,
        unit: 'per Piece',
        bundlePieces: 0,
        description: 'Economical multi-color entryway mat suitable for home, office, and shop entrances.',
        imageUrl: 'public/assets/logo.jpg'
    },
    {
        id: 'p4',
        title: '6ft Anti-Slip Runner Long Mat',
        category: 'Long Mat',
        baseRate: 6800,
        unit: 'per Bundle',
        bundlePieces: 10,
        description: 'Extra long hallway and kitchen runner mats bundled in 10-piece sets.',
        imageUrl: 'public/assets/logo.jpg'
    }
];

// Available categories list
let categories = ['Panipat Mat', 'Export Mat', 'Local Mat', 'Long Mat'];

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
    const productCategorySelect = document.getElementById('productCategory');
    const filterCategorySelect = document.getElementById('filterCategory');
    const newCategoryBox = document.getElementById('newCategoryBox');
    const newCategoryInput = document.getElementById('newCategoryInput');
    const saveCategoryBtn = document.getElementById('saveCategoryBtn');
    const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
    
    const unitTypeSelect = document.getElementById('unitType');
    const bundlePiecesGroup = document.getElementById('bundlePiecesGroup');
    const bundlePiecesInput = document.getElementById('bundlePieces');

    // Show/Hide Pieces per Bundle Input when "per Bundle" is selected
    unitTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'per Bundle') {
            bundlePiecesGroup.classList.remove('hidden');
            if (!bundlePiecesInput.value) {
                bundlePiecesInput.value = '10'; // default bundle size suggestion
            }
        } else {
            bundlePiecesGroup.classList.add('hidden');
        }
    });

    // Show/Hide New Category Input when "+ Create New Category..." is selected
    productCategorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'NEW_CATEGORY') {
            newCategoryBox.classList.remove('hidden');
            newCategoryInput.focus();
        } else {
            newCategoryBox.classList.add('hidden');
        }
    });

    // Save New Category Handler
    saveCategoryBtn.addEventListener('click', () => {
        addNewCategory();
    });

    newCategoryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addNewCategory();
        }
    });

    cancelCategoryBtn.addEventListener('click', () => {
        newCategoryInput.value = '';
        newCategoryBox.classList.add('hidden');
        productCategorySelect.selectedIndex = 0;
    });

    function addNewCategory() {
        const catName = newCategoryInput.value.trim();
        if (!catName) {
            alert('Please enter a valid category name.');
            return;
        }

        if (categories.includes(catName)) {
            alert('Category already exists!');
            newCategoryInput.value = '';
            newCategoryBox.classList.add('hidden');
            productCategorySelect.value = catName;
            return;
        }

        // Add to array
        categories.push(catName);

        // Add option to Product Form Dropdown
        const newOptionForm = document.createElement('option');
        newOptionForm.value = catName;
        newOptionForm.textContent = catName;
        
        const lastOption = productCategorySelect.options[productCategorySelect.options.length - 1];
        productCategorySelect.insertBefore(newOptionForm, lastOption);

        // Add option to Filter Dropdown
        const newOptionFilter = document.createElement('option');
        newOptionFilter.value = catName;
        newOptionFilter.textContent = catName;
        filterCategorySelect.appendChild(newOptionFilter);

        // Select the new category
        productCategorySelect.value = catName;
        newCategoryInput.value = '';
        newCategoryBox.classList.add('hidden');

        alert(`New Category "${catName}" created and selected!`);
    }

    // Category Filter Change
    filterCategorySelect.addEventListener('change', () => {
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
        const category = productCategorySelect.value;

        if (category === 'NEW_CATEGORY' || !category) {
            alert('Please select or create a valid product category.');
            return;
        }

        const baseRate = parseFloat(document.getElementById('baseRate').value);
        const unit = unitTypeSelect.value;
        const bundlePieces = unit === 'per Bundle' ? (parseInt(bundlePiecesInput.value) || 1) : 0;
        const description = document.getElementById('productDesc').value;

        const newProduct = {
            id: 'p_' + Date.now(),
            title,
            category,
            baseRate,
            unit,
            bundlePieces,
            description: description || 'No additional details provided.',
            imageUrl: uploadedImageDataUrl || 'public/assets/logo.jpg'
        };

        products.unshift(newProduct);

        // Reset form & upload zone
        productForm.reset();
        bundlePiecesGroup.classList.add('hidden');
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
                <p style="font-size: 1.1rem; font-weight: 600;">No mat products found in this category.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(p => {
        const isBundle = p.unit === 'per Bundle' && p.bundlePieces > 0;
        const perPieceRate = isBundle ? Math.round(p.baseRate / p.bundlePieces) : 0;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${p.imageUrl}" alt="${p.title}" class="card-img" onerror="this.src='public/assets/logo.jpg'">
                <span class="category-tag">${p.category}</span>
                ${isBundle ? `
                    <span class="bundle-badge">
                        <i class="fa-solid fa-boxes-packing"></i> ${p.bundlePieces} Pcs / Bundle
                    </span>
                ` : ''}
            </div>

            <div class="card-body">
                <h3 class="product-title">${p.title}</h3>
                <p class="product-details">${p.description}</p>
                
                <div class="price-box">
                    <div>
                        <span class="rate-label">Rate</span>
                        <div class="rate-value">
                            ₹${p.baseRate.toLocaleString('en-IN')}
                            <span class="unit-label">/${p.unit.replace('per ', '')}</span>
                        </div>
                        ${isBundle ? `
                            <div class="piece-rate-hint">(~ ₹${perPieceRate.toLocaleString('en-IN')} / pc)</div>
                        ` : ''}
                    </div>
                </div>

                <div class="card-actions">
                    <button type="button" class="btn-action" onclick="quickUpdatePrice('${p.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Edit Rate / Bundle
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
        
        if (prod.unit === 'per Bundle') {
            const newPcs = prompt(`Update Pieces Count in this Bundle for "${prod.title}":`, prod.bundlePieces || 10);
            if (newPcs && !isNaN(newPcs) && parseInt(newPcs) > 0) {
                prod.bundlePieces = parseInt(newPcs);
            }
        }
        renderProducts();
    }
}
