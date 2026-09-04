// Reset Supabase products table and re-seed with correct data from data/products.js
const supabase = require("../supabase.js");
const baseProducts = require("../data/products.js");

async function resetAndSeed() {
    console.log("=== RESET AND SEED PRODUCTS ===\n");
    
    // Step 1: Fetch and delete all existing products
    console.log("Step 1: Fetching all existing products...");
    let existingProducts = await supabase.fetchProducts();
    console.log(`Found ${existingProducts.length} products to remove\n`);
    
    let deletedCount = 0;
    for (const p of existingProducts) {
        try {
            await supabase.deleteProduct(p.id);
            deletedCount++;
            if (deletedCount % 5 === 0) console.log(`  Deleted ${deletedCount}/${existingProducts.length}...`);
        } catch (e) {
            console.error(`  Failed to delete ID ${p.id}:`, e.message);
        }
    }
    console.log(`Deleted ${deletedCount} products\n`);
    
    // Step 2: Re-seed with correct data from products.js
    console.log(`Step 2: Seeding ${baseProducts.length} products from data/products.js...`);
    let successCount = 0;
    let errorCount = 0;
    
    for (const product of baseProducts) {
        try {
            await supabase.insertProduct({
                name: product.name,
                category: product.category,
                price: product.price,
                stock: product.stock,
                description: product.description,
                image: product.image,
                archived: false
            });
            successCount++;
            if (successCount % 5 === 0) console.log(`  Seeded ${successCount}/${baseProducts.length}...`);
        } catch (e) {
            errorCount++;
            console.error(`  Failed: ${product.name}:`, e.message);
        }
    }
    
    console.log(`\nSeeded ${successCount} products, ${errorCount} failed\n`);
    
    // Step 3: Verify
    console.log("Step 3: Verification...");
    const finalProducts = await supabase.fetchProducts();
    console.log(`Total products in Supabase: ${finalProducts.length}`);
    
    // Show first few products to verify correctness
    console.log("\nFirst 5 products:");
    finalProducts.slice(0, 5).forEach(p => {
        console.log(`  ID ${p.id}: ${p.name} - Rs.${p.price} (${p.category})`);
    });
    
    // Check for any price=0 products
    const zeroPrice = finalProducts.filter(p => p.price === 0);
    if (zeroPrice.length > 0) {
        console.log(`\nWARNING: ${zeroPrice.length} products have price 0!`);
        zeroPrice.forEach(p => console.log(`  ID ${p.id}: ${p.name}`));
    } else {
        console.log("\nAll products have valid prices!");
    }
}

resetAndSeed().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
});