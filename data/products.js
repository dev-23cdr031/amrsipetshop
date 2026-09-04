const products = [

    // ================================
    // FISH SUPPLIES
    // ================================

    {
        id: 1,
        name: "Freeze Dried Tubifex Worms 20grms",
        category: "fish",
        price: 10,
        stock: 48,
        description: "Nutrient-rich freeze-dried tubifex worms — a high-protein treat for all tropical fish.",
        image: "/images/product-01.jpeg"
    },
    {
        id: 2,
        name: "Taiyo 100grms",
        category: "fish",
        price: 30,
        stock: 60,
        description: "Balanced daily flake food supporting healthy growth and vivid colour.",
        image: "/images/product-02.jpeg"
    },
    {
        id: 3,
        name: "Osaka Green 100grms",
        category: "fish",
        price: 70,
        stock: 35,
        description: "Premium green flakes enriched with spirulina for herbivorous and community fish.",
        image: "/images/product-03.jpeg"
    },
    {
        id: 4,
        name: "Optimum 100grms",
        category: "fish",
        price: 100,
        stock: 40,
        description: "All-round optimum nutrition formula for everyday feeding.",
        image: "/images/product-04.jpeg"
    },
    {
        id: 5,
        name: "Royal Breeding feed Betta fish",
        category: "fish",
        price: 70,
        stock: 25,
        description: "Specially formulated to enhance betta colour, finnage and breeding vitality.",
        image: "/images/product-05.jpeg"
    },
    {
        id: 6,
        name: "Royal Breeding feed Guppy fish",
        category: "fish",
        price: 70,
        stock: 30,
        description: "Fine granules tailored for guppies — boosts fertility and bright colouring.",
        image: "/images/product-06.jpeg"
    },
    {
        id: 7,
        name: "Royal Glowfish food",
        category: "fish",
        price: 70,
        stock: 22,
        description: "Colour-enhancing diet that brings out the natural glow of glofish and tetras.",
        image: "/images/product-07.jpeg"
    },
    {
        id: 8,
        name: "Royal flowerhorn fish food",
        category: "fish",
        price: 180,
        stock: 18,
        description: "High-protein pellets for flowerhorn head growth and striking colour.",
        image: "/images/product-08.jpeg"
    },
    {
        id: 9,
        name: "Royal Oscar fish food",
        category: "fish",
        price: 180,
        stock: 16,
        description: "Large floating pellets designed for oscars and other big cichlids.",
        image: "/images/product-09.jpeg"
    },
    {
        id: 10,
        name: "Champion Guppy feed",
        category: "fish",
        price: 49,
        stock: 44,
        description: "Economical everyday guppy food for steady, healthy growth.",
        image: "/images/product-10.jpeg"
    },
    {
        id: 11,
        name: "Champion Betta feed",
        category: "fish",
        price: 49,
        stock: 38,
        description: "Tiny soft pellets that bettas love — keeps water clean and clear.",
        image: "/images/product-11.jpeg"
    },

    // ================================
    // AQUARIUM ACCESSORIES
    // ================================

    {
        id: 12,
        name: "Bluepet BL-108 air pump",
        category: "accessories",
        price: 220,
        stock: 20,
        description: "Quiet, reliable air pump ideal for small to medium aquariums.",
        image: "/images/product-12.jpeg"
    },
    {
        id: 13,
        name: "Liny Mute air pump",
        category: "accessories",
        price: 180,
        stock: 24,
        description: "Ultra-silent air pump with low power consumption for nano tanks.",
        image: "/images/product-13.jpeg"
    },
    {
        id: 14,
        name: "Bluepet liquid filter",
        category: "accessories",
        price: 250,
        stock: 15,
        description: "Compact internal liquid filter with mechanical and biological media.",
        image: "/images/product-14.jpeg"
    },
    {
        id: 15,
        name: "Bluepet Liquid filter BL-420F",
        category: "accessories",
        price: 350,
        stock: 12,
        description: "Powerful hang-on filter with adjustable flow for tanks up to 200L.",
        image: "/images/product-15.jpeg"
    },
    {
        id: 16,
        name: "Bluepet Internal liquid filter BL-1000F",
        category: "accessories",
        price: 400,
        stock: 10,
        description: "High-capacity internal filter for large aquariums and planted setups.",
        image: "/images/product-16.jpeg"
    },
    {
        id: 17,
        name: "Bluepet Biosponge filter",
        category: "accessories",
        price: 90,
        stock: 50,
        description: "Gentle sponge filter — perfect for fry, shrimp and breeding tanks.",
        image: "/images/product-17.jpeg"
    },
    {
        id: 18,
        name: "Bluepet airstone filter",
        category: "accessories",
        price: 220,
        stock: 28,
        description: "Fine-bubble airstone that boosts oxygen and water circulation.",
        image: "/images/product-18.jpeg"
    },
    {
        id: 19,
        name: "Liny mini hanging filter",
        category: "accessories",
        price: 400,
        stock: 14,
        description: "Slim hang-on filter suited to nano and desktop aquariums.",
        image: "/images/product-19.jpeg"
    },
    {
        id: 20,
        name: "SOBO internal filter",
        category: "accessories",
        price: 700,
        stock: 9,
        description: "Robust internal filter with multi-stage media for crystal-clear water.",
        image: "/images/product-20.jpeg"
    },
    {
        id: 21,
        name: "Bluepet BW-60",
        category: "accessories",
        price: 9999,
        stock: 5,
        description: "Canister filter with quiet operation for mid-sized aquariums.",
        image: "/images/product-21.jpeg"
    },
    {
        id: 22,
        name: "Bluepet BW-80",
        category: "accessories",
        price: 16000,
        stock: 4,
        description: "High-flow canister filter for tanks up to 500L with easy priming.",
        image: "/images/product-22.jpeg"
    },
    {
        id: 23,
        name: "Bluepet BW-120",
        category: "accessories",
        price: 26000,
        stock: 3,
        description: "Pro-grade canister filter for large aquascapes and cichlid tanks.",
        image: "/images/product-23.jpeg"
    },
    {
        id: 24,
        name: "Bluepet BW-150",
        category: "accessories",
        price: 34500,
        stock: 2,
        description: "Flagship canister filter with maximum media capacity and flow.",
        image: "/images/product-24.jpeg"
    },

    // ================================
    // DOG SUPPLIES
    // ================================

    {
        id: 25,
        name: "Dog milk stick 250grms",
        category: "dog",
        price: 240,
        stock: 30,
        description: "Creamy milk-flavoured sticks that dogs love — great as a daily treat.",
        image: "/images/product-25.jpeg"
    },
    {
        id: 26,
        name: "Chicken Stock 250grms",
        category: "dog",
        price: 100,
        stock: 42,
        description: "Real chicken stock treat rich in protein for active dogs.",
        image: "/images/product-26.jpeg"
    },
    {
        id: 27,
        name: "Mutton stock 250grms",
        category: "dog",
        price: 100,
        stock: 36,
        description: "Savoury mutton stock treat packed with natural flavour.",
        image: "/images/product-27.jpeg"
    },
    {
        id: 28,
        name: "Pyoclear Dog Shampoo",
        category: "dog",
        price: 380,
        stock: 18,
        description: "Anti-bacterial shampoo that soothes skin and keeps the coat fresh.",
        image: "/images/product-28.jpeg"
    },
    {
        id: 29,
        name: "Dermfine Dog shampoo",
        category: "dog",
        price: 390,
        stock: 20,
        description: "Gentle conditioning shampoo for sensitive and dry skin.",
        image: "/images/product-29.jpeg"
    },
    {
        id: 30,
        name: "Glow coat syrup",
        category: "dog",
        price: 460,
        stock: 16,
        description: "Coat-health supplement that adds shine and reduces shedding.",
        image: "/images/product-30.jpeg"
    },
    {
        id: 31,
        name: "Itch relief tablet",
        category: "dog",
        price: 280,
        stock: 22,
        description: "Soothing tablets that help relieve itching and skin irritation.",
        image: "/images/product-31.jpeg"
    }

];

module.exports = products;
