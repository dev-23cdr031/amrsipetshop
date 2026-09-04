let allProducts = [];
let currentCategory = "all";

// Single source of truth helpers — the cart ALWAYS lives in localStorage under
// "amSriCart" so it persists across pages, reloads and browser restarts until
// the customer actually places an order.
function readCartSafe() {
  try { return JSON.parse(localStorage.getItem("amSriCart")) || []; } catch (e) { return []; }
}
let cart = readCartSafe();

function setupRevealAnimations() {
  const animatedItems = document.querySelectorAll("[data-animate]");
    if (!animatedItems.length) return;
    
  const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
            if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                            observer.unobserve(entry.target);
                                  }
                                      });
                                        }, { threshold: 0.14 });
                                        
  animatedItems.forEach((item, index) => {
      item.style.transitionDelay = `${index * 80}ms`;
          observer.observe(item);
            });
            }
            
function setupNewsletterForm() {
  const form = document.querySelector(".newsletter-form");
    if (!form) return;
    
  form.addEventListener("submit", (event) => {
      event.preventDefault();
          const button = form.querySelector("button");
              const input = form.querySelector("input");
                  if (button) {
                        button.textContent = "Joined";
                              button.disabled = true;
                                  }
                                      if (input) {
                                            input.value = "";
                                                  input.placeholder = "You’re subscribed";
                                                      }
                                                        });
                                                        }
                                                        
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
    setupRevealAnimations();
      setupNewsletterForm();
      
  const productGrid = document.getElementById("productGrid");
    if (productGrid) {
        loadProducts();
            setupCategoryButtons();
              // Load wishlist state after products are rendered
              setTimeout(() => loadWishlistState(), 1000);
              }
              
  setupCheckout();
  });
  
// Fallback catalogue — only used if the live products API cannot be reached.
// The live catalogue comes from /api/products, so anything the admin adds,
// edits, marks out of stock or deletes is reflected on the shop immediately.
const FALLBACK_PRODUCTS = [
        // Fish Products (images 01-11 are fish products)
        { id: 1, name: "Freeze Dried Tubifex Worms 20grms", price: 10, category: "fish", image: "images/product-01.jpeg" },
        { id: 2, name: "Taiyo 100grms", price: 30, category: "fish", image: "images/product-02.jpeg" },
        { id: 3, name: "Osaka Green 100grms", price: 70, category: "fish", image: "images/product-03.jpeg" },
        { id: 4, name: "Optimum 100grms", price: 100, category: "fish", image: "images/product-04.jpeg" },
        { id: 5, name: "Royal Breeding feed Betta fish", price: 70, category: "fish", image: "images/product-05.jpeg" },
        { id: 6, name: "Royal Breeding feed Guppy fish", price: 70, category: "fish", image: "images/product-06.jpeg" },
        { id: 7, name: "Royal Glowfish food", price: 70, category: "fish", image: "images/product-07.jpeg" },
        { id: 8, name: "Royal flowerhorn fish food", price: 180, category: "fish", image: "images/product-08.jpeg" },
        { id: 9, name: "Royal Oscar fish food", price: 180, category: "fish", image: "images/product-09.jpeg" },
        { id: 10, name: "Champion Guppy feed", price: 49, category: "fish", image: "images/product-10.jpeg" },
        { id: 11, name: "Champion Betta feed", price: 49, category: "fish", image: "images/product-11.jpeg" },
        // Aquarium Accessories (images 12-24 are aquarium equipment)
        { id: 12, name: "Bluepet BL-108 air pump", price: 220, category: "accessories", image: "images/product-12.jpeg" },
        { id: 13, name: "Liny Mute air pump", price: 180, category: "accessories", image: "images/product-13.jpeg" },
        { id: 14, name: "Bluepet liquid filter", price: 250, category: "accessories", image: "images/product-14.jpeg" },
        { id: 15, name: "Bluepet Liquid filter BL-420F", price: 350, category: "accessories", image: "images/product-15.jpeg" },
        { id: 16, name: "Bluepet Internal liquid filter BL-1000F", price: 400, category: "accessories", image: "images/product-16.jpeg" },
        { id: 17, name: "Bluepet Biosponge filter", price: 90, category: "accessories", image: "images/product-17.jpeg" },
        { id: 18, name: "Bluepet airstone filter", price: 220, category: "accessories", image: "images/product-18.jpeg" },
        { id: 19, name: "Liny mini hanging filter", price: 400, category: "accessories", image: "images/product-19.jpeg" },
        { id: 20, name: "SOBO internal filter", price: 700, category: "accessories", image: "images/product-20.jpeg" },
        { id: 21, name: "Bluepet BW-60", price: 9999, category: "accessories", image: "images/product-21.jpeg" },
        { id: 22, name: "Bluepet BW-80", price: 16000, category: "accessories", image: "images/product-22.jpeg" },
        { id: 23, name: "Bluepet BW-120", price: 26000, category: "accessories", image: "images/product-23.jpeg" },
        { id: 24, name: "Bluepet BW-150", price: 34500, category: "accessories", image: "images/product-24.jpeg" },
        // Dog Products (images 25-31 are dog products)
        { id: 25, name: "Dog milk stick 250grms", price: 240, category: "dog", image: "images/product-25.jpeg" },
        { id: 26, name: "Chicken Stock 250grms", price: 100, category: "dog", image: "images/product-26.jpeg" },
        { id: 27, name: "Mutton stock 250grms", price: 100, category: "dog", image: "images/product-27.jpeg" },
        { id: 28, name: "Pyoclear Dog Shampoo", price: 380, category: "dog", image: "images/product-28.jpeg" },
        { id: 29, name: "Dermfine Dog shampoo", price: 390, category: "dog", image: "images/product-29.jpeg" },
        { id: 30, name: "Glow coat syrup", price: 460, category: "dog", image: "images/product-30.jpeg" },
        { id: 31, name: "Itch relief tablet", price: 280, category: "dog", image: "images/product-31.jpeg" }
      ];

function loadProducts() {
  const grid = document.getElementById("productGrid");

  // Show skeleton loading cards first for modern UX
  if (grid) {
    grid.innerHTML = generateSkeletonLoaders(6); // Show 6 skeleton cards
  }

  // Live catalogue from the server — admin adds/edits/stock changes show up here
  fetch("/api/products")
    .then(function (response) {
      if (!response.ok) throw new Error("Server returned " + response.status);
      return response.json();
    })
    .then(function (data) {
      allProducts = Array.isArray(data) ? data.filter(function (p) { return !p.archived; }) : FALLBACK_PRODUCTS;
      displayProducts();
    })
    .catch(function (error) {
      // API unreachable — fall back to the bundled catalogue so the shop still works
      console.error("Product loading error (using fallback catalogue):", error);
      allProducts = FALLBACK_PRODUCTS;
      displayProducts();
    });
}
// Generate modern skeleton loading cards for product grid
function generateSkeletonLoaders(count) {
  let skeletons = '';
  for (let i = 0; i < count; i++) {
    skeletons += `
      <div class="product-card skeleton-card">
        <div class="skeleton-image"></div>
        <div class="skeleton-content">
          <div class="skeleton-category"></div>
          <div class="skeleton-title"></div>
          <div class="skeleton-title" style="width:60%;height:16px;margin-bottom:15px;"></div>
          <div class="skeleton-price"></div>
          <div class="skeleton-buttons">
            <div class="skeleton-btn" style="width:70%;"></div>
            <div class="skeleton-btn" style="width:20%;"></div>
          </div>
        </div>
      </div>
    `;
  }
  return skeletons;
}
                                                                          
function displayProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  
  grid.innerHTML = "";
  let filteredProducts = currentCategory === "all" ? allProducts : allProducts.filter(product => product.category === currentCategory);
  
  if (filteredProducts.length === 0) {
    grid.innerHTML = `
    <div style="color:#e7ad32;font-size:35px;margin-bottom:15px;text-align:center;width:100%;grid-column:1/-1;"><i class="bi bi-search"></i></div>
    <h3 style="color:#eee;font-size:18px;text-align:center;width:100%;grid-column:1/-1;">No products found in this category</h3>
    <p style="color:#999;font-size:12px;text-align:center;width:100%;grid-column:1/-1;">Try selecting a different category to see more products.</p>
  `;
  return;
  }
  
  filteredProducts.forEach(product => grid.appendChild(createProductCard(product)));

  const countEl = document.getElementById("visibleProductCount");
  if (countEl) countEl.textContent = filteredProducts.length;

  if (typeof initShopScrollReveal === "function") initShopScrollReveal();
  loadWishlistState();
  }
    
function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  const price = Number(product.price) || 0;
  const stock = product.stock == null ? null : Number(product.stock);
  const outOfStock = stock !== null && stock <= 0;

  // Live stock status straight from the admin dashboard
  const stockBadge = outOfStock
    ? '<span class="product-stock out-of-stock"><i class="bi bi-x-circle-fill"></i> Out of stock</span>'
    : (stock !== null && stock <= 5
        ? '<span class="product-stock low-stock"><i class="bi bi-exclamation-triangle-fill"></i> Low stock</span>'
        : '<span class="product-stock"><i class="bi bi-check-circle-fill"></i> In stock</span>');

  card.innerHTML = `
    <button class="wishlist-btn" onclick="toggleWishlist(${product.id})" title="Add to Wishlist" aria-label="Add to wishlist">
      <i class="bi bi-heart"></i>
    </button>
    <div class="product-image">
      <img src="${product.image}" alt="${escapeHtml(product.name)}" class="product-img" loading="lazy"
        onerror="this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22><rect width=%22100%%22 height=%22100%%22 fill=%22%23121514%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23c58a4b%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>Image unavailable</text></svg>';" />
      <div class="product-image-overlay">
        <button type="button" class="quick-view-btn" onclick="viewProduct(${product.id})" aria-label="Quick view ${escapeHtml(product.name)}">
          <i class="bi bi-eye"></i>
          <span>Quick View</span>
        </button>
      </div>
    </div>
    <div class="product-info">
      <span class="product-category">${getCategoryName(product.category)}</span>
      <h3 class="product-name">${escapeHtml(product.name)}</h3>
      <div class="product-price-row">
        <span class="product-price">₹${price.toLocaleString("en-IN")}</span>
        ${stockBadge}
      </div>
      <div class="card-actions">
        <button type="button" class="view-button" onclick="viewProduct(${product.id})" aria-label="View ${escapeHtml(product.name)}">
          <i class="bi bi-eye"></i>
          <span>View</span>
        </button>
        <button type="button" class="add-cart-button" onclick="addToCart(${product.id})" ${outOfStock ? 'disabled style="opacity:0.5;cursor:not-allowed;" title="Out of stock"' : ''} aria-label="Add ${escapeHtml(product.name)} to cart">
          <i class="bi bi-bag-plus"></i>
          <span>Add</span>
        </button>
      </div>
    </div>
  `;
  return card;
}
                                                                    
function getCategoryName(category) {
  const categories = { dog: "Dog Supplies", cat: "Cat Supplies", fish: "Fish Supplies", accessories: "Accessories" };
    return categories[category] || "Pet Supplies";
    }

// Load wishlist state from localStorage and update UI
function loadWishlistState() {
  const wishlist = JSON.parse(localStorage.getItem("amSriWishlist")) || [];
  const wishlistIds = wishlist.map(item => Number(item.id));
  
  // Update wishlist count in header
  updateWishlistCount();
  
  // Update all wishlist buttons to reflect stored state
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr) {
      const productIdMatch = onclickAttr.match(/toggleWishlist\((\d+)\)/);
      if (productIdMatch) {
        const productId = Number(productIdMatch[1]);
        if (wishlistIds.includes(productId)) {
          btn.classList.add('active');
          const icon = btn.querySelector('i');
          if (icon) icon.className = 'bi bi-heart-fill';
          btn.style.color = '#ef4444';
        }
      }
    }
  });
}
    
function setupCategoryButtons() {
  const buttons = document.querySelectorAll(".category-btn");
    buttons.forEach(button => {
        button.addEventListener("click", () => {
              buttons.forEach(item => item.classList.remove("active"));
                    button.classList.add("active");
                          currentCategory = button.dataset.category;
                                displayProducts();
                                    });
                                      });
                                      
  const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get("category");
      if (urlCategory && ["dog", "cat", "fish", "accessories"].includes(urlCategory)) {
          currentCategory = urlCategory;
              buttons.forEach(button => {
                    button.classList.remove("active");
                          if (button.dataset.category === urlCategory) button.classList.add("active");
                              });
                                }
                                }
                                
function toggleWishlist(productId) {
  const button = (typeof event !== 'undefined' && event && event.target) ? event.target.closest('.wishlist-btn') : null;
  const icon = button ? button.querySelector('i') : null;
  
  // localStorage is the single source of truth for the wishlist — it persists
  // across pages and sessions until the customer removes the item themselves.
  let wishlist = [];
  try { wishlist = JSON.parse(localStorage.getItem("amSriWishlist")) || []; } catch (e) { wishlist = []; }
  const existingIndex = wishlist.findIndex(item => Number(item.id) === Number(productId));
  
  if (existingIndex === -1) {
    // Add to wishlist
    const product = allProducts.find(item => Number(item.id) === Number(productId));
    if (product) {
      wishlist.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image
      });
      localStorage.setItem("amSriWishlist", JSON.stringify(wishlist));
      if (button) button.classList.add('active');
      if (icon) { icon.className = 'bi bi-heart-fill'; button.style.color = '#ef4444'; }
    }
  } else {
    // Remove from wishlist
    wishlist.splice(existingIndex, 1);
    localStorage.setItem("amSriWishlist", JSON.stringify(wishlist));
    if (button) button.classList.remove('active');
    if (icon) { icon.className = 'bi bi-heart'; button.style.color = ''; }
  }
  updateWishlistCount();
}

let currentModalProductId = null;

function viewProduct(productId) {
  const product = allProducts.find(item => Number(item.id) === Number(productId));
  if (!product) {
    console.error("Product not found:", productId);
    return;
  }

  currentModalProductId = productId;
  const modal = document.getElementById('productModal');
  const modalBody = document.getElementById('modalBody');
  
  if (!modal || !modalBody) {
    console.error("Modal elements not found");
    return;
  }

  // Use try-catch to handle any errors and prevent infinite loading
  try {
    // Show loading state while modal opens
    modalBody.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:#ef4444;">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p style="margin-left:15px;margin-bottom:0;">Loading product details...</p>
      </div>
    `;
    
    // Open the modal
    modal.classList.add('active');
    
    // Modal header already exists in static HTML, just ensure it's properly set up
    const modalContent = modal.querySelector('.modal-content');
    // Remove any duplicate header elements that might have been added previously
    const existingHeaders = modalContent.querySelectorAll('.modal-header');
    if (existingHeaders.length > 1) {
      // Keep only the first header, remove duplicates
      for (let i = 1; i < existingHeaders.length; i++) {
        existingHeaders[i].remove();
      }
    }
    
    // Populate modal with product details after brief delay to show loading
    setTimeout(() => {
      try {
        // Generate dynamic product specifications based on category
        const generateProductSpecs = (prod) => {
          // Dynamic specs based on product category as requested
          if (prod.category === 'fish' || prod.category === 'accessories') {
            // Fish / Aquarium Supplies specifications
            return [
              "High-Protein Formula",
              "Suitable for Tropical & Marine Fish",
              "Floating Pellets",
              "Enhances Natural Colors",
              "Non-Water Clouding"
            ];
          } else if (prod.category === 'dog' || prod.category === 'cat') {
            // Dog / Cat Supplies specifications
            return [
              "Highly Digestible",
              "Premium Ingredients",
              "Vet Approved",
              "Suitable for All Breeds"
            ];
          }
          // Fallback specs for any other categories
          return ["Premium Quality", "Safe for Pets", "Vet Approved"];
        };
        
        const specs = generateProductSpecs(product);
        
        // Fix image source mapping - check multiple possible property names
        const imageUrl = product.image || product.image_url || product.src || product.img || 'https://placehold.co/600x400/e74c3c/ffffff?text=Product+Image';
        
        // Implement the new 2-column grid layout as requested with all styling requirements
        modalBody.innerHTML = `
          <div class="modal-grid">
            <div class="modal-image-wrap">
              <img src="${imageUrl}" alt="${escapeHtml(product.name)}" class="modal-image"
                onerror="this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22><rect width=%22100%%22 height=%22100%%22 fill=%22%23121514%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23c58a4b%22 text-anchor=%22middle%22 dy=%22.3em%22>Image unavailable</text></svg>';">
            </div>
            <div class="modal-details">
              <div class="modal-meta-top">
                <span class="modal-category">${getCategoryName(product.category)}</span>
                ${(product.stock != null && Number(product.stock) <= 0)
                  ? '<span class="stock-badge out-of-stock"><i class="bi bi-x-circle-fill"></i> Out of Stock</span>'
                  : '<span class="stock-badge in-stock"><i class="bi bi-check-circle-fill"></i> In Stock</span>'}
              </div>
              <h2 class="modal-title">${escapeHtml(product.name)}</h2>
              <div class="modal-price">₹${Number(product.price).toLocaleString("en-IN")}</div>
              <div class="modal-rating">
                <i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-half"></i>
                <span>4.5 · 128 reviews</span>
              </div>
              <p class="modal-description">${escapeHtml(product.description || 'High-quality pet product for your beloved companion. Premium materials, vet-approved quality, and everyday reliability for dogs, cats, and aquariums.')}</p>
              <div class="product-specs">
                <h4>Key Specifications</h4>
                <div class="specs-grid">
                  ${specs.map(spec => `<div class="spec-item"><i class="bi bi-check2-circle"></i> ${escapeHtml(spec)}</div>`).join("")}
                </div>
              </div>
            </div>
          </div>
        `;
      } catch (contentError) {
        console.error("Error loading modal content:", contentError);
        // Show error UI with retry button if content fails to load
        modalBody.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;color:#ef4444;text-align:center;">
            <i class="bi bi-exclamation-circle" style="font-size:48px;margin-bottom:20px;"></i>
            <h3 style="color:#eee;font-size:18px;margin-bottom:10px;">Failed to load product details</h3>
            <p style="color:#999;font-size:14px;margin-bottom:20px;">There was an error loading this product. Please try again.</p>
            <button onclick="viewProduct(${productId})" style="padding:12px 24px;background:#ef4444;color:white;border:none;border-radius:50px;cursor:pointer;font-weight:600;transition:all 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
              <i class="bi bi-arrow-clockwise"></i> Try Again
            </button>
          </div>
        `;
      }
    }, 300);
  } catch (error) {
    console.error("Fatal error opening product modal:", error);
    // Ensure modal is closed and loading state is cleared if there's a fatal error
    modal.classList.remove('active');
    modalBody.innerHTML = '';
  }
}

function closeModal() {
  const modal = document.getElementById('productModal');
  const modalBody = document.getElementById('modalBody');
  if (modal) {
    modal.classList.remove('active');
    // Clear modal body after animation completes to prevent any leftover loading states
    setTimeout(() => {
      if (modalBody) modalBody.innerHTML = '';
    }, 300);
  }
}

// Add close event listener to modal close button
document.addEventListener('DOMContentLoaded', () => {
  const modalCloseBtn = document.getElementById('modalClose');
  const modalBackBtn = document.getElementById('modalBackBtn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
  if (modalBackBtn) {
    modalBackBtn.addEventListener('click', closeModal);
  }
  
  // Close modal when clicking outside of modal content
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
});

function addToCartFromModal(quantity = 1) {
  if (currentModalProductId) {
    for (let i = 0; i < quantity; i++) {
      addToCart(currentModalProductId);
    }
  }
}

// Quantity selector functions
function updateQuantity(change) {
  const qtyInput = document.getElementById('productQuantity');
  if (qtyInput) {
    let currentQty = parseInt(qtyInput.value) || 1;
    currentQty = Math.max(1, Math.min(99, currentQty + change));
    qtyInput.value = currentQty;
  }
}

// Buy Now function for instant checkout
function buyNow(productId, quantity = 1) {
  if (!productId) return;
  for (let i = 0; i < quantity; i++) {
    addToCart(productId);
  }
  closeModal();
  if (typeof proceedToCheckout === "function") {
    proceedToCheckout();
  }
}

function toggleWishlistFromModal() {
  if (currentModalProductId) {
    // Find the product's wishlist button on the page and toggle it
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach(card => {
      const addToCartBtn = card.querySelector('.add-cart-button');
      if (addToCartBtn && addToCartBtn.getAttribute('onclick').includes(currentModalProductId)) {
        const wishlistBtn = card.querySelector('.wishlist-btn');
        if (wishlistBtn) wishlistBtn.click();
      }
    });
  }
}

function addToCart(productId) {
  const product = allProducts.find(item => Number(item.id) === Number(productId));
    if (!product) return;
    // Respect the admin's stock control — out-of-stock items cannot be added
    if (product.stock != null && Number(product.stock) <= 0) {
      alert('"' + product.name + '" is out of stock right now. Please check back soon.');
      return;
    }
    
  // Create flying animation
  const addButton = event.target.closest('.add-cart-button');
  const productCard = addButton.closest('.product-card');
  const productImage = productCard.querySelector('img');
  
  if (productImage) {
    // Get positions
    const imageRect = productImage.getBoundingClientRect();
    const cartIcon = document.querySelector('.cart-link i');
    const cartRect = cartIcon.getBoundingClientRect();
    
    // Create flying element
    const flyingImage = document.createElement('img');
    flyingImage.src = product.image;
    flyingImage.className = 'flying-product';
    flyingImage.style.left = imageRect.left + 'px';
    flyingImage.style.top = imageRect.top + 'px';
    document.body.appendChild(flyingImage);
    
    // Animate to cart
    setTimeout(() => {
      flyingImage.style.left = cartRect.left + (cartRect.width/2) - 30 + 'px';
      flyingImage.style.top = cartRect.top + (cartRect.height/2) - 30 + 'px';
    }, 50);
    
    // Add bounce effect to cart
    cartIcon.classList.add('cart-bounce');
    
    // Remove flying element after animation
    setTimeout(() => {
      document.body.removeChild(flyingImage);
      cartIcon.classList.remove('cart-bounce');
    }, 800);
  }
    
  const existing = cart.find(item => Number(item.id) === Number(productId));
    if (existing) existing.quantity += 1;
      else cart.push({ id: product.id, name: product.name, price: Number(product.price), image: product.image, quantity: 1 });
      
  saveCart();
    updateCartCount();
      // Don't open cart automatically anymore, let the animation finish
      setTimeout(showCart, 900);
      }
      
function saveCart() { localStorage.setItem("amSriCart", JSON.stringify(cart)); }
function updateCartCount() {
  const countElement = document.getElementById("cartCount");
    if (!countElement) return;
      // Get cart from localStorage to work across all pages
      const cart = JSON.parse(localStorage.getItem("amSriCart")) || [];
      const count = cart.reduce((total, item) => total + (item.quantity || 1), 0);
        countElement.textContent = count;
        }

function updateWishlistCount() {
  const countElement = document.getElementById("wishlistCount");
  if (!countElement) return;

  // Get wishlist from localStorage to work across all pages
  const wishlist = JSON.parse(localStorage.getItem("amSriWishlist")) || [];
  const previousCount = parseInt(countElement.textContent) || 0;
  
  if (previousCount !== wishlist.length) {
    countElement.classList.remove('wishlist-count-bounce');
    void countElement.offsetWidth; // Trigger reflow to restart animation
    countElement.classList.add('wishlist-count-bounce');
  }
  
  countElement.textContent = wishlist.length;
}
        function openCart() { showCart(); }
        function showCart() {
          const cartElement = document.getElementById("cartCanvas");
          const cartOverlay = document.getElementById("cartOverlay");
            if (!cartElement) {
              console.log("cartCanvas element not found");
              return;
            }
                renderCart();
                // Simple vanilla JS drawer show
                cartElement.style.right = "0";
                if (cartOverlay) cartOverlay.style.display = "block";
                  }

function closeCart() {
          const cartElement = document.getElementById("cartCanvas");
          const cartOverlay = document.getElementById("cartOverlay");
          if (cartElement) cartElement.style.right = "-100%";
          if (cartOverlay) cartOverlay.style.display = "none";
                  }
                  function renderCart() {
                    const cartItems = document.getElementById("cartItems");
                      const cartEmpty = document.getElementById("cartEmpty");
                        const cartSummary = document.getElementById("cartSummary");
                          const cartTotal = document.getElementById("cartTotal");
                            const cartSubtotal = document.getElementById("cartSubtotal");
                              const cartItemCount = document.getElementById("cartItemCount");
                                if (!cartItems) return;
                            
  cartItems.innerHTML = "";
    if (cart.length === 0) {
        if (cartEmpty) cartEmpty.style.display = "block";
            if (cartSummary) cartSummary.style.display = "none";
                if (cartItemCount) cartItemCount.textContent = "0";
                return;
                  }
                  
  if (cartEmpty) cartEmpty.style.display = "none";
    if (cartSummary) cartSummary.style.display = "block";
    
  let total = 0;
  let itemCount = 0;
    cart.forEach((item, index) => {
        const itemTotal = Number(item.price) * item.quantity;
            total += itemTotal;
            itemCount += item.quantity;
                const row = document.createElement("div");
                    row.style.cssText = "display: flex; align-items: center; gap: 12px; background-color: #171717; border: 1px solid #262626; border-radius: 12px; padding: 12px; margin-bottom: 12px;";
                        row.innerHTML = `
                              <!-- Product thumbnail - Strictly limited size -->
                              <img src="${item.image}" alt="${escapeHtml(item.name)}" style="width: 56px; height: 56px; object-fit: contain; background-color: #0a0a0a; border-radius: 8px; border: 1px solid #262626; padding: 4px; flex-shrink: 0;">
                              
                              <!-- Middle Content -->
                              <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 14px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.name)}</div>
                                <div style="font-size: 12px; color: #a3a3a3; margin-top: 2px;">₹${Number(item.price).toLocaleString("en-IN")}</div>
                                
                                <!-- Modern quantity pill controls -->
                                <div style="display: inline-flex; align-items: center; background-color: #0a0a0a; border: 1px solid #262626; border-radius: 6px; margin-top: 8px;">
                                  <button onclick="updateQuantity(${index}, -1)" style="background: none; border: none; color: #ffffff; padding: 2px 8px; cursor: pointer; font-size: 14px;">-</button>
                                  <span style="font-size: 12px; font-weight: bold; padding: 0 6px; color: #fff;">${item.quantity}</span>
                                  <button onclick="updateQuantity(${index}, 1)" style="background: none; border: none; color: #ffffff; padding: 2px 8px; cursor: pointer; font-size: 14px;">+</button>
                                </div>
                              </div>
                              
                              <!-- Right Side - Total & Trash -->
                              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                                <button onclick="removeFromCart(${index})" style="background: none; border: none; color: #737373; cursor: pointer; font-size: 14px;">✕</button>
                                <span style="font-size: 14px; font-weight: 700; color: #f43f5e;">₹${itemTotal.toLocaleString("en-IN")}</span>
                              </div>
                                                                    `;
                                                                        cartItems.appendChild(row);
                                                                          });
                                                                          
  if (cartTotal) cartTotal.textContent = `₹${total.toLocaleString("en-IN")}`;
  if (cartSubtotal) cartSubtotal.textContent = `₹${total.toLocaleString("en-IN")}`;
  if (cartItemCount) cartItemCount.textContent = itemCount;
  }

  // Update item quantity in cart
  function updateQuantity(index, change) {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
      removeFromCart(index);
      return;
    }
    localStorage.setItem('amSriCart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
  }

  // Remove item from cart
  function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('amSriCart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
  }

// Wishlist drawer functions
function openWishlist() { window.location.href = "wishlist.html"; }
function showWishlist() {
  const wishlistElement = document.getElementById("wishlistCanvas");
  const wishlistOverlay = document.getElementById("wishlistOverlay");
  if (!wishlistElement) {
    console.log("wishlistCanvas element not found");
    return;
  }
  renderWishlist();
  // Simple vanilla JS drawer show
  wishlistElement.style.right = "0";
  if (wishlistOverlay) wishlistOverlay.style.display = "block";
}

function closeWishlist() {
  const wishlistElement = document.getElementById("wishlistCanvas");
  const wishlistOverlay = document.getElementById("wishlistOverlay");
  if (wishlistElement) wishlistElement.style.right = "-100%";
  if (wishlistOverlay) wishlistOverlay.style.display = "none";
}

function renderWishlist() {
  const wishlistItems = document.getElementById("wishlistItems");
  const wishlistEmpty = document.getElementById("wishlistEmpty");
  if (!wishlistItems) return;

  const wishlist = JSON.parse(localStorage.getItem("amSriWishlist")) || [];
  wishlistItems.innerHTML = "";

  if (wishlist.length === 0) {
    if (wishlistEmpty) wishlistEmpty.style.display = "flex";
    return;
  }
  if (wishlistEmpty) wishlistEmpty.style.display = "none";

  wishlist.forEach(item => {
    const row = document.createElement("div");
    row.className = "wishlist-item";
    row.innerHTML = `
            <div style="display: flex; gap: 16px; align-items: flex-start;">
              <div style="position: relative; overflow: hidden; border-radius: 12px; flex-shrink: 0;">
                <img src="${item.image}" alt="${escapeHtml(item.name)}" style="width: 80px; height: 80px; object-fit: cover;">
              </div>
              <div class="item-details">
                <p class="item-name">${escapeHtml(item.name)}</p>
                <p class="item-price">₹${Number(item.price).toLocaleString("en-IN")}</p>
                <button onclick="addToCartFromWishlist(${item.id})" class="add-to-cart-btn">
                  <i class="bi bi-cart-plus"></i>
                  Add to Cart
                </button>
              </div>
              <button onclick="removeFromWishlist(${item.id})" class="remove-btn" title="Remove from wishlist">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          `;
    wishlistItems.appendChild(row);
  });
}

// Add to cart from wishlist function
function addToCartFromWishlist(productId) {
  // Find the product in wishlist
  const wishlist = JSON.parse(localStorage.getItem("amSriWishlist")) || [];
  const item = wishlist.find(i => Number(i.id) === Number(productId));
  
  if (item) {
    // Add to cart
    const cart = JSON.parse(localStorage.getItem("amSriCart")) || [];
    const existingCartItem = cart.find(cartItem => Number(cartItem.id) === Number(productId));
    
    if (existingCartItem) {
      existingCartItem.quantity += 1;
    } else {
      cart.push({
        ...item,
        quantity: 1
      });
    }
    
    localStorage.setItem("amSriCart", JSON.stringify(cart));
    updateCartCount();
    
    // Add animation to the button
    event.target.closest('.add-to-cart-btn').innerHTML = '<i class="bi bi-check-lg"></i> Added!';
    event.target.closest('.add-to-cart-btn').style.background = 'linear-gradient(135deg, #16a34a, #15803d)';
    
    setTimeout(() => {
      event.target.closest('.add-to-cart-btn').innerHTML = '<i class="bi bi-cart-plus"></i> Add to Cart';
      event.target.closest('.add-to-cart-btn').style.background = '';
    }, 1500);
  }
}

function removeFromWishlist(productId) {
  let wishlist = JSON.parse(localStorage.getItem("amSriWishlist")) || [];
  wishlist = wishlist.filter(item => Number(item.id) !== Number(productId));
  localStorage.setItem("amSriWishlist", JSON.stringify(wishlist));
  
  // Update UI
  loadWishlistState();
  updateWishlistCount();
  
  // Re-render wishlist if drawer is open
  renderWishlist();
}
  function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                        }
                        function setupCheckout() {
  const checkoutButton = document.getElementById("checkoutButton");
  if (!checkoutButton) return;
  checkoutButton.addEventListener("click", proceedToCheckout);
}

// BULLETPROOF CHECKOUT STATE MANAGEMENT - MIRRORS REACT HOOKS
let checkoutStep = 'form'; // 'form' | 'success'
const EMPTY_CHECKOUT_FORM = { name: '', phone: '', address: '', city: '', state: '', pincode: '' };
let checkoutFormData = Object.assign({}, EMPTY_CHECKOUT_FORM);
// Details of the order the server confirmed (used by the success view)
let lastPlacedOrder = null;

// Render checkout content based on current step
function renderCheckout() {
  const dynamicContent = document.getElementById('checkoutDynamicContent');
  const header = document.getElementById('checkoutHeader');
  
  // DOM element validation - critical for fail-safe operation
  if (!dynamicContent) {
    console.error("❌ checkoutDynamicContent element not found in DOM!");
    return;
  }
  if (!header) {
    console.error("❌ checkoutHeader element not found in DOM!");
    return;
  }
  
  console.log("🎨 renderCheckout() called with step:", checkoutStep);
  const cart = readCartSafe();
  const subtotal = cart.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1)), 0);
  console.log("📊 Cart subtotal for render:", subtotal);
  
  // Update header
  header.textContent = checkoutStep === 'form' ? 'Shipping & Order Details' : 'Order Placed!';
  
  // An empty cart can never be checked out — show the honest empty state
  if (checkoutStep === 'form' && cart.length === 0) {
    dynamicContent.innerHTML = `
      <div style="padding: 40px 24px; text-align: center;">
        <div style="font-size: 44px; margin-bottom: 12px;">🛒</div>
        <h4 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">Your cart is empty</h4>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #a3a3a3;">Add some products before checking out.</p>
        <button onclick="closeCheckout()" style="background-color: #262626; color: #fff; font-weight: 600; padding: 12px 24px; border-radius: 10px; border: none; cursor: pointer;">Back to Shop</button>
      </div>
    `;
    return;
  }
  
  if (checkoutStep === 'form') {
    // Render form view
    dynamicContent.innerHTML = `
      <!-- Total Card -->
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <span style="font-size: 12px; color: #a3a3a3; display: block;">Order Total</span>
          <span style="font-size: 20px; font-weight: 800; color: #f43f5e;">₹${subtotal}</span>
        </div>
        <span style="background-color: rgba(34, 197, 94, 0.15); color: #22c55e; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(34, 197, 94, 0.3);">Cash on Delivery (COD)</span>
      </div>

      <!-- Form Inputs -->
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 12px; font-weight: 600; color: #d4d4d4; margin-bottom: 6px;">Full Name *</label>
        <input type="text" id="checkoutName" value="${checkoutFormData.name}" style="width: 100%; background-color: #121212; border: 1px solid #262626; border-radius: 10px; padding: 12px; color: #fff; font-size: 14px; outline: none; box-sizing: border-box;">
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 12px; font-weight: 600; color: #d4d4d4; margin-bottom: 6px;">Phone Number *</label>
        <input type="tel" id="checkoutPhone" value="${checkoutFormData.phone}" style="width: 100%; background-color: #121212; border: 1px solid #262626; border-radius: 10px; padding: 12px; color: #fff; font-size: 14px; outline: none; box-sizing: border-box;">
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 12px; font-weight: 600; color: #d4d4d4; margin-bottom: 6px;">Full Delivery Address *</label>
        <textarea id="checkoutAddress" rows="3" style="width: 100%; background-color: #121212; border: 1px solid #262626; border-radius: 10px; padding: 12px; color: #fff; font-size: 14px; outline: none; resize: none; box-sizing: border-box;">${escapeHtml(checkoutFormData.address || '')}</textarea>
      </div>

      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <div style="flex: 1;">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #d4d4d4; margin-bottom: 6px;">City *</label>
          <input type="text" id="checkoutCity" value="${escapeHtml(checkoutFormData.city || '')}" style="width: 100%; background-color: #121212; border: 1px solid #262626; border-radius: 10px; padding: 12px; color: #fff; font-size: 14px; outline: none; box-sizing: border-box;">
        </div>
        <div style="flex: 1;">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #d4d4d4; margin-bottom: 6px;">State *</label>
          <input type="text" id="checkoutState" value="${escapeHtml(checkoutFormData.state || '')}" style="width: 100%; background-color: #121212; border: 1px solid #262626; border-radius: 10px; padding: 12px; color: #fff; font-size: 14px; outline: none; box-sizing: border-box;">
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 12px; font-weight: 600; color: #d4d4d4; margin-bottom: 6px;">PIN Code (6 digits) *</label>
        <input type="text" id="checkoutPincode" maxlength="6" inputmode="numeric" value="${escapeHtml(checkoutFormData.pincode || '')}" style="width: 100%; background-color: #121212; border: 1px solid #262626; border-radius: 10px; padding: 12px; color: #fff; font-size: 14px; outline: none; box-sizing: border-box;">
      </div>

      <!-- Explicit Action Button -->
      <button type="button" id="confirmOrderBtn" onclick="handleConfirmOrder()" style="width: 100%; background-color: #e11d48; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px; border-radius: 12px; border: none; cursor: pointer; margin-top: 8px; box-shadow: 0 10px 20px -5px rgba(225, 29, 72, 0.4);">Confirm Order (Cash on Delivery)</button>
    `;
    
    // Add input event listeners to keep formData updated
    document.getElementById('checkoutName').addEventListener('input', (e) => {
      checkoutFormData.name = e.target.value;
    });
    document.getElementById('checkoutPhone').addEventListener('input', (e) => {
      checkoutFormData.phone = e.target.value;
    });
    document.getElementById('checkoutAddress').addEventListener('input', (e) => {
      checkoutFormData.address = e.target.value;
    });
    document.getElementById('checkoutCity').addEventListener('input', (e) => {
      checkoutFormData.city = e.target.value;
    });
    document.getElementById('checkoutState').addEventListener('input', (e) => {
      checkoutFormData.state = e.target.value;
    });
    document.getElementById('checkoutPincode').addEventListener('input', (e) => {
      checkoutFormData.pincode = e.target.value;
    });
  } else {
    // Render success view — details come from the order the server stored
    const placed = lastPlacedOrder || { orderId: '', total: subtotal, name: checkoutFormData.name, phone: checkoutFormData.phone, address: checkoutFormData.address };
    dynamicContent.innerHTML = `
      <!-- Success Screen -->
      <div style="padding: 32px 24px; text-align: center;">
        <div style="width: 60px; height: 60px; background-color: rgba(34, 197, 94, 0.15); color: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px auto; border: 1px solid rgba(34, 197, 94, 0.3);">✓</div>
        <h4 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800;">Order Placed Successfully!</h4>
        ${placed.orderId ? '<p style="margin: 0 0 12px 0; font-size: 12px; color: #a3a3a3;">Order ID: <strong style="color: #f43f5e;">' + escapeHtml(placed.orderId) + '</strong></p>' : ''}
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #a3a3a3;">Please prepare <strong style="color: #22c55e;">₹${Number(placed.total || 0).toLocaleString("en-IN")} cash</strong> upon delivery.</p>
        <div style="background-color: #171717; border: 1px solid #262626; border-radius: 12px; padding: 14px; text-align: left; margin-bottom: 20px; font-size: 12px; color: #d4d4d4;">
          <div style="font-weight: 700; color: #fff; margin-bottom: 4px;">Deliver To:</div>
          <div>${escapeHtml(placed.name || '')} (${escapeHtml(placed.phone || '')})</div>
          <div style="color: #a3a3a3; margin-top: 2px;">${escapeHtml(placed.address || '')}</div>
        </div>
        <button onclick="handleCloseAndReset()" style="width: 100%; background-color: #262626; color: #fff; font-weight: 600; padding: 12px; border-radius: 10px; border: none; cursor: pointer;">Back to Shop</button>
      </div>
    `;
  }
}

// FAIL-SAFE DIRECT HANDLER — places a REAL order through the server API
// (the same /api/orders endpoint the checkout page uses). The order is stored
// server-side (data/orders.json) and ONLY after the server confirms success is
// the cart cleared. If placement fails, the cart is kept untouched.
async function handleConfirmOrder() {
  console.log("✅ handleConfirmOrder() called - button click registered!");
  const btn = document.getElementById('confirmOrderBtn');
  
  // Get fresh cart data BEFORE placing the order
  const currentCart = readCartSafe();
  console.log("📦 Current cart items:", currentCart.length, currentCart);
  
  if (!currentCart.length) {
    alert('Your cart is empty. Add some products first.');
    return;
  }
  
  // Validation
  const name = (checkoutFormData.name || '').trim();
  const phone = (checkoutFormData.phone || '').trim();
  const address = (checkoutFormData.address || '').trim();
  const city = (checkoutFormData.city || '').trim();
  const state = (checkoutFormData.state || '').trim();
  const pincode = (checkoutFormData.pincode || '').trim();
  
  if (!name || !phone || !address || !city || !state || !pincode) {
    alert('Please fill in all required fields.');
    return;
  }
  if (!/^[0-9]{10}$/.test(phone)) {
    alert('Enter a valid 10-digit phone number.');
    return;
  }
  if (!/^[0-9]{6}$/.test(pincode)) {
    alert('Enter a valid 6-digit PIN code.');
    return;
  }
  
  if (btn) { btn.disabled = true; btn.textContent = 'Placing Order...'; }
  
  try {
    // Server-authoritative checkout: stock, totals and order storage are all
    // handled by the server — no fake localStorage-only orders.
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: '',
        paymentMethod: 'cod',
        items: currentCart.map(item => ({ id: item.id, quantity: item.quantity || 1 })),
        address: { name: name, phone: phone, address: address, landmark: '', city: city, state: state, pincode: pincode }
      })
    });
    const data = await res.json();
    
    if (!res.ok || !data.success) {
      // Order was NOT placed — keep the cart exactly as it is so nothing is lost
      alert(data.message || 'Could not place your order. Please try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm Order (Cash on Delivery)'; }
      return;
    }
    
    // The server stored the order — only now is it safe to clear the cart
    lastPlacedOrder = { orderId: data.order.orderId, total: data.order.total, name: name, phone: phone, address: address };
    localStorage.removeItem('amSriCart');
    cart.length = 0;
    sessionStorage.setItem('last_order', JSON.stringify({ orderId: data.order.orderId }));
    updateCartCount();
    renderCart();
    
    // 1. Force transition to success step
    checkoutStep = 'success';
    console.log("🔄 Step changed to:", checkoutStep);
    renderCheckout();
    console.log('✅ Order placed and cart cleared:', data.order.orderId);
  } catch (err) {
    console.error('Order placement failed:', err);
    // Network failure — the order was not placed, so the cart is kept
    alert('Network error. Your order was not placed and your cart was kept — please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Order (Cash on Delivery)'; }
  }
}

// Reset and close checkout - matches React's handleCloseAndReset
function handleCloseAndReset() {
  console.log("🔄 Resetting checkout and closing");
  checkoutStep = 'form';
  checkoutFormData = Object.assign({}, EMPTY_CHECKOUT_FORM);
  lastPlacedOrder = null;
  
  // Hide modal
  document.getElementById('checkoutOverlay').style.display = 'none';
  document.getElementById('checkoutCanvas').style.right = '-100%';
  document.body.style.overflow = 'auto';
  console.log("✅ Checkout closed and fully reset");
}

// Modified proceedToCheckout to use our new render system
function proceedToCheckout() {
  console.log("🚀 proceedToCheckout() called");
  const cart = JSON.parse(localStorage.getItem('amSriCart') || '[]');
  
  if (cart.length === 0) {
    alert("Your cart is empty! Please add items before proceeding to checkout.");
    return;
  }
  
  // Close cart drawer first
  closeCart();
  
  // Show checkout modal
  document.getElementById('checkoutOverlay').style.display = 'block';
  setTimeout(() => {
    document.getElementById('checkoutCanvas').style.right = '0';
  }, 10);
  document.body.style.overflow = 'hidden';
  
  // Render the form view
  renderCheckout();
  console.log("✅ Checkout modal opened successfully");
}

// Close checkout function wired to reset
function closeCheckout() {
  handleCloseAndReset();
}

// Main placeOrder function that's called from checkout.html when user confirms their order
function placeOrder() {
  // Get all form data from checkout page
  const firstName = document.getElementById('firstName')?.value || '';
  const lastName = document.getElementById('lastName')?.value || '';
  const email = document.getElementById('email')?.value || '';
  const phone = document.getElementById('phone')?.value || '';
  const address = document.getElementById('address')?.value || '';
  const city = document.getElementById('city')?.value || '';
  const state = document.getElementById('state')?.value || '';
  const pincode = document.getElementById('pincode')?.value || '';
  
  // Validate required fields
  if (!firstName || !lastName || !email || !phone || !address || !city || !state || !pincode) {
    alert('Please fill in all required shipping details');
    return;
  }
  
  // Get cart from localStorage
  const cart = JSON.parse(localStorage.getItem('petshop_cart') || '[]');
  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }
  
  // Calculate order totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = 50;
  const tax = Math.round(subtotal * 0.18); // 18% GST
  const grandTotal = subtotal + shipping + tax;
  
  // Generate unique order ID
  const orderId = 'ORD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
  
  // Get selected payment method (it's defined in checkout.html's script)
  const paymentMethod = window.selectedPaymentMethod || 'cod';
  
  // Create complete order object
  const order = {
    orderId: orderId,
    customerName: `${firstName} ${lastName}`,
    email: email,
    phone: phone,
    shippingAddress: {
      address: address,
      city: city,
      state: state,
      pincode: pincode,
      landmark: document.getElementById('landmark')?.value || ''
    },
    paymentMethod: paymentMethod,
    items: cart,
    totals: {
      subtotal: subtotal,
      shipping: shipping,
      tax: tax,
      grandTotal: grandTotal
    },
    orderDate: new Date().toISOString(),
    status: 'confirmed'
  };
  
  // Save order to localStorage (in production, this would be sent to a backend API)
  const existingOrders = JSON.parse(localStorage.getItem('petshop_orders') || '[]');
  existingOrders.push(order);
  localStorage.setItem('petshop_orders', JSON.stringify(existingOrders));
  
  // Clear the cart after successful order placement
  localStorage.removeItem('petshop_cart');
  
  // Show success message and display order ID
  document.getElementById('orderReview').style.display = 'none';
  document.getElementById('step4').classList.remove('active');
  document.getElementById('orderSuccess').classList.add('show');
  document.getElementById('finalOrderId').textContent = '#' + orderId;
  
  console.log('Order placed successfully:', order);
}