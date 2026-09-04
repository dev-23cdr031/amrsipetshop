// Supabase REST helper for AM SRI Petshop.
// Uses the legacy service_role JWT from .env (server-side only) to read/write
// orders and contact messages. Keeps the existing camelCase shape in memory
// while mapping to the snake_case columns defined in supabase/schema.sql.

const fs = require("fs");
const path = require("path");

function loadEnv() {
    const out = {};
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m && m[1]) {
                let v = m[2].trim();
                if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
                out[m[1]] = v;
            }
        }
    }
    return out;
}

const env = Object.assign(loadEnv(), process.env);
const SUPABASE_URL = String(env.SUPABASE_URL || "https://jqtsepqberrygocqciml.supabase.co").replace(/\/+$/, "");
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxdHNlcHFiZXJyeWdvY3FjaW1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY1Nzk0NywiZXhwIjoyMTAzMjMzOTQ3fQ.yvakXWyV288rGs7-Gh-1_m34rOaOh3V_hGF6cTQYj-k";
const REST = SUPABASE_URL + "/rest/v1";

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[supabase] SUPABASE_URL / key missing — persistence will fall back to local storage.");
}

async function sb(pathname, options) {
    const res = await fetch(REST + pathname, Object.assign({}, options, {
        headers: Object.assign({
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json"
        }, (options && options.headers) || {})
    }));
    if (!res.ok) {
        const text = await res.text().catch(function () { return ""; });
        throw new Error("Supabase " + res.status + " " + text.slice(0, 300));
    }
    if (res.status === 204) return null;
    const ct = res.headers.get("content-type") || "";
    return ct.indexOf("json") !== -1 ? res.json() : res.text();
}

function camelToSnakeOrder(o) {
    const addr = o.address && typeof o.address === "object" ? o.address : {};
    // Remove customerId and source from address (they're now real columns)
    const cleanAddr = Object.assign({}, addr);
    delete cleanAddr.customerId;
    delete cleanAddr.source;
    return {
        order_id: o.orderId,
        customer_id: o.customerId || null,
        customer_name: o.customerName || "",
        customer_email: o.customerEmail || "",
        customer_phone: o.customerPhone || "",
        shipping_address: o.shippingAddress || "",
        address: Object.keys(cleanAddr).length ? cleanAddr : null,
        items: o.items || [],
        subtotal: o.subtotal || 0,
        shipping: o.shipping || 0,
        tax: o.tax || 0,
        discount: o.discount || 0,
        promo_code: o.promoCode || null,
        total: o.total || 0,
        payment_method: o.paymentMethod || null,
        payment_details: o.paymentDetails || null,
        billing_same_as_shipping: o.billingSameAsShipping !== false,
        billing_address: o.billingAddress || null,
        payment_status: o.paymentStatus || "confirmed",
        delivery_method: o.deliveryMethod || "standard",
        status: o.status || "processing",
        tracking_number: o.trackingNumber || null,
        estimated_delivery: o.estimatedDelivery || null,
        created_at: o.createdAt || new Date().toISOString()
    };
}

function snakeToCamelOrder(r) {
    return {
        orderId: r.order_id,
        customerId: r.customer_id || null,
        customerName: r.customer_name,
        customerEmail: r.customer_email,
        customerPhone: r.customer_phone,
        shippingAddress: r.shipping_address,
        address: r.address || {},
        items: r.items || [],
        subtotal: Number(r.subtotal) || 0,
        shipping: Number(r.shipping) || 0,
        tax: Number(r.tax) || 0,
        discount: Number(r.discount) || 0,
        promoCode: r.promo_code,
        total: Number(r.total) || 0,
        paymentMethod: r.payment_method,
        paymentDetails: r.payment_details,
        billingSameAsShipping: r.billing_same_as_shipping,
        billingAddress: r.billing_address,
        paymentStatus: r.payment_status,
        deliveryMethod: r.delivery_method,
        status: r.status,
        trackingNumber: r.tracking_number,
        estimatedDelivery: r.estimated_delivery,
        createdAt: r.created_at
    };
}

function camelToSnakeMessage(m) {
    return { name: m.name, phone: m.phone, email: m.email, subject: m.subject, message: m.message };
}

function snakeToCamelMessage(r) {
    return { id: r.id, name: r.name, phone: r.phone, email: r.email, subject: r.subject, message: r.message, createdAt: r.created_at };
}

async function fetchOrders() {
    const rows = await sb("/orders?select=*&order=created_at.asc");
    return (Array.isArray(rows) ? rows : []).map(snakeToCamelOrder);
}

async function insertOrder(order) {
    await sb("/orders", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(camelToSnakeOrder(order)) });
}

async function updateOrder(orderId, fields) {
    const patch = {};
    // Map all camelCase fields to snake_case for Supabase
    const fieldMap = {
        status: "status",
        trackingNumber: "tracking_number",
        customerId: "customer_id",
        customerName: "customer_name",
        customerEmail: "customer_email",
        customerPhone: "customer_phone",
        shippingAddress: "shipping_address",
        address: "address",
        items: "items",
        subtotal: "subtotal",
        shipping: "shipping",
        tax: "tax",
        discount: "discount",
        promoCode: "promo_code",
        total: "total",
        paymentMethod: "payment_method",
        paymentDetails: "payment_details",
        billingSameAsShipping: "billing_same_as_shipping",
        billingAddress: "billing_address",
        paymentStatus: "payment_status",
        deliveryMethod: "delivery_method",
        estimatedDelivery: "estimated_delivery"
    };
    
    for (const [camelCase, snakeCase] of Object.entries(fieldMap)) {
        if (fields[camelCase] !== undefined) {
            patch[snakeCase] = fields[camelCase];
        }
    }
    
    // Allow any unlisted fields to pass through (for future compatibility)
    for (const [key, value] of Object.entries(fields)) {
        if (!fieldMap[key]) patch[key] = value;
    }
    
    if (!Object.keys(patch).length) return;
    await sb("/orders?order_id=eq." + encodeURIComponent(orderId), { method: "PATCH", body: JSON.stringify(patch) });
}

async function deleteOrder(orderId) {
    await sb("/orders?order_id=eq." + encodeURIComponent(orderId), { method: "DELETE" });
}

// ── PRODUCT FUNCTIONS ───────────────────────────────────────────────────────
async function fetchProducts() {
    const rows = await sb("/products?select=*&order=created_at.asc");
    return (Array.isArray(rows) ? rows : []).map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        price: Number(row.price),
        stock: row.stock,
        description: row.description,
        image: row.image,
        archived: row.archived,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

async function insertProduct(product) {
    await sb("/products", { 
        method: "POST", 
        headers: { Prefer: "return=representation" }, 
        body: JSON.stringify({
            name: product.name,
            category: product.category,
            price: product.price,
            stock: product.stock,
            description: product.description,
            image: product.image,
            archived: product.archived || false
        }) 
    });
}

async function updateProduct(productId, fields) {
    const patch = {};
    const fieldMap = {
        name: "name",
        category: "category",
        price: "price",
        stock: "stock",
        description: "description",
        image: "image",
        archived: "archived"
    };
    
    for (const [camelCase, snakeCase] of Object.entries(fieldMap)) {
        if (fields[camelCase] !== undefined) {
            patch[snakeCase] = fields[camelCase];
        }
    }
    
    if (!Object.keys(patch).length) return;
    await sb("/products?id=eq." + encodeURIComponent(productId), { method: "PATCH", body: JSON.stringify(patch) });
}

async function deleteProduct(productId) {
    await sb("/products?id=eq." + encodeURIComponent(productId), { method: "DELETE" });
}
// ── END PRODUCT FUNCTIONS ────────────────────────────────────────────────────

async function fetchMessages() {
    const rows = await sb("/contact_messages?select=*&order=created_at.asc");
    return (Array.isArray(rows) ? rows : []).map(snakeToCamelMessage);
}

async function insertMessage(msg) {
    await sb("/contact_messages", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(camelToSnakeMessage(msg)) });
}

module.exports = {
    fetchOrders,
    insertOrder,
    updateOrder,
    deleteOrder,
    fetchProducts,
    insertProduct,
    updateProduct,
    deleteProduct,
    fetchMessages,
    insertMessage,
    snakeToCamelOrder,
    camelToSnakeOrder,
    sb,
    SUPABASE_URL,
    SUPABASE_KEY
};