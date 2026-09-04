// Shared authentication navbar controller.
// Renders a single "Login" link when the visitor is logged out, or a single
// "Logout" button when they are logged in — so there is never both at once.
(function () {
    function currentUser() {
        try { return JSON.parse(localStorage.getItem("petshop_currentUser") || "null"); }
        catch (e) { return null; }
    }

    // Clears the session and returns to the login screen.
    window.logout = function () {
        localStorage.removeItem("petshop_currentUser");
        window.location.href = "/login.html";
    };

    function renderAuth() {
        const user = currentUser();

        document.querySelectorAll("[data-auth-nav]").forEach(function (el) {
            const style = el.getAttribute("data-auth-nav") || "bootstrap";

            if (style === "index") {
                // Tailwind-styled nav used on the homepage (desktop).
                el.innerHTML = user
                    ? '<a href="#" onclick="logout(); return false;" class="hover:text-white transition-colors"><i class="bi bi-box-arrow-right mr-1"></i> Logout</a>'
                    : '<a href="login.html" class="hover:text-white transition-colors"><i class="bi bi-box-arrow-in-right mr-1"></i> Login</a>';
            } else if (style === "index-mobile") {
                // Large text links used in the homepage mobile menu.
                el.innerHTML = user
                    ? '<a href="#" onclick="logout(); return false;" class="text-4xl font-bold text-white hover:text-red-400 transition-colors">Logout</a>'
                    : '<a href="login.html" class="text-4xl font-bold text-white hover:text-red-400 transition-colors">Login</a>';
            } else {
                // Bootstrap nav-link style used across the shop pages.
                el.innerHTML = user
                    ? '<a class="nav-link" href="#" onclick="logout(); return false;"><i class="bi bi-box-arrow-right"></i> Logout</a>'
                    : '<a class="nav-link" href="/login.html"><i class="bi bi-box-arrow-in-right"></i> Login</a>';
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderAuth);
    } else {
        renderAuth();
    }
})();
