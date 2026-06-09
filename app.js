// 1. SUPABASE INITIALISIERUNG (Exakt auf deine beamerhoehle-collection eingestellt)
const SUPABASE_URL = 'https://kmanxvyaluledddvzdxv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttYW54dnlhbHVsZWRkZHZ6ZHh2Iiwicm9sZSI6Imam9uIiwiaWF0IjoxNzgxMDI1OTYyLCJleHAiOjIwOTY2MDE5NjJ9.qBCdrzOo4qSbItETomTJ38Fc4gpvE4dMt5L9rYwMKq8';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Globale Variablen für den Shop-Zustand
let currentProduct = null;
let selectedSize = null;
let currentQty = 1;
let cart = JSON.parse(localStorage.getItem('vaux_cart')) || [];
let activeImages = [];

// 2. INITIALISIERUNG BEIM SEITENSTART
document.addEventListener('DOMContentLoaded', async () => {
    await loadProduct('beamerhoehle-tshirt-n1');
    updateCartCount();
    renderCartItems();
});

// 3. PRODUKTDATEN DYNAMISCH AUS SUPABASE LADEN
async function loadProduct(slug) {
    const { data: product, error } = await supabaseClient
        .from('shirts')
        .select(`
            *,
            shirt_variants (*)
        `)
        .eq('slug', slug)
        .single();

    if (error || !product) {
        console.error('Fehler beim Laden des Shirts:', error);
        document.getElementById('prodName').innerText = "Produkt nicht gefunden";
        return;
    }

    currentProduct = product;
    activeImages = product.images;

    // Texte in der HTML befüllen
    document.getElementById('prodName').innerHTML = product.name.replace(/ /g, '<br>');
    document.getElementById('prodSubtitle').innerText = product.subtitle;
    document.getElementById('prodPrice').innerText = `€ ${(product.price_in_cents / 100).toFixed(2).replace('.', ',')}`;
    document.getElementById('prodDescription').innerText = product.description;
    document.getElementById('prodCare').innerText = product.care_instructions;
    document.getElementById('prodShipping').innerText = product.shipping_info;

    setupGallery();
    renderSizeGrid(product.shirt_variants);
}

// 4. GALERIE-LOGIK
function setupGallery() {
    const mainImg = document.getElementById('mainImg');
    const thumbStrip = document.getElementById('thumbStrip');
    const thumbDots = document.getElementById('thumbDots');

    if (!activeImages || activeImages.length === 0) return;

    mainImg.src = activeImages[0];
    thumbStrip.innerHTML = '';
    thumbDots.innerHTML = '';

    activeImages.forEach((imgUrl, index) => {
        const thumb = document.createElement('div');
        thumb.className = `thumb ${index === 0 ? 'active' : ''}`;
        thumb.onclick = () => switchImg(index, thumb);
        thumb.innerHTML = `<img src="${imgUrl}" alt="Ansicht ${index + 1}">`;
        thumbStrip.appendChild(thumb);

        const dot = document.createElement('button');
        dot.className = `thumb-dot ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => switchImg(index, dot);
        thumbDots.appendChild(dot);
    });
}

function switchImg(index, element) {
    const mainImg = document.getElementById('mainImg');
    mainImg.classList.add('fade');
    
    setTimeout(() => {
        mainImg.src = activeImages[index];
        mainImg.classList.remove('fade');
    }, 200);

    document.querySelectorAll('.thumb').forEach((t, i) => {
        t.classList.toggle('active', i === index);
    });
    document.querySelectorAll('.thumb-dot').forEach((d, i) => {
        d.classList.toggle('active', i === index);
    });
}

// 5. GRÖSSEN-GRID RENDERN
function renderSizeGrid(variants) {
    const sizeGrid = document.getElementById('sizeGrid');
    sizeGrid.innerHTML = '';

    const sizeOrder = ['M', 'L', 'XL', '2XL'];
    variants.sort((a, b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size));

    variants.forEach(variant => {
        const btn = document.createElement('button');
        btn.className = 'size-btn';
        btn.innerText = variant.size;

        if (variant.stock <= 0) {
            btn.disabled = true;
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
            btn.innerText += ' (Ausverkauft)';
        } else {
            btn.onclick = () => {
                selectedSize = variant.size;
                document.getElementById('sizeError').classList.remove('show');
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            };
        }
        sizeGrid.appendChild(btn);
    });
}

// 6. WARENKORB-LOGIK
function changeQty(change) {
    currentQty = Math.max(1, currentQty + change);
    document.getElementById('qtyDisplay').innerText = currentQty;
}

function toggleCart() {
    document.getElementById('cartOverlay').classList.toggle('open');
    document.getElementById('cartPanel').classList.toggle('open');
}

function showView(viewId) {
    document.querySelectorAll('.cart-body .view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.getElementById('checkoutOptions').style.display = (viewId === 'viewItems' && cart.length > 0) ? 'grid' : 'none';
}

function addToCart() {
    if (!selectedSize) {
        document.getElementById('sizeError').classList.add('show');
        return;
    }

    const cartItem = {
        id: currentProduct.id,
        name: currentProduct.name,
        size: selectedSize,
        price: currentProduct.price_in_cents,
        qty: currentQty,
        image: activeImages[0]
    };

    const existingIndex = cart.findIndex(item => item.id === cartItem.id && item.size === cartItem.size);
    if (existingIndex > -1) {
        cart[existingIndex].qty += currentQty;
    } else {
        cart.push(cartItem);
    }

    saveCart();
    toggleCart();
}

function saveCart() {
    localStorage.setItem('vaux_cart', JSON.stringify(cart));
    updateCartCount();
    renderCartItems();
}

function updateCartCount() {
    const count = cart.reduce((total, item) => total + item.qty, 0);
    document.getElementById('cartCount').innerText = count;
}

function renderCartItems() {
    const container = document.getElementById('cartItemsContainer');
    const totalDisplay = document.getElementById('cartTotal');
    const checkoutOptions = document.getElementById('checkoutOptions');

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <strong>Leergut.</strong>
                Dein Warenkorb ist aktuell leer.
            </div>`;
        totalDisplay.innerText = '€ 0,00';
        checkoutOptions.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    let productTotal = 0;
    let totalItemsCount = 0;

    // Artikel auflisten
    cart.forEach((item, index) => {
        productTotal += item.price * item.qty;
        totalItemsCount += item.qty;
        
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <img src="${item.image}" class="cart-item-img" alt="${item.name}">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-size">Größe: ${item.size}</div>
                <div class="cart-item-bottom">
                    <div class="cart-qty-ctrl">
                        <button class="cart-qty-btn" onclick="updateQty(${index}, -1)">−</button>
                        <span class="cart-qty-val">${item.qty}</span>
                        <button class="cart-qty-btn" onclick="updateQty(${index}, 1)">+</button>
                    </div>
                    <span class="cart-item-price">€ ${((item.price * item.qty) / 100).toFixed(2).replace('.', ',')}</span>
                </div>
                <button class="remove-item-btn" onclick="removeItem(${index})" style="margin-top:0.4rem;">Entfernen</button>
            </div>
        `;
        container.appendChild(itemEl);
    });

    // NEU: Versandkosten-Logik (Frei ab 2 Artikeln)
    let shippingCost = totalItemsCount >= 2 ? 0 : 299; // 299 Cents = 2,99 €
    
    // Versandkosten als Zeile im Warenkorb anzeigen, falls vorhanden
    const shippingEl = document.createElement('div');
    shippingEl.style.display = 'flex';
    shippingEl.style.justify = 'space-between';
    shippingEl.style.padding = '0.5rem 0';
    shippingEl.style.fontSize = '0.9rem';
    shippingEl.style.color = '#888';
    shippingEl.style.borderTop = '1px dashed #333';
    
    if (shippingCost > 0) {
        shippingEl.innerHTML = `<span>Versandkosten:</span><span>€ 2,99</span>`;
    } else {
        shippingEl.innerHTML = `<span>Versandkosten:</span><span style="color: #00ff66;">Kostenlos</span>`;
    }
    container.appendChild(shippingEl);

    // Endsumme berechnen (Produkte + Versand)
    let grandTotal = productTotal + shippingCost;
    totalDisplay.innerText = `€ ${(grandTotal / 100).toFixed(2).replace('.', ',')}`;
    checkoutOptions.style.display = 'grid';
}

function updateQty(index, change) {
    cart[index].qty += change;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
}

function removeItem(index) {
    cart.splice(index, 1);
    saveCart();
}

// 7. BESTELLUNG ABSENDEN
async function submitOrder() {
    const email = document.getElementById('pickupEmail').value.trim();
    const first = document.getElementById('pickupFirst').value.trim();
    const last = document.getElementById('pickupLast').value.trim();

    document.getElementById('pickupEmailErr').classList.remove('show');
    document.getElementById('pickupFirstErr').classList.remove('show');
    document.getElementById('pickupLastErr').classList.remove('show');

    let valid = true;
    if (!email || !email.includes('@')) { document.getElementById('pickupEmailErr').classList.add('show'); valid = false; }
    if (!first) { document.getElementById('pickupFirstErr').classList.add('show'); valid = false; }
    if (!last) { document.getElementById('pickupLastErr').classList.add('show'); valid = false; }

    if (!valid) return;

    let totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);
    let productTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let shippingCost = totalItemsCount >= 2 ? 0 : 299;
    let grandTotal = productTotal + shippingCost;

    const orderData = {
        email: email,
        first_name: first,
        last_name: last,
        delivery_method: 'pickup',
        payment_method: 'bar',
        total_amount_in_cents: grandTotal, // Speichert den korrekten Gesamtpreis inklusive Versand
        cart_items: cart,
        status: 'pending'
    };

    const { error } = await supabaseClient
        .from('orders')
        .insert([orderData]);

    if (error) {
        alert('Fehler beim Absenden der Bestellung. Bitte versuche es erneut.');
        console.error(error);
        return;
    }

    cart = [];
    localStorage.removeItem('vaux_cart');
    updateCartCount();
    showView('viewSuccess');
}
