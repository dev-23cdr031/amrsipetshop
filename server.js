const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;
const DELIVERY_FEE = 100;
const TAX_RATE = 0.05;

// Base product catalogue (read-only source of truth for structure)
const baseProducts = require("./data/products.js");
const promoCodes = require("./data/promo-codes.js");
const store = require("./data/store.js");
const supabase = require("./supabase.js");

// Runtime state
let productOverrides = store.loadOverrides();
let products = mergeProducts();
let orders = [];
let contactMessages = [];
let customers = store.loadCustomers();
let sessions = [];
// True when local orders differ from what is safely stored in Supabase
// (e.g. a DB write failed). While dirty we must NOT overwrite the in-memory
// array with stale Supabase data, otherwise admin status changes would revert.
let ordersDirty = false;

function mergeProducts() {
    const merged = baseProducts.map((p) => {
        const ov = productOverrides[p.id];
        return ov ? Object.assign({}, p, ov) : Object.assign({}, p);
    });
    // Products added by the admin exist only in the overrides â€” append them so
    // they are served by the API and appear in the shop like any other product.
    Object.keys(productOverrides).forEach(function (key) {
        const id = Number(key);
        if (productOverrides[key] && !merged.some((p) => Number(p.id) === id)) {
            merged.push(Object.assign({}, productOverrides[key]));
        }
    });
    return merged.sort((a, b) => Number(a.id) - Number(b.id));
}
function persistOverrides() { store.saveOverrides(productOverrides); products = mergeProducts(); }
function persistOrders() { store.saveOrders(orders); }
function findProduct(id) { return products.find((p) => Number(p.id) === Number(id)); }

// â”€â”€ Supabase persistence (primary) with local JSON fallback â”€â”€
async function persistOrderToSupabase(order) {
    try { await supabase.insertOrder(order); ordersDirty = false; }
    catch (e) {
        console.error("Supabase insertOrder failed:", e.message);
        ordersDirty = true;
        persistOrders();
    }
}
async function updateOrderInSupabase(orderId, fields) {
    try { await supabase.updateOrder(orderId, fields); ordersDirty = false; return true; }
    catch (e) {
        console.error("Supabase updateOrder failed:", e.message);
        // Keep local JSON as a fallback so the change is not lost across restarts
        ordersDirty = true;
        persistOrders();
        return false;
    }
}
async function deleteOrderFromSupabase(orderId) {
    try { await supabase.deleteOrder(orderId); ordersDirty = false; }
    catch (e) {
        console.error("Supabase deleteOrder failed:", e.message);
        ordersDirty = true;
        persistOrders();
    }
}
async function persistMessageToSupabase(msg) {
    try { await supabase.insertMessage(msg); }
    catch (e) { console.error("Supabase insertMessage failed:", e.message); }
}
async function hydrateFromSupabase() {
    try {
        const supabaseOrders = await supabase.fetchOrders();
        // If Supabase returns data, use it; otherwise fall back to local orders
        if (supabaseOrders && supabaseOrders.length > 0) {
            orders = supabaseOrders;
            ordersDirty = false;
            console.log("Hydrated", orders.length, "orders from Supabase");
        } else {
            console.log("Supabase orders table is empty, using local orders.json");
            orders = store.loadOrders();
            ordersDirty = false;
            console.log("Loaded", orders.length, "orders from local orders.json");
        }
    } catch (e) {
        console.error("Supabase order hydration failed:", e.message);
        orders = store.loadOrders();
        ordersDirty = false;
        console.log("Fell back to local orders.json:", orders.length, "orders");
    }
    try {
        contactMessages = await supabase.fetchMessages();
        console.log("Hydrated", contactMessages.length, "contact messages from Supabase");
    } catch (e) {
        console.error("Supabase message hydration failed:", e.message);
        contactMessages = [];
    }
}

console.log("PRODUCT COUNT:", products.length);

// â”€â”€ Realtime (Server-Sent Events) infrastructure â”€â”€
// Lightweight pub/sub. No external dependencies â€” Express handles SSE natively.
const sseClients = []; // { res, channel, orderId, id }

function sseSend(res, event, data) {
    try {
        res.write("event: " + event + "\n");
        res.write("data: " + JSON.stringify(data) + "\n\n");
    } catch (e) { /* client gone */ }
}

function broadcast(event, payload, filterFn) {
    sseClients.slice().forEach(function (c) {
        if (filterFn && !filterFn(c)) return;
        sseSend(c.res, event, payload);
    });
}

// Heartbeat keeps connections alive through proxies and detects dead clients.
// (Skipped on Vercel: serverless functions are ephemeral, so no long-lived timer.)
if (!process.env.VERCEL) {
    setInterval(function () {
        sseClients.slice().forEach(function (c) {
            if (c.res.writableEnded) { removeSseClient(c); return; }
            sseSend(c.res, "heartbeat", { t: Date.now() });
        });
    }, 15000);
}

function removeSseClient(c) {
    const i = sseClients.indexOf(c);
    if (i !== -1) sseClients.splice(i, 1);
    console.log("SSE client disconnected. Active:", sseClients.length);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// â”€â”€ PRODUCTS API â”€â”€
app.get("/api/products", async (req, res) => {
    try {
        // Always fetch fresh products from Supabase
        const supabaseProducts = await supabase.fetchProducts();
        // If Supabase returns data, use it; otherwise fall back to local products
        if (supabaseProducts && supabaseProducts.length > 0) {
            products = supabaseProducts;
        } else {
            console.log("Supabase products table is empty, using local products from data/products.js");
            products = mergeProducts();
        }
    } catch (e) {
        console.error("Supabase fetch failed in /api/products, using local products:", e.message);
        products = mergeProducts();
    }
    const includeArchived = req.query.includeArchived === "1" || req.query.includeArchived === "true";
    res.json(includeArchived ? products : products.filter((p) => !p.archived));
});

app.get("/api/products/:id", async (req, res) => {
    try {
        // Refresh products before lookup
        const supabaseProducts = await supabase.fetchProducts();
        if (supabaseProducts && supabaseProducts.length > 0) {
            products = supabaseProducts;
        } else {
            products = mergeProducts();
        }
    } catch (e) {
        console.error("Supabase fetch failed in /api/products/:id, using local products:", e.message);
        products = mergeProducts();
    }
    const product = findProduct(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json(product);
});

app.post("/api/products", async (req, res) => {
    const { name, category, price, stock, description, image } = req.body || {};
    if (!name || price == null) return res.status(400).json({ success: false, message: "name and price are required" });
    
    const product = {
        name: String(name).trim(), category: category || "accessories",
        price: Number(price), stock: stock != null ? Number(stock) : 0,
        description: description || "", image: image || "/images/logo.jpeg",
        archived: false
    };

    try {
        // Persist to Supabase first
        await supabase.insertProduct(product);
        // Refresh local products array with fresh Supabase data
        products = await supabase.fetchProducts();
        // Get the newly created product
        const newProduct = products[products.length - 1];
        // Broadcast to admin dashboards for real-time updates
        broadcast("product:new", { product: newProduct }, function (c) { return c.channel === "admin"; });
        res.json({ success: true, product: newProduct });
    } catch (e) {
        console.error("Failed to create product in Supabase:", e.message);
        res.status(500).json({ success: false, message: "Failed to create product: " + e.message });
    }
});

app.put("/api/products/:id", async (req, res) => {
    const id = Number(req.params.id);

    // Always refresh from Supabase first to get the latest products
    try {
        const supabaseProducts = await supabase.fetchProducts();
        if (supabaseProducts && supabaseProducts.length > 0) {
            products = supabaseProducts;
        } else {
            products = mergeProducts();
        }
    } catch (e) {
        console.error("Supabase fetch failed before update, using local products:", e.message);
        products = mergeProducts();
    }

    const existing = findProduct(id);
    if (!existing) return res.status(404).json({ success: false, message: "Product not found" });
    
    const { name, category, price, stock, description, image, archived } = req.body || {};
    const patch = {};
    if (name != null) patch.name = String(name).trim();
    if (category != null) patch.category = String(category);
    if (price != null) patch.price = Number(price);
    if (stock != null) patch.stock = Number(stock);
    if (description != null) patch.description = String(description);
    if (image != null) patch.image = String(image);
    if (archived != null) patch.archived = Boolean(archived);

    try {
        // Update in Supabase
        await supabase.updateProduct(id, patch);
        // Refresh local products array
        const refreshed = await supabase.fetchProducts();
        if (refreshed && refreshed.length > 0) {
            products = refreshed;
        } else {
            products = mergeProducts();
        }
        const updatedProduct = findProduct(id);
        // Broadcast to admin dashboards
        broadcast("product:updated", { product: updatedProduct }, function (c) { return c.channel === "admin"; });
        res.json({ success: true, product: updatedProduct });
    } catch (e) {
        console.error("Failed to update product in Supabase:", e.message);
        res.status(500).json({ success: false, message: "Failed to update product: " + e.message });
    }
});

app.delete("/api/products/:id", async (req, res) => {
    const id = Number(req.params.id);

    try {
        // Always refresh from Supabase first to get the latest products
        const supabaseProducts = await supabase.fetchProducts();
        if (supabaseProducts && supabaseProducts.length > 0) {
            products = supabaseProducts;
        } else {
            products = mergeProducts();
        }
    } catch (e) {
        console.error("Supabase fetch failed before delete, using local products:", e.message);
        products = mergeProducts();
    }

    const existing = findProduct(id);

    try {
        // Delete from Supabase (permanently removes the product)
        await supabase.deleteProduct(id);

        // Refresh local products array after deletion
        try {
            const refreshed = await supabase.fetchProducts();
            if (refreshed && refreshed.length > 0) {
                products = refreshed;
            } else {
                products = mergeProducts();
            }
        } catch (e) {
            console.error("Failed to refresh products after delete:", e.message);
            products = mergeProducts();
        }

        // Broadcast to admin dashboards
        broadcast("product:deleted", { productId: id }, function (c) { return c.channel === "admin"; });
        res.json({ success: true, message: "Product deleted successfully" });
    } catch (e) {
        console.error("Failed to delete product from Supabase:", e.message);
        res.status(500).json({ success: false, message: "Failed to delete product: " + e.message });
    }
});

// â”€â”€ PROMO CODE API â”€â”€
app.post("/api/promo/validate", (req, res) => {
    const { code, subtotal } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: "Coupon code is required." });
    const promo = promoCodes.find((p) => p.code.toUpperCase() === String(code).toUpperCase() && p.active);
    if (!promo) return res.status(404).json({ success: false, message: "Invalid or expired coupon code." });
    const sub = Number(subtotal) || 0;
    if (sub < promo.minSubtotal) {
        return res.status(400).json({ success: false, message: "This coupon requires a minimum subtotal of Rs" + promo.minSubtotal + "." });
    }
    let discount = promo.type === "percent"
        ? Math.min((sub * promo.value) / 100, promo.maxDiscount)
        : Math.min(promo.value, promo.maxDiscount);
    res.json({ success: true, code: promo.code, description: promo.description, discount: Math.round(discount), type: promo.type });
});

// â”€â”€ REALTIME SSE ENDPOINT â”€â”€
app.get("/api/events", (req, res) => {
    // Vercel's serverless model does not support long-lived SSE connections.
    if (process.env.VERCEL) {
        res.status(204).end();
        return;
    }
    const channel = (req.query.channel || "global").toString();
    const orderId = req.query.orderId ? req.query.orderId.toString() : null;

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no" // disable proxy buffering (nginx)
    });
    res.write("retry: 3000\n\n");

    const client = { res: res, channel: channel, orderId: orderId, id: Date.now() };
    sseClients.push(client);
    console.log("SSE client connected. channel=" + channel + (orderId ? " order=" + orderId : "") + " Active:", sseClients.length);

    // immediate hello so the client knows it's live
    sseSend(res, "heartbeat", { hello: true, t: Date.now() });

    const cleanup = function () { removeSseClient(client); };
    req.on("close", cleanup);
    req.on("error", cleanup);
});

// â”€â”€ ORDERS API â”€â”€
const VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

function estimateDelivery(method) {
    const days = method === "express" ? 2 : method === "standard" ? 4 : 5;
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString();
}

app.post("/api/orders", async (req, res) => {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ success: false, message: "Cart is empty." });

    // Checkout totals and stock are server-authoritative. This prevents a
    // browser from submitting altered prices, delivery fees, or discounts.
    const requiredAddress = ["name", "phone", "address", "pincode", "city", "state"];
    const address = body.address && typeof body.address === "object" ? body.address : null;
    if (!address || requiredAddress.some((key) => !String(address[key] || "").trim())) {
        return res.status(400).json({ success: false, message: "A complete shipping address is required." });
    }
    if (!/^[0-9]{10}$/.test(String(address.phone).trim())) {
        return res.status(400).json({ success: false, message: "Enter a valid 10-digit phone number." });
    }
    if (!/^[0-9]{6}$/.test(String(address.pincode).trim())) {
        return res.status(400).json({ success: false, message: "Enter a valid 6-digit PIN code." });
    }

    // Billing address is optional and defaults to the shipping address.
    // When the customer bills to a different address, it must be complete.
    const billingSameAsShipping = body.billingSameAsShipping !== false;
    let billingAddress = null;
    if (!billingSameAsShipping) {
        const b = body.billingAddress && typeof body.billingAddress === "object" ? body.billingAddress : null;
        const requiredBilling = ["address", "pincode", "city", "state"];
        if (!b || requiredBilling.some((key) => !String(b[key] || "").trim())) {
            return res.status(400).json({ success: false, message: "A complete billing address is required." });
        }
        if (!/^[0-9]{6}$/.test(String(b.pincode).trim())) {
            return res.status(400).json({ success: false, message: "Enter a valid 6-digit billing PIN code." });
        }
        billingAddress = {
            address: String(b.address).trim(), landmark: String(b.landmark || "").trim(),
            city: String(b.city).trim(), state: String(b.state).trim(), pincode: String(b.pincode).trim()
        };
    }

    // Payment reference data: only masked, non-sensitive values are stored.
    // Full card numbers and CVVs never reach the server (PCI-safe demo gateway).
    const paymentMethod = body.paymentMethod || "cod";
    let paymentDetails = null;
    if (paymentMethod === "upi") {
        const upiId = String((body.paymentDetails || {}).upiId || "").trim();
        if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) {
            return res.status(400).json({ success: false, message: "Enter a valid UPI ID (name@bank) to continue." });
        }
        paymentDetails = { type: "upi", upiId: upiId };
    } else if (paymentMethod === "card") {
        const pd = body.paymentDetails || {};
        const last4 = String(pd.last4 || "").replace(/\D/g, "");
        if (last4.length !== 4) {
            return res.status(400).json({ success: false, message: "Card details are incomplete." });
        }
        paymentDetails = { type: "card", brand: String(pd.brand || "Card").trim().slice(0, 20), last4: last4, name: String(pd.name || "").trim().slice(0, 60) };
    }

    const validated = [];
    for (const item of items) {
        const product = findProduct(item.id);
        if (!product) return res.status(400).json({ success: false, message: "Product #" + item.id + " not found." });
        const qty = Math.max(1, Number(item.quantity) || 1);
        if ((product.stock || 0) < qty) {
            return res.status(409).json({ success: false, message: "Only " + (product.stock || 0) + " unit(s) of \"" + product.name + "\" are in stock." });
        }
        validated.push({ id: product.id, name: product.name, price: Number(product.price), image: product.image, quantity: qty });
    }

    const subtotal = validated.reduce((s, i) => s + i.price * i.quantity, 0);
    let discount = 0;
    let promoCode = null;
    if (body.promoCode) {
        const promo = promoCodes.find((p) => p.active && p.code.toUpperCase() === String(body.promoCode).trim().toUpperCase());
        if (!promo) return res.status(400).json({ success: false, message: "The selected coupon is no longer valid." });
        if (subtotal < promo.minSubtotal) return res.status(400).json({ success: false, message: "The selected coupon no longer meets its minimum order value." });
        discount = promo.type === "percent" ? Math.min((subtotal * promo.value) / 100, promo.maxDiscount) : Math.min(promo.value, promo.maxDiscount);
        discount = Math.round(discount);
        promoCode = promo.code;
    }
    const shipping = DELIVERY_FEE;
    const tax = Math.round(Math.max(0, subtotal - discount) * TAX_RATE);
    const total = Math.max(0, Math.round(subtotal + shipping + tax - discount));

    const order = {
        orderId: "AMS" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase(),
        customerId: String(body.customerId || "").trim() || null,
        source: "online",
        customerName: String(address.name).trim(),
        customerEmail: String(body.customerEmail || "").trim(),
        customerPhone: String(address.phone).trim(),
        shippingAddress: [address.address, address.landmark, address.city, address.state + " - " + address.pincode].filter(Boolean).map(String).map((value) => value.trim()).filter(Boolean).join(", "),
        address: {
            name: String(address.name).trim(), phone: String(address.phone).trim(),
            address: String(address.address).trim(), landmark: String(address.landmark || "").trim(),
            city: String(address.city).trim(), state: String(address.state).trim(), pincode: String(address.pincode).trim()
        },
        items: validated,
        subtotal: Math.round(subtotal), shipping, tax, discount,
        promoCode, total,
        paymentMethod: paymentMethod,
        paymentDetails: paymentDetails,
        billingSameAsShipping: billingSameAsShipping,
        billingAddress: billingAddress,
        paymentStatus: "confirmed",
        deliveryMethod: "standard",
        status: "processing", trackingNumber: null,
        estimatedDelivery: estimateDelivery("standard"),
        createdAt: new Date().toISOString()
    };

    // Stock + order are now persisted to Supabase below; no rollback needed.
    // Express handles this synchronous section serially: stock is checked,
    // decremented, and the order is recorded as one in-process transaction
    // before any later request can validate the same inventory.
    validated.forEach((item) => {
        const current = findProduct(item.id);
        if (current) productOverrides[item.id] = Object.assign({}, productOverrides[item.id] || {}, { stock: Math.max(0, (current.stock || 0) - item.quantity) });
    });
    orders.push(order);
    store.saveOverrides(productOverrides);
    products = mergeProducts();

    // Persist the order to Supabase (falls back to local orders.json on failure).
    await persistOrderToSupabase(order);
    console.log("Order received:", order.orderId, "total Rs" + order.total, "status=processing");

    // â”€â”€ Realtime broadcast â”€â”€
    // Notify all ADMIN dashboards of a brand-new order
    broadcast("order:new", { order: order }, function (c) { return c.channel === "admin"; });
    // Notify the customer's tracking page (if open) of the initial status
    broadcast("order:status", { orderId: order.orderId, status: order.status, order: order }, function (c) {
        return c.channel === "order" && c.orderId === order.orderId;
    });

    res.json({ success: true, message: "Order received", order });
});

app.get("/api/orders", async (req, res) => {
    if (!ordersDirty) {
        try {
            // Always fetch fresh orders from Supabase for admin dashboard
            const supabaseOrders = await supabase.fetchOrders();
            if (supabaseOrders && supabaseOrders.length > 0) {
                orders = supabaseOrders;
            } else {
                console.log("Supabase orders empty, using local orders");
                orders = store.loadOrders();
            }
        } catch (e) {
            console.error("Supabase fetch failed in /api/orders, using local orders:", e.message);
            orders = store.loadOrders();
        }
    }
    res.json(orders.slice().reverse());
});

app.get("/api/orders/:id", async (req, res) => {
    // Refresh from Supabase first (unless local has unsaved changes)
    if (!ordersDirty) {
        try {
            const supabaseOrders = await supabase.fetchOrders();
            if (supabaseOrders && supabaseOrders.length > 0) {
                orders = supabaseOrders;
            }
        } catch (e) {
            console.error("Supabase fetch failed in /api/orders/:id, using local orders:", e.message);
        }
    }
    const order = orders.find((o) => o.orderId === req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json(order);
});

app.patch("/api/orders/:id/status", async (req, res) => {
    const orderId = req.params.id;

    // Refresh from Supabase first to get the latest orders (unless local has unsaved changes)
    if (!ordersDirty) {
        try {
            const supabaseOrders = await supabase.fetchOrders();
            if (supabaseOrders && supabaseOrders.length > 0) {
                orders = supabaseOrders;
            }
        } catch (e) {
            console.error("Supabase fetch failed before status update, using local orders:", e.message);
        }
    }

    let order = orders.find((o) => o.orderId === orderId);

    // If still not found locally, try to fetch directly from Supabase
    if (!order) {
        try {
            const supabaseOrder = await supabase.sb("/orders?order_id=eq." + encodeURIComponent(orderId) + "&select=*");
            if (supabaseOrder && supabaseOrder.length > 0) {
                order = supabase.snakeToCamelOrder(supabaseOrder[0]);
                orders.push(order);
                console.log("Order found directly from Supabase:", orderId);
            }
        } catch (e) {
            console.error("Failed to fetch order from Supabase:", e.message);
        }
    }

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    const status = String(req.body.status || "").toLowerCase();
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });
    const previousStatus = order.status;
    order.status = status;
    if (status === "cancelled" && previousStatus !== "cancelled") {
        order.items.forEach((item) => {
            const current = findProduct(item.id);
            if (current) productOverrides[item.id] = Object.assign({}, productOverrides[item.id] || {}, { stock: (current.stock || 0) + item.quantity });
        });
        persistOverrides();
    }
    if (status === "shipped" && !order.trackingNumber) order.trackingNumber = "TRK" + Date.now().toString().slice(-9);
    const supabaseUpdated = await updateOrderInSupabase(order.orderId, { status: order.status, trackingNumber: order.trackingNumber });
    
    // Refresh orders array from Supabase ONLY if the update actually persisted there.
    // Otherwise keep the local (in-memory) change so the new status is not clobbered
    // by a stale Supabase snapshot (fixes status reverting after failed DB update).
    if (supabaseUpdated) {
        try { orders = await supabase.fetchOrders(); } catch (e) { console.error("Failed to refresh orders after status update:", e); }
    } else {
        persistOrders();
    }

    // â”€â”€ Realtime broadcast â”€â”€
    // Customer's tracking page for this order
    broadcast("order:status", { orderId: order.orderId, status: order.status, trackingNumber: order.trackingNumber, order: order }, function (c) {
        return c.channel === "order" && c.orderId === order.orderId;
    });
    // Admin dashboards (so the table row + status badge refresh)
    broadcast("order:status", { orderId: order.orderId, status: order.status, trackingNumber: order.trackingNumber, order: order }, function (c) {
        return c.channel === "admin";
    });
    // Customer's My Orders page (so the order list refreshes with new status)
    broadcast("order:status", { orderId: order.orderId, status: order.status, trackingNumber: order.trackingNumber, order: order }, function (c) {
        return c.channel === "myorders";
    });

    res.json({ success: true, order });
});

// â”€â”€ FULL ORDER EDIT ENDPOINT (admin can edit any order details) â”€â”€
app.patch("/api/orders/:id", async (req, res) => {
    const orderId = req.params.id;

    // Refresh from Supabase first (unless local has unsaved changes)
    if (!ordersDirty) {
        try {
            const supabaseOrders = await supabase.fetchOrders();
            if (supabaseOrders && supabaseOrders.length > 0) {
                orders = supabaseOrders;
            }
        } catch (e) {
            console.error("Supabase fetch failed before order edit, using local orders:", e.message);
        }
    }

    const orderIndex = orders.findIndex((o) => o.orderId === orderId);
    if (orderIndex === -1) return res.status(404).json({ success: false, message: "Order not found" });
    
    // Merge the incoming updates into the existing order
    const updatedOrder = { ...orders[orderIndex], ...req.body };
    orders[orderIndex] = updatedOrder;
    
    // Update in Supabase - only refresh from Supabase if it persisted there
    const supabaseUpdatedEdit = await updateOrderInSupabase(updatedOrder.orderId, req.body);
    if (supabaseUpdatedEdit) {
        try { orders = await supabase.fetchOrders(); } catch (e) { console.error("Failed to refresh orders after edit:", e); }
    } else {
        persistOrders();
    }
    
    // Broadcast to admin dashboards to refresh
    broadcast("order:updated", { orderId: updatedOrder.orderId, order: updatedOrder }, function (c) {
        return c.channel === "admin";
    });
    
    res.json({ success: true, order: updatedOrder });
});

app.delete("/api/orders/:id", async (req, res) => {
    const orderId = req.params.id;

    // Refresh from Supabase first (unless local has unsaved changes)
    if (!ordersDirty) {
        try {
            const supabaseOrders = await supabase.fetchOrders();
            if (supabaseOrders && supabaseOrders.length > 0) {
                orders = supabaseOrders;
            }
        } catch (e) {
            console.error("Supabase fetch failed before order delete, using local orders:", e.message);
        }
    }

    const idx = orders.findIndex((o) => o.orderId === orderId);
    if (idx === -1) return res.status(404).json({ success: false, message: "Order not found" });
    const [removed] = orders.splice(idx, 1);
    await deleteOrderFromSupabase(removed.orderId);
    // Refresh orders array from Supabase only if the delete persisted there
    if (!ordersDirty) {
        try { orders = await supabase.fetchOrders(); } catch (e) { console.error("Failed to refresh orders after delete:", e); }
    } else {
        persistOrders();
    }
    // Broadcast to admin dashboards to refresh
    broadcast("order:deleted", { orderId: removed.orderId }, function (c) {
        return c.channel === "admin";
    });
    res.json({ success: true, message: "Order deleted", orderId: removed.orderId });
});


// â”€â”€ OFFLINE ORDER API (admin records walk-in / in-store sales) â”€â”€
app.post("/api/orders/offline", async (req, res) => {
    const body = req.body || {};
    const customerName = String(body.customerName || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const paymentMethod = body.paymentMethod || "cod";
    const status = VALID_STATUSES.includes(body.status) ? body.status : "delivered";

    if (!customerName) return res.status(400).json({ success: false, message: "Customer name is required." });
    if (!items.length) return res.status(400).json({ success: false, message: "Add at least one item." });

    try {
        // First refresh products from Supabase to get latest stock levels
        products = await supabase.fetchProducts();
        
        const validated = [];
        for (const item of items) {
            const product = findProduct(item.id);
            if (!product) return res.status(400).json({ success: false, message: "Product #" + item.id + " not found." });
            const qty = Math.max(1, Number(item.quantity) || 1);
            if ((product.stock || 0) < qty) {
                return res.status(409).json({ success: false, message: "Only " + (product.stock || 0) + " unit(s) of \"" + product.name + "\" are in stock." });
            }
            validated.push({ id: product.id, name: product.name, price: Number(product.price), image: product.image, quantity: qty });
        }
        const subtotal = validated.reduce((s, i) => s + i.price * i.quantity, 0);

        const order = {
            orderId: "AMSOFF" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase(),
            customerId: null,
            source: "offline",
            customerName: customerName,
            customerEmail: body.customerEmail || "",
            customerPhone: customerPhone,
            shippingAddress: "Walk-in / In-store order",
            address: { name: customerName, phone: customerPhone, address: "In-store", landmark: "", city: "Walk-in", state: "", pincode: "" },
            items: validated,
            subtotal: Math.round(subtotal),
            shipping: 0,
            tax: 0,
            discount: 0,
            promoCode: null,
            total: Math.round(subtotal),
            paymentMethod: paymentMethod,
            paymentDetails: body.paymentDetails || null,
            billingSameAsShipping: true,
            billingAddress: null,
            paymentStatus: "confirmed",
            deliveryMethod: "offline",
            status: status,
            trackingNumber: null,
            estimatedDelivery: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        // Update product stock in Supabase first
        for (const item of validated) {
            const current = findProduct(item.id);
            if (current) {
                await supabase.updateProduct(item.id, { stock: Math.max(0, (current.stock || 0) - item.quantity) });
            }
        }
        
        // Persist the offline order to Supabase
        await supabase.insertOrder(order);
        
        // Refresh local orders array with fresh Supabase data
        orders = await supabase.fetchOrders();
        // Refresh local products array with updated stock levels
        products = await supabase.fetchProducts();

        // Broadcast to admin dashboards for real-time updates
        broadcast("order:new", { order: order }, function (c) { return c.channel === "admin"; });
        broadcast("product:updated", { products: products }, function (c) { return c.channel === "admin"; });

        res.json({ success: true, message: "Offline order saved to Supabase", order });
    } catch (e) {
        console.error("Failed to save offline order to Supabase:", e.message);
        res.status(500).json({ success: false, message: "Failed to save offline order: " + e.message });
    }
});

// â”€â”€ MY ORDERS API (customer-specific) â”€â”€
app.get("/api/my-orders", async (req, res) => {
    const customerId = req.query.customerId;
    const email = req.query.email ? String(req.query.email).toLowerCase() : "";
    if (!customerId && !email) return res.status(400).json({ success: false, message: "customerId or email required" });
    
    let allOrders;
    if (!ordersDirty) {
        try {
            // Fetch fresh orders from Supabase to ensure we have the latest data
            allOrders = await supabase.fetchOrders();
            // Update in-memory orders array to stay in sync with Supabase
            orders = allOrders;
        } catch (e) {
            console.error("Supabase fetch failed in /api/my-orders, using local orders:", e.message);
            allOrders = orders; // Fallback to in-memory array if Supabase is unreachable
        }
    } else {
        allOrders = orders; // Local has unsaved changes — use it so status updates show immediately
    }
    
    const myOrders = allOrders.filter(function (o) {
        if (customerId && o.customerId === customerId) return true;
        // Fallback: connect legacy orders (no customerId) by the same email.
        if (email && o.customerEmail && String(o.customerEmail).toLowerCase() === email && !o.customerId) return true;
        return false;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, orders: myOrders });
});

// â”€â”€ DASHBOARD STATS / ANALYTICS API â”€â”€
app.get("/api/stats", (req, res) => {
    const totalRevenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + (o.total || 0), 0);
    const statusCounts = VALID_STATUSES.reduce((acc, st) => { acc[st] = orders.filter((o) => o.status === st).length; return acc; }, {});
    const usersCount = Number(req.headers["x-user-count"]) || 0;

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        const next = new Date(d); next.setDate(d.getDate() + 1);
        const dayOrders = orders.filter((o) => { const c = new Date(o.createdAt); return c >= d && c < next; });
        days.push({
            label: d.toLocaleDateString("en-IN", { weekday: "short" }),
            date: d.toISOString(),
            revenue: dayOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + (o.total || 0), 0),
            orders: dayOrders.length
        });
    }

    const categoryRevenue = {};
    orders.filter((o) => o.status !== "cancelled").forEach((o) => {
        o.items.forEach((it) => {
            const product = findProduct(it.id);
            const cat = product ? product.category : "other";
            categoryRevenue[cat] = (categoryRevenue[cat] || 0) + it.price * it.quantity;
        });
    });

    const lowStock = products.filter((p) => !p.archived && (p.stock || 0) <= 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock || 0 }));

    res.json({
        totalRevenue: Math.round(totalRevenue),
        totalOrders: orders.length,
        totalProducts: products.filter((p) => !p.archived).length,
        totalUsers: usersCount,
        statusCounts,
        revenueSeries: days,
        categoryRevenue,
        lowStock,
        avgOrderValue: orders.length ? Math.round(totalRevenue / orders.length) : 0
    });
});

// â”€â”€ CONTACT FORM API â”€â”€
app.post("/api/contact", async (req, res) => {
    const { name, phone, email, subject, message } = req.body || {};
    if (!name || !phone || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }
    const entry = {
        id: Date.now().toString(),
        name: String(name).trim(), phone: String(phone).trim(), email: String(email).trim(),
        subject: String(subject).trim(), message: String(message).trim(),
        createdAt: new Date().toISOString()
    };
    contactMessages.push(entry);

    // Persist to Supabase (primary) — fall back to local if it fails
    try {
        await supabase.insertMessage(entry);
        console.log("Contact message saved to Supabase:", entry.id);
    } catch (e) {
        console.error("Supabase insertMessage failed, message kept in local memory only:", e.message);
    }

    res.json({ success: true, message: "Message received successfully.", id: entry.id });
});

app.get("/api/contact", async (req, res) => {
    try {
        const supabaseMessages = await supabase.fetchMessages();
        // If Supabase returns data, use it; otherwise fall back to local
        if (supabaseMessages && supabaseMessages.length > 0) {
            contactMessages = supabaseMessages;
        }
        // If both are empty, contactMessages stays as-is (local memory)
    } catch (e) {
        console.error("Supabase fetchMessages failed in /api/contact, using local messages:", e.message);
    }
    res.json(contactMessages.slice().reverse());
});

// â”€â”€ AUTHENTICATION ENDPOINTS â”€â”€

// POST /api/signup - Create new customer account
app.post("/api/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;
        
        if (!firstName || !lastName || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        
        let customerId;
        let session;
        
        try {
            // Try Supabase first
            const existing = await supabase.sb("/customers?email=eq." + encodeURIComponent(email) + "&select=id");
            if (existing && existing.length > 0) {
                return res.status(400).json({ success: false, message: "Email already registered" });
            }
            
            // Create customer in Supabase
            const customer = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                password: password,
                is_admin: ["devdharrshans.23csd@kongu.edu", "nagasakthi779@gmail.com"].includes(email)
            };
            
            const created = await supabase.sb("/customers", {
                method: "POST",
                headers: { "Prefer": "return=representation" },
                body: JSON.stringify(customer)
            });
            
            if (!created || !created[0]) {
                throw new Error("Failed to create customer in Supabase");
            }
            
            customerId = created[0].id;
            session = await createSession(customerId);
        } catch (supabaseError) {
            console.warn("Supabase signup failed, using local fallback:", supabaseError.message);
            
            // Fallback to local storage
            const existingLocal = customers.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
            if (existingLocal) {
                return res.status(400).json({ success: false, message: "Email already registered" });
            }
            
            // Create local customer
            const localCustomer = {
                id: "cust_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                password: password,
                is_admin: ["devdharrshans.23csd@kongu.edu", "nagasakthi779@gmail.com"].includes(email),
                created_at: new Date().toISOString()
            };
            
            customers.push(localCustomer);
            store.saveCustomers(customers);
            customerId = localCustomer.id;
            
            // Create local session
            const localSession = {
                token: require("crypto").randomBytes(32).toString("hex"),
                customer_id: customerId,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString()
            };
            sessions.push(localSession);
            session = localSession;
        }
        
        res.json({
            success: true,
            customer: {
                id: customerId,
                firstName,
                lastName,
                email,
                phone
            },
            sessionToken: session.token
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// POST /api/login - Authenticate customer
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password required" });
        }
        
        let customer;
        
        try {
            // Try Supabase first
            const customers_list = await supabase.sb("/customers?email=eq." + encodeURIComponent(email) + "&select=*");
            
            if (!customers_list || customers_list.length === 0) {
                throw new Error("Customer not found in Supabase");
            }
            
            customer = customers_list[0];
            
            if (customer.password !== password) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }
        } catch (supabaseError) {
            console.warn("Supabase login failed, using local fallback:", supabaseError.message);
            
            // Fallback to local storage
            customer = customers.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
            
            if (!customer) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }
            
            if (customer.password !== password) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }
        }
        
        // Create session
        let session;
        try {
            session = await createSession(customer.id);
        } catch (sessionError) {
            console.warn("Supabase session creation failed, using local fallback:", sessionError.message);
            
            // Create local session
            session = {
                token: require("crypto").randomBytes(32).toString("hex"),
                customer_id: customer.id,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString()
            };
            sessions.push(session);
        }
        
        res.json({
            success: true,
            customer: {
                id: customer.id,
                firstName: customer.first_name,
                lastName: customer.last_name,
                email: customer.email,
                phone: customer.phone,
                customerId: customer.id
            },
            sessionToken: session.token
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// POST /api/logout - Invalidate session
app.post("/api/logout", async (req, res) => {
    try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        
        if (token) {
            try {
                await supabase.sb("/sessions?token=eq." + encodeURIComponent(token), { method: "DELETE" });
            } catch (supabaseError) {
                console.warn("Supabase logout failed, using local fallback:", supabaseError.message);
                // Remove from local sessions
                sessions = sessions.filter(s => s.token !== token);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Helper: Create session
async function createSession(customerId) {
    const session = {
        customer_id: customerId,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const created = await supabase.sb("/sessions", {
        method: "POST",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify(session)
    });
    
    return created[0];
}

// Helper: Validate session
async function validateSession(token) {
    if (!token) return null;
    
    try {
        // Try Supabase first
        const sessions_list = await supabase.sb("/sessions?token=eq." + encodeURIComponent(token) + "&select=*,customers(id,first_name,last_name,email,phone)");
        
        if (!sessions_list || sessions_list.length === 0) return null;
        
        const session = sessions_list[0];
        
        if (new Date(session.expires_at) < new Date()) {
            await supabase.sb("/sessions?token=eq." + encodeURIComponent(token), { method: "DELETE" });
            return null;
        }
        
        return session.customers;
    } catch (supabaseError) {
        console.warn("Supabase session validation failed, using local fallback:", supabaseError.message);
        
        // Fallback to local storage
        const session = sessions.find(s => s.token === token);
        
        if (!session) return null;
        
        if (new Date(session.expires_at) < new Date()) {
            // Remove expired session
            sessions = sessions.filter(s => s.token !== token);
            return null;
        }
        
        // Find customer from local storage
        const customer = customers.find(c => c.id === session.customer_id);
        if (!customer) return null;
        
        return {
            id: customer.id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone
        };
    }
}

// Middleware: Require authentication
async function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customer = await validateSession(token);
    
    if (!customer) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }
    
    req.customer = customer;
    next();
}

// â”€â”€ Home â”€â”€
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function startServer() {
    await hydrateFromSupabase();
    if (process.env.VERCEL) {
        // Vercel zero-config server: the app is exported below and Vercel
        // routes requests to it. No local port bind is needed (or allowed).
        console.log("Running on Vercel â€” Express app exported, not listening on a local port.");
        return;
    }
    app.listen(PORT, () => {
    console.log("==============================");
    console.log("AM SRI PETSHOP SERVER");
    console.log("==============================");
    console.log("Server running at: http://localhost:" + PORT);
    console.log("Products API: http://localhost:" + PORT + "/api/products");
    console.log("Stats API:    http://localhost:" + PORT + "/api/stats");
    console.log("==============================");
    });
}
startServer();

// Vercel default export â€” required for zero-config Express deployment.
module.exports = app;