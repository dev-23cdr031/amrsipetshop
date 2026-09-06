// Sync existing local orders from data/orders.json to Supabase.
// Run this after the orders table migration to backfill existing orders.
//
// Usage:
//   node supabase/sync-orders.js

const supabase = require("../supabase.js");
const store = require("../data/store.js");

async function main() {
    console.log("=== SYNC LOCAL ORDERS TO SUPABASE ===\n");

    const localOrders = store.loadOrders();
    console.log("Found", localOrders.length, "local orders in data/orders.json\n");

    if (localOrders.length === 0) {
        console.log("No local orders to sync.");
        process.exit(0);
    }

    // Fetch existing Supabase orders to avoid duplicates
    let existing = [];
    try {
        existing = await supabase.fetchOrders();
        console.log("Found", existing.length, "existing orders in Supabase\n");
    } catch (e) {
        console.log("Could not fetch existing Supabase orders:", e.message);
    }

    const existingIds = new Set(existing.map(o => o.orderId));
    const toSync = localOrders.filter(o => !existingIds.has(o.orderId));
    console.log(toSync.length, "new orders to sync (skipping", existing.length, "already in Supabase)\n");

    let success = 0;
    let failed = 0;
    for (const order of toSync) {
        try {
            await supabase.insertOrder(order);
            success++;
            console.log("  ✓ Synced:", order.orderId, "|", order.customerName, "| Rs" + order.total);
        } catch (e) {
            failed++;
            console.error("  ✗ Failed:", order.orderId, "-", e.message);
        }
    }

    console.log("\n=== DONE ===");
    console.log("Synced:", success);
    console.log("Failed:", failed);
    console.log("Already in Supabase:", existing.length);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(function (e) {
    console.error("Script failed:", e.message);
    process.exit(1);
});