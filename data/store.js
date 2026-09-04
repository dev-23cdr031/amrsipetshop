// Simple JSON file persistence helpers for orders + product overrides.
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname);
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const OVERRIDES_FILE = path.join(DATA_DIR, "product-overrides.json");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        const raw = fs.readFileSync(file, "utf-8").trim();
        return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
        console.error("readJSON error for", file, err.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    const temporaryFile = file + "." + process.pid + ".tmp";
    try {
        // A completed write is swapped into place in one rename, so a crash
        // cannot leave a partially-written JSON document behind.
        fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), "utf-8");
        fs.renameSync(temporaryFile, file);
        return true;
    } catch (err) {
        try { if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile); } catch (_) {}
        console.error("writeJSON error for", file, err.message);
        return false;
    }
}

// Orders
function loadOrders() {
    return readJSON(ORDERS_FILE, []);
}
function saveOrders(orders) {
    return writeJSON(ORDERS_FILE, orders);
}

// Product overrides (admin edits to price/stock/etc. applied on top of products.js)
function loadOverrides() {
    return readJSON(OVERRIDES_FILE, {});
}
function saveOverrides(overrides) {
    return writeJSON(OVERRIDES_FILE, overrides);
}

// Customers (local fallback for auth when Supabase tables are missing)
function loadCustomers() {
    return readJSON(CUSTOMERS_FILE, []);
}
function saveCustomers(customers) {
    return writeJSON(CUSTOMERS_FILE, customers);
}
function findCustomerByEmail(email) {
    const customers = loadCustomers();
    return customers.find(c => c.email && c.email.toLowerCase() === email.toLowerCase()) || null;
}
function findCustomerById(id) {
    const customers = loadCustomers();
    return customers.find(c => c.id === id) || null;
}
function addCustomer(customer) {
    const customers = loadCustomers();
    customers.push(customer);
    saveCustomers(customers);
    return customer;
}

module.exports = {
    loadOrders,
    saveOrders,
    loadOverrides,
    saveOverrides,
    loadCustomers,
    saveCustomers,
    findCustomerByEmail,
    findCustomerById,
    addCustomer,
    ORDERS_FILE,
    OVERRIDES_FILE,
    CUSTOMERS_FILE
};
