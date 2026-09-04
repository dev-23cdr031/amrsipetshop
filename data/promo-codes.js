// Promo / coupon code definitions
// type: "percent" reduces by N% of subtotal | "flat" reduces by a fixed amount
const promoCodes = [
    {
        code: "PETLOVE10",
        type: "percent",
        value: 10,            // 10% off
        minSubtotal: 0,
        maxDiscount: 500,
        description: "10% off your order (max ₹500)",
        active: true
    },
    {
        code: "WELCOME150",
        type: "flat",
        value: 150,           // ₹150 off
        minSubtotal: 999,
        maxDiscount: 150,
        description: "₹150 off orders above ₹999",
        active: true
    },
    {
        code: "AQUA20",
        type: "percent",
        value: 20,
        minSubtotal: 2000,
        maxDiscount: 1000,
        description: "20% off aquarium orders above ₹2000 (max ₹1000)",
        active: true
    },
    {
        code: "FREESHIP",
        type: "flat",
        value: 49,
        minSubtotal: 500,
        maxDiscount: 49,
        description: "Free shipping on orders above ₹500",
        active: true
    }
];

module.exports = promoCodes;
