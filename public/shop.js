document.addEventListener("DOMContentLoaded", function () {

    const productGrid = document.getElementById("productGrid");
    const loadingProducts = document.getElementById("loadingProducts");
    const productError = document.getElementById("productError");

    const categoryButtons =
        document.querySelectorAll(".category-btn");

    let products = [];
    let selectedCategory = "all";
    window.products = [];


    // =====================================================
    // LOAD PRODUCTS
    // =====================================================

    fetch("/api/products")

        .then(function (response) {

            console.log("API response:", response.status);

            if (!response.ok) {
                throw new Error(
                    "Server returned " + response.status
                );
            }

            return response.json();
        })

        .then(function (data) {

            console.log("Products received:", data);

            products = data;
            window.products = products;

            // Hide loading message
            if (loadingProducts) {
                loadingProducts.style.display = "none";
            }

            // Hide error
            if (productError) {
                productError.style.display = "none";
            }

            // Display products
            displayProducts();
            
            // Initialize scroll reveal animations
            initScrollReveal();

        })

        .catch(function (error) {

            console.error(
                "Product loading error:",
                error
            );

            // Hide loading
            if (loadingProducts) {
                loadingProducts.style.display = "none";
            }

            // Show error
            if (productError) {
                productError.style.display = "block";
            }

        });


    // =====================================================
    // DISPLAY PRODUCTS
    // =====================================================

    function displayProducts() {

        if (!productGrid) {
            console.error("productGrid not found");
            return;
        }


        let filteredProducts = products;


        // Filter category
        if (selectedCategory !== "all") {

            filteredProducts = products.filter(function (product) {

                return product.category === selectedCategory;

            });

        }


        // No products
        if (filteredProducts.length === 0) {

            productGrid.innerHTML = `
                <div class="no-products">
                    <h3>No products found</h3>
                    <p>Please check another category.</p>
                </div>
            `;

            return;
        }


        // Create product cards
        productGrid.innerHTML =
            filteredProducts.map(function (product, index) {

                return `

                    <div class="product-card" style="animation-delay: ${index * 0.1}s">

                        <div class="product-image">

                            <img
                                src="${product.image}"
                                alt="${product.name}"
                                onerror="this.style.display='none';"
                            >

                        </div>


                        <div class="product-info">

                            <span class="product-category">
                                ${getCategoryName(product.category)}
                            </span>


                            <h3>
                                ${product.name}
                            </h3>


                            <div class="product-bottom">

                                <span class="product-price">
                                    ₹${product.price}
                                </span>

                                <div class="product-actions">
                                    <a href="product-detail.html?id=${product.id}" class="view-details-btn" onclick="event.preventDefault(); showProductDetails(${product.id});">
                                        <i class="bi bi-eye"></i> View
                                    </a>
                                    <button
                                        class="add-cart-btn"
                                        onclick="addToCart(${product.id})"
                                        title="Add to Cart"
                                    >
                                        <i class="bi bi-cart-plus"></i>
                                    </button>
                                </div>

                            </div>

                        </div>

                    </div>

                `;

            }).join("");

    }


    // =====================================================
    // CATEGORY NAME
    // =====================================================

    // =====================================================
    // CATEGORY BUTTONS
    // =====================================================

    categoryButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            // Remove active from all
            categoryButtons.forEach(function (btn) {

                btn.classList.remove("active");

            });


            // Add active to clicked button
            button.classList.add("active");


            // Get category
            selectedCategory =
                button.dataset.category;


            // Display filtered products
            displayProducts();

        });

    });


    // =====================================================
    // ADD TO CART
    // =====================================================

    window.addToCart = function (productId) {

        const product = products.find(function (item) {

            return item.id === productId;

        });


        if (!product) {
            return;
        }


        let cart =
            JSON.parse(
                localStorage.getItem("amSriCart")
            ) || [];


        const existingProduct =
            cart.find(function (item) {

                return item.id === productId;

            });


        if (existingProduct) {

            existingProduct.quantity += 1;

        } else {

            cart.push({

                id: product.id,

                name: product.name,

                category: product.category,

                price: product.price,

                image: product.image,

                quantity: 1

            });

        }


        localStorage.setItem(
            "amSriCart",
            JSON.stringify(cart)
        );


        updateCartCount();
        
        // Open cart drawer after adding item
        const cartElement = document.getElementById("cartCanvas");
        if (cartElement && typeof bootstrap !== 'undefined') {
            const cartInstance = bootstrap.Offcanvas.getOrCreateInstance(cartElement);
            cartInstance.show();
        } else {
            // Fallback if Bootstrap isn't loaded yet or cartElement not found
            alert(product.name + " added to cart");
        }

    };


    // Load existing cart count
    updateCartCount();

    // Initialize once on page load
    setTimeout(() => {
        initScrollReveal();
    }, 100);

});


function getCategoryName(category) {
    const categoryNames = {
        dog: "DOG SUPPLIES",
        cat: "CAT SUPPLIES",
        fish: "FISH SUPPLIES",
        accessories: "ACCESSORIES"
    };

    return categoryNames[category] || "PET SUPPLIES";
}

function updateCartCount() {
    const cartCount = document.getElementById("cartCount");
    if (!cartCount) return;

    const cart = JSON.parse(localStorage.getItem("amSriCart")) || [];
    let totalItems = 0;

    cart.forEach(function (item) {
        totalItems += item.quantity || 1;
    });

    cartCount.textContent = totalItems;
}

// =====================================================
// SCROLL REVEAL ANIMATIONS - WORLD CLASS ANIMATIONS
// =====================================================
function initScrollReveal() {
    const productCards = document.querySelectorAll('.product-card');
    
    // Create Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Stagger the animation based on card position
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 80); // 80ms stagger between each card
                observer.unobserve(entry.target); // Stop observing once animated
            }
        });
    }, {
        threshold: 0.15, // Trigger when 15% of the card is visible
        rootMargin: '0px 0px -50px 0px'
    });

    // Observe all product cards
    productCards.forEach(card => {
        observer.observe(card);
    });
}


// =====================================================
// PRODUCT DETAILS MODAL - PREMIUM VIEW
// =====================================================
function showProductDetails(productId) {
    const products = window.products || [];
    const product = products.find(p => Number(p.id) === Number(productId));
    if (!product) return;

    const existingModal = document.getElementById('product-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'product-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <button class="modal-close" type="button" aria-label="Close details" onclick="closeModal()">
                    <i class="bi bi-x-lg"></i>
                </button>
                <div class="modal-grid">
                    <div class="modal-image-container">
                        <img src="${product.image}" alt="${product.name}" class="modal-image">
                    </div>
                    <div class="modal-info">
                        <span class="modal-category">${getCategoryName(product.category)}</span>
                        <h2 class="modal-title">${product.name}</h2>
                        <p class="modal-description">
                            Premium quality product designed for your beloved pets. Thoughtfully curated for better comfort,
                            long-lasting performance, and everyday care that brings confidence to your pet-care routine.
                        </p>
                        <div class="modal-features">
                            <span><i class="bi bi-check2-circle"></i> Vet-approved quality</span>
                            <span><i class="bi bi-check2-circle"></i> Everyday reliability</span>
                            <span><i class="bi bi-check2-circle"></i> Safe for regular use</span>
                        </div>
                        <div class="modal-price-row">
                            <span class="modal-price">₹${Number(product.price).toLocaleString("en-IN")}</span>
                            <span class="modal-stock">✓ In Stock</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalStyles = document.createElement('style');
    if (!document.getElementById('modal-styles')) {
        modalStyles.id = 'modal-styles';
        modalStyles.textContent = `
            #product-modal { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; }
            .modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: fadeIn 0.4s ease; }
            .modal-content { position: relative; background: linear-gradient(145deg, rgba(20,14,8,0.98), rgba(10,7,4,0.99)); border: 2px solid rgba(212,160,23,0.3); border-radius: 3rem; width: 90%; max-width: 900px; max-height: 90vh; overflow-y: auto; transform: scale(0.8) translateY(50px); opacity: 0; animation: modalIn 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; box-shadow: 0 50px 100px rgba(0,0,0,0.8), 0 0 80px rgba(242,189,61,0.2); }
            .modal-close { position: absolute; top: 20px; right: 20px; width: 50px; height: 50px; border-radius: 50%; border: 1px solid rgba(242,189,61,0.3); background: rgba(0,0,0,0.5); color: #f2bd3d; font-size: 24px; cursor: pointer; transition: all 0.4s ease; z-index: 10; }
            .modal-close:hover { transform: rotate(90deg) scale(1.1); background: #d71920; border-color: #d71920; }
            .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding: 50px; }
            .modal-image-container { border-radius: 2rem; overflow: hidden; background: linear-gradient(135deg, #1a1008, #0d0905); display: flex; align-items: center; justify-content: center; padding: 30px; }
            .modal-image { max-width: 100%; max-height: 400px; object-fit: contain; transition: transform 0.8s ease; }
            .modal-image:hover { transform: scale(1.05) rotate(2deg); }
            .modal-category { display: inline-block; padding: 8px 20px; background: rgba(242,189,61,0.15); color: #f2bd3d; border-radius: 50px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
            .modal-title { font-size: 2.5rem; font-weight: 800; color: #fff; margin-bottom: 20px; line-height: 1.2; background: linear-gradient(135deg, #f2bd3d, #fff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .modal-description { color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.8; margin-bottom: 20px; }
            .modal-features { display: grid; gap: 10px; margin-bottom: 24px; color: #f5f1ea; font-size: 14px; }
            .modal-features span { display: flex; align-items: center; gap: 10px; }
            .modal-features i { color: #f2bd3d; }
            .modal-price-row { display: flex; align-items: center; gap: 20px; margin-bottom: 40px; }
            .modal-price { font-size: 3rem; font-weight: 900; color: #f2bd3d; }
            .modal-stock { padding: 8px 16px; background: rgba(34,197,94,0.2); color: #22c55e; border-radius: 50px; font-size: 14px; font-weight: 600; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes modalIn { to { transform: scale(1) translateY(0); opacity: 1; } }
            @media (max-width: 768px) { .modal-grid { grid-template-columns: 1fr; padding: 30px; gap: 25px; } .modal-title { font-size: 1.8rem; } .modal-price { font-size: 2rem; } }
        `;
        document.head.appendChild(modalStyles);
    }

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});