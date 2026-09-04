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

function mergeProducts() {
    const merged = baseProducts.map((p) => {
        const ov = productOverrides[p.id];
        return ov ? Object.assign({}, p, ov) : Object.assign({}, p);
    });
    // Products added by the admin exist only in the overrides — append them so
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

// ── Supabase persistence (primary) with local JSON fallback ──
async function persistOrderToSupabase(order) {
    try { await supabase.insertOrder(order); }
    catch (e) { console.error("Supabase insertOrder failed:", e.message); persistOrders(); }
}
async function updateOrderInSupabase(orderId, fields) {
    try { await supabase.updateOrder(orderId, fields); }
    catch (e) { console.error("Supabase updateOrder failed:", e.message); persistOrders(); }
}
async function deleteOrderFromSupabase(orderId) {
    try { await supabase.deleteOrder(orderId); }
    catch (e) { console.error("Supabase deleteOrder failed:", e.message); persistOrders(); }
}
async function persistMessageToSupabase(msg) {
    try { await supabase.insertMessage(msg); }
    catch (e) { console.error("Supabase insertMessage failed:", e.message); }
}
async function hydrateFromSupabase() {
    try {
        orders = await supabase.fetchOrders();
        console.log("Hydrated", orders.length, "orders from Supabase");
    } catch (e) {
        console.error("Supabase order hydration failed:", e.message);
        orders = store.loadOrders();
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

// ── Realtime (Server-Sent Events) infrastructure ──
// Lightweight pub/sub. No external dependencies — Express handles SSE natively.
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

// ── PRODUCTS API ──
app.get("/api/products", (req, res) => {
    const includeArchived = req.query.includeArchived === "1" || req.query.includeArchived === "true";
    res.json(includeArchived ? products : products.filter((p) => !p.archived));
});

app.get("/api/products/:id", (req, res) => {
    const product = findProduct(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json(product);
});

app.post("/api/products", (req, res) => {
    const { name, category, price, stock, description, image } = req.body || {};
    if (!name || price == null) return res.status(400).json({ success: false, message: "name and price are required" });
    const id = products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const product = {
        id, name: String(name).trim(), category: category || "accessories",
        price: Number(price), stock: stock != null ? Number(stock) : 0,
        description: description || "", image: image || "/images/logo.jpeg"
    };
    productOverrides[id] = product;
    persistOverrides();
    res.json({ success: true, product });
});

app.put("/api/products/:id", (req, res) => {
    const id = Number(req.params.id);
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
    productOverrides[id] = Object.assign({}, productOverrides[id] || {}, patch);
    persistOverrides();
    res.json({ success: true, product: findProduct(id) });
});

app.delete("/api/products/:id", (req, res) => {
    const id = Number(req.params.id);
    const existing = findProduct(id);
    if (!existing) return res.status(404).json({ success: false, message: "Product not found" });
    productOverrides[id] = Object.assign({}, productOverrides[id] || {}, { stock: 0, archived: true });
    persistOverrides();
    res.json({ success: true, message: "Product archived" });
});

// ── PROMO CODE API ──
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

// ── REALTIME SSE ENDPOINT ──
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

// ── ORDERS API ──
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

    // ── Realtime broadcast ──
    // Notify all ADMIN dashboards of a brand-new order
    broadcast("order:new", { order: order }, function (c) { return c.channel === "admin"; });
    // Notify the customer's tracking page (if open) of the initial status
    broadcast("order:status", { orderId: order.orderId, status: order.status, order: order }, function (c) {
        return c.channel === "order" && c.orderId === order.orderId;
    });

    res.json({ success: true, message: "Order received", order });
});

app.get("/api/orders", (req, res) => res.json(orders.slice().reverse()));

app.get("/api/orders/:id", (req, res) => {
    const order = orders.find((o) => o.orderId === req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json(order);
});

app.patch("/api/orders/:id/status", async (req, res) => {
    const order = orders.find((o) => o.orderId === req.params.id);
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
    await updateOrderInSupabase(order.orderId, { status: order.status, trackingNumber: order.trackingNumber });

    // ── Realtime broadcast ──
    // Customer's tracking page for this order
    broadcast("order:status", { orderId: order.orderId, status: order.status, trackingNumber: order.trackingNumber, order: order }, function (c) {
        return c.channel === "order" && c.orderId === order.orderId;
    });
    // Admin dashboards (so the table row + status badge refresh)
    broadcast("order:status", { orderId: order.orderId, status: order.status, trackingNumber: order.trackingNumber, order: order }, function (c) {
        return c.channel === "admin";
    });

    res.json({ success: true, order });
});

app.delete("/api/orders/:id", async (req, res) => {
    const idx = orders.findIndex((o) => o.orderId === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Order not found" });
    const [removed] = orders.splice(idx, 1);
    await deleteOrderFromSupabase(removed.orderId);
    res.json({ success: true, message: "Order deleted", orderId: removed.orderId });
});


// ── OFFLINE ORDER API (admin records walk-in / in-store sales) ──
app.post("/api/orders/offline", async (req, res) => {
    const body = req.body || {};
    const customerName = String(body.customerName || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const paymentMethod = body.paymentMethod || "cod";
    const status = VALID_STATUSES.includes(body.status) ? body.status : "delivered";

    if (!customerName) return res.status(400).json({ success: false, message: "Customer name is required." });
    if (!items.length) return res.status(400).json({ success: false, message: "Add at least one item." });

    const validated = [];
    for (const item of items) {
        const product = findProduct(item.id);
        if (!product) return res.status(400).json({ success: false, message: "Product #" + item.id + " not found." });
        const qty = Math.max(1, Number(item.quantity) || 1);
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

    validated.forEach((item) => {
        const current = findProduct(item.id);
        if (current) productOverrides[item.id] = Object.assign({}, productOverrides[item.id] || {}, { stock: Math.max(0, (current.stock || 0) - item.quantity) });
    });
    orders.push(order);
    store.saveOverrides(productOverrides);
    products = mergeProducts();

    await persistOrderToSupabase(order);

    broadcast("order:new", { order: order }, function (c) { return c.channel === "admin"; });

    res.json({ success: true, message: "Offline order saved", order });
});

// ── MY ORDERS API (customer-specific) ──
app.get("/api/my-orders", (req, res) => {
    const customerId = req.query.customerId;
    if (!customerId) return res.status(400).json({ success: false, message: "customerId required" });
    const myOrders = orders.filter(o => o.customerId === customerId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, orders: myOrders });
});

// ── DASHBOARD STATS / ANALYTICS API ──
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

// ── CONTACT FORM API ──
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
    await persistMessageToSupabase(entry);
    res.json({ success: true, message: "Message received successfully.", id: entry.id });
});

app.get("/api/contact", (req, res) => res.json(contactMessages.slice().reverse()));

// ── Home ──
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function startServer() {
    await hydrateFromSupabase();
    if (process.env.VERCEL) {
        // Vercel zero-config server: the app is exported below and Vercel
        // routes requests to it. No local port bind is needed (or allowed).
        console.log("Running on Vercel — Express app exported, not listening on a local port.");
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

// Vercel default export — required for zero-config Express deployment.
module.exports = app;

