// Get cart from localStorage
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Add item (called from menu page)
function addToCart(name, price, image) {
    cart.push({ name, price, image });
    localStorage.setItem("cart", JSON.stringify(cart));
    alert(name + " added to cart");
}

// Render cart items (ONLY on cart page)
function renderCart() {
    const container = document.getElementById("cart-items");
    const totalEl = document.getElementById("total-price");

    if (!container) return;

    container.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        total += item.price;

        container.innerHTML += `
            <div class="cart-card">
                <img src="${item.image}" class="cart-img">

                <div class="cart-info">
                    <h3>${item.name}</h3>
                    <p>Price: ₹${item.price}</p>
                </div>

                <button class="remove-btn" onclick="removeItem(${index})">
                    ✕
                </button>
            </div>
        `;
    });

    totalEl.innerText = total;
}

// Remove single item
function removeItem(index) {
    cart.splice(index, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
}

// Clear cart
function clearCart() {
    cart = [];
    localStorage.removeItem("cart");
    renderCart();
}

// Auto load on cart page
renderCart();