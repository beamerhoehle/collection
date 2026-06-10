// ==========================================================================
// 1. SETTINGS & IMMUTABLE CONFIG
// ==========================================================================
const SUPABASE_URL = 'https://kmanxvyaluledddvzdxv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttYW54dnlhbHVsZWRkZHZ6ZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjU5NjIsImV4cCI6MjA5NjYwMTk2Mn0.qBCdrzOo4qSbItETomTJ38Fc4gpvE4dMt5L9rYwMKq8';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentProduct = null;
let selectedSize = null;
let currentQty = 1;
let currentSlideIndex = 0;
// Alte Cart-Einträge mit 'id' statt 'product_id' migrieren
let rawCart = JSON.parse(localStorage.getItem('vaux_cart')) || [];
rawCart = rawCart.map(item => {
    if (item.id && !item.product_id) {
        item.product_id = item.id;
        delete item.id;
    }
    return item;
});
let cart = rawCart;
let currentDeliveryMethod = 'pickup';

const activeImages = [
    'https://kmanxvyaluledddvzdxv.supabase.co/storage/v1/object/public/product-images/No.3-(v1).jpg',
    'https://kmanxvyaluledddvzdxv.supabase.co/storage/v1/object/public/product-images/No.3-(v2).jpg'
];

document.addEventListener('DOMContentLoaded', async () => {
    buildCarousel();
    await loadProductData('beamerhoehle-tshirt-n1');
    updateCartCount();
    renderCartItems();
});

// ==========================================================================
// 2. CAROUSEL / SLIDER
// ==========================================================================
function buildCarousel() {
    const track = document.getElementById('carouselTrack');
    const dotsContainer = document.getElementById('carouselDots');
    if (!track) return;

    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    activeImages.forEach((url, idx) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.innerHTML = `<img src="${url}" alt="Produktansicht ${idx + 1}">`;
        track.appendChild(slide);

        const dot = document.createElement('button');
        dot.className = `c-dot ${idx === 0 ? 'active' : ''}`;
        dot.onclick = () => jumpToSlide(idx);
        dotsContainer.appendChild(dot);
    });
}

function moveSlider(direction) {
    currentSlideIndex += direction;
    if (currentSlideIndex >= activeImages.length) currentSlideIndex = 0;
    if (currentSlideIndex < 0) currentSlideIndex = activeImages.length - 1;
    updateSliderUI();
}

function jumpToSlide(index) {
    currentSlideIndex = index;
    updateSliderUI();
}

function updateSliderUI() {
    const track = document.getElementById('carouselTrack');
    if (track) {
        track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
    }
    document.querySelectorAll('.c-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentSlideIndex);
    });
}

// ==========================================================================
// 3. PRODUKTDATEN & GRÖSSEN AUS DER DB
// ==========================================================================
async function loadProductData(slug) {
    try {
        const { data: product, error } = await supabaseClient
            .from('shirts')
            .select(`*, shirt_variants (*)`)
            .eq('slug', slug)
            .maybeSingle();

        if (error) console.error("Supabase Error:", error.message);

        currentProduct = product || {
            id: 'fallback-id',
            name: 'KOLLEKTION N°3 PREMIUM T-SHIRT',
            subtitle: 'Official Beamerhöhle Wear',
            price_in_cents: 2999,
            shirt_variants: []
        };
    } catch (e) {
        console.error("Netzwerkfehler:", e);
        currentProduct = {
            id: 'fallback-id',
            name: 'KOLLEKTION N°3 PREMIUM T-SHIRT',
            subtitle: 'Official Beamerhöhle Wear',
            price_in_cents: 2999,
            shirt_variants: []
        };
    }

    // Bilder aus DB laden falls vorhanden, sonst Fallback auf hardcoded URLs
    if (currentProduct.images && currentProduct.images.length > 0) {
        activeImages.length = 0;
        currentProduct.images.forEach(url => activeImages.push(url));
        buildCarousel();
    }

    document.getElementById('prodName').innerHTML = currentProduct.name;
    document.getElementById('prodSubtitle').innerText = currentProduct.subtitle;
    document.getElementById('prodPrice').innerText = `€ ${(currentProduct.price_in_cents / 100).toFixed(2).replace('.', ',')}`;

    // Accordion-Texte aus DB befüllen falls vorhanden
    if (currentProduct.description) {
        const descEl = document.getElementById('accordionDescription');
        if (descEl) descEl.innerHTML = currentProduct.description;
    }
    if (currentProduct.care_instructions) {
        const careEl = document.getElementById('accordionCare');
        if (careEl) careEl.innerText = currentProduct.care_instructions;
    }
    if (currentProduct.shipping_info) {
        const shipEl = document.getElementById('accordionShipping');
        if (shipEl) shipEl.innerText = currentProduct.shipping_info;
    }

    buildSizes(currentProduct.shirt_variants);
}

function buildSizes(variants) {
    const grid = document.getElementById('sizeGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const fallbackStock = { 'S': 5, 'M': 10, 'L': 15, 'XL': 12, '2XL': 6, '3XL': 3 };
    let finalArray = (variants && variants.length > 0)
        ? variants
        : Object.keys(fallbackStock).map(s => ({ size: s, stock: fallbackStock[s] }));

    const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    finalArray.sort((a, b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size));

    finalArray.forEach(variant => {
        const btn = document.createElement('button');
        const stock = variant.stock !== undefined ? variant.stock : 5;

        if (stock <= 0) {
            btn.className = 'size-tile sold-out';
            btn.disabled = true;
            btn.innerHTML = `<span class="size-label">${variant.size}</span><span class="stock-label">Ausverkauft</span>`;
        } else if (stock <= 3) {
            btn.className = 'size-tile low-stock';
            btn.innerHTML = `<span class="size-label">${variant.size}</span><span class="stock-label stock-low">Nur noch ${stock}</span>`;
            btn.onclick = () => {
                selectedSize = variant.size;
                document.getElementById('selectedSizeLabel').innerText = selectedSize;
                document.getElementById('sizeError').classList.remove('show');
                document.querySelectorAll('.size-tile').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            };
        } else {
            btn.className = 'size-tile';
            btn.innerHTML = `<span class="size-label">${variant.size}</span><span class="stock-label">${stock} verfügbar</span>`;
            btn.onclick = () => {
                selectedSize = variant.size;
                document.getElementById('selectedSizeLabel').innerText = selectedSize;
                document.getElementById('sizeError').classList.remove('show');
                document.querySelectorAll('.size-tile').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            };
        }
        grid.appendChild(btn);
    });
}

// ==========================================================================
// 4. QUANTITY & CART INTERACTION
// ==========================================================================
function changeQty(mod) {
    currentQty = Math.max(1, currentQty + mod);
    document.getElementById('qtyDisplay').innerText = currentQty;
}

function toggleCart() {
    document.getElementById('cartOverlay').classList.toggle('open');
    document.getElementById('cartPanel').classList.toggle('open');
}

/**
 * showView — zeigt genau eine drawer-view an.
 * Verwaltet auch die Sichtbarkeit der Checkout-Buttons im Footer.
 */
function showView(viewId) {
    document.querySelectorAll('.drawer-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    // Footer-Buttons nur auf der Item-Ansicht und nur wenn Artikel im Warenkorb
    const checkoutOptions = document.getElementById('checkoutOptions');
    checkoutOptions.style.display = (viewId === 'viewItems' && cart.length > 0) ? 'grid' : 'none';
}

function addToCart() {
    if (!selectedSize) {
        document.getElementById('sizeError').classList.add('show');
        return;
    }
    const item = {
        product_id: currentProduct.id,
        name: currentProduct.name,
        size: selectedSize,
        price: currentProduct.price_in_cents,
        qty: currentQty,
        image: activeImages[0]
    };

    const findIdx = cart.findIndex(c => c.product_id === item.product_id && c.size === item.size);
    if (findIdx > -1) {
        cart[findIdx].qty += currentQty;
    } else {
        cart.push(item);
    }
    saveCartState();
    toggleCart();
}

function saveCartState() {
    localStorage.setItem('vaux_cart', JSON.stringify(cart));
    updateCartCount();
    renderCartItems();
}

function updateCartCount() {
    document.getElementById('cartCount').innerText = cart.reduce((acc, i) => acc + i.qty, 0);
}

// ==========================================================================
// 5. WARENKORB BERECHNUNGEN & RENDERER
// ==========================================================================
function getTotals() {
    let sub = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    let items = cart.reduce((acc, i) => acc + i.qty, 0);
    let ship = (currentDeliveryMethod === 'shipping' && items < 2) ? 299 : 0;
    return { grand: sub + ship, shipping: ship };
}

function renderCartItems() {
    const box = document.getElementById('cartItemsContainer');
    const totalField = document.getElementById('cartTotal');
    if (!box) return;

    if (cart.length === 0) {
        box.innerHTML = `<div class="cart-empty">Dein Warenkorb ist leer.</div>`;
        totalField.innerText = '€ 0,00';
        document.getElementById('checkoutOptions').style.display = 'none';
        return;
    }

    box.innerHTML = '';
    cart.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-details">
                <div class="item-meta">
                    <h5>${item.name}</h5>
                    <span>Größe: ${item.size}</span>
                </div>
                <div class="item-actions">
                    <div class="mini-qty">
                        <button onclick="updateCartQty(${idx}, -1)">−</button>
                        <span>${item.qty}</span>
                        <button onclick="updateCartQty(${idx}, 1)">+</button>
                    </div>
                    <span style="font-weight:600;">€ ${((item.price * item.qty) / 100).toFixed(2).replace('.', ',')}</span>
                </div>
                <button class="del-btn" onclick="killCartItem(${idx})">Entfernen</button>
            </div>
        `;
        box.appendChild(div);
    });

    // Versand-/Abholhinweis
    const data = getTotals();
    const costRow = document.createElement('div');
    costRow.className = 'cart-cost-row';
    if (currentDeliveryMethod === 'pickup') {
        costRow.innerHTML = `<span>Option:</span><span>🏪 Selbstabholung</span>`;
    } else {
        costRow.innerHTML = `<span>Versandkosten:</span><span>${data.shipping > 0 ? '€ 2,99' : '<span style="color:var(--success-green);">Kostenlos</span>'}</span>`;
    }
    box.appendChild(costRow);

    totalField.innerText = `€ ${(data.grand / 100).toFixed(2).replace('.', ',')}`;

    // Footer-Buttons einblenden wenn Artikel da
    document.getElementById('checkoutOptions').style.display = 'grid';
}

function updateCartQty(idx, mod) {
    cart[idx].qty += mod;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    saveCartState();
}

function killCartItem(idx) {
    cart.splice(idx, 1);
    saveCartState();
}

// ==========================================================================
// 6. CHECKOUT CONTROLLER — strikte Trennung Abholung / Versand
// ==========================================================================
function startCheckout(method) {
    currentDeliveryMethod = method;
    renderCartItems(); // Gesamtbetrag neu berechnen

    if (method === 'shipping') {
        showView('viewCheckoutShipping');
    } else {
        updatePickupPaymentNote(); // Note & Button-Text initialisieren
        showView('viewCheckoutPickup');
    }
}

/**
 * Aktualisiert den Hinweistext und den Button-Text bei der Abholung
 * je nach gewählter Zahlungsart.
 */
function updatePickupPaymentNote() {
    const submitBtn = document.getElementById('pickupSubmitBtn');
    const note = document.getElementById('paymentNote');
    const checkedRadio = document.querySelector('input[name="pickupPayment"]:checked');
    if (!checkedRadio) return;

    if (checkedRadio.value === 'PayPal') {
        submitBtn.innerText = "Zu PayPal & Bestellen";
        note.innerText = "Zahlung erfolgt direkt via PayPal.me.";
    } else {
        submitBtn.innerText = "Verbindlich Reservieren";
        note.innerText = "Bezahlung erfolgt bar bei Abholung.";
    }
}

// ==========================================================================
// 7. FORMULAR-VALIDIERUNG
// ==========================================================================
function validateForm() {
    let ok = true;

    const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };
    const err = (id, show) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('show', show);
    };

    if (currentDeliveryMethod === 'pickup') {
        if (!val('pickupFirst'))  { err('pickupFirstErr', true); ok = false; } else { err('pickupFirstErr', false); }
        if (!val('pickupLast'))   { err('pickupLastErr', true); ok = false; } else { err('pickupLastErr', false); }
        if (!val('pickupEmail') || !val('pickupEmail').includes('@')) { err('pickupEmailErr', true); ok = false; } else { err('pickupEmailErr', false); }
    } else {
        if (!val('shipFirst'))  { err('shipFirstErr', true); ok = false; } else { err('shipFirstErr', false); }
        if (!val('shipLast'))   { err('shipLastErr', true); ok = false; } else { err('shipLastErr', false); }
        if (!val('shipEmail') || !val('shipEmail').includes('@')) { err('shipEmailErr', true); ok = false; } else { err('shipEmailErr', false); }
        if (!val('custStreet')) { err('custStreetErr', true); ok = false; } else { err('custStreetErr', false); }
        if (!val('custZip'))    { err('custZipErr', true); ok = false; } else { err('custZipErr', false); }
        if (!val('custCity'))   { err('custCityErr', true); ok = false; } else { err('custCityErr', false); }
    }

    return ok;
}

// ==========================================================================
// 8. BESTELLUNG ABSENDEN
// ==========================================================================
async function submitOrder() {
    if (!validateForm()) return;

    const calculations = getTotals();

    let payMethod = 'Bar';
    let firstName, lastName, email;

    if (currentDeliveryMethod === 'shipping') {
        payMethod = 'PayPal';
        firstName = document.getElementById('shipFirst').value.trim();
        lastName  = document.getElementById('shipLast').value.trim();
        email     = document.getElementById('shipEmail').value.trim();
    } else {
        payMethod = document.querySelector('input[name="pickupPayment"]:checked').value;
        firstName = document.getElementById('pickupFirst').value.trim();
        lastName  = document.getElementById('pickupLast').value.trim();
        email     = document.getElementById('pickupEmail').value.trim();
    }

    const isPayPal = (payMethod === 'PayPal');
    const finalSizes = cart.map(i => `${i.size} (${i.qty}x)`).join(', ');
    const finalQty = cart.reduce((acc, i) => acc + i.qty, 0);

    const dataPayload = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        delivery_method: currentDeliveryMethod,
        payment_method: payMethod,
        payment_status: isPayPal ? 'Bezahlt via PayPal' : 'offen',
        total_amount_in_cents: calculations.grand,
        cart_items: cart,
        selected_size: finalSizes,
        total_quantity: finalQty,
        status: 'pending',
        street:    currentDeliveryMethod === 'shipping' ? document.getElementById('custStreet').value.trim() : null,
        zip_code:  currentDeliveryMethod === 'shipping' ? document.getElementById('custZip').value.trim() : null,
        city:      currentDeliveryMethod === 'shipping' ? document.getElementById('custCity').value.trim() : null
    };

    const { error } = await supabaseClient.from('orders').insert([dataPayload]);
    if (error) {
        alert('Datenbankfehler: ' + error.message);
        return;
    }

    const printPrice = (calculations.grand / 100).toFixed(2);

    if (isPayPal) {
        window.open(`https://www.paypal.me/JulianGromadka/${printPrice}`, '_blank');
        document.getElementById('successMsg').innerHTML =
            `Bestellung übermittelt!<br>Bitte begleiche den Betrag im geöffneten PayPal-Fenster.<br><br><strong>Betrag: € ${printPrice.replace('.', ',')}</strong>`;
    } else {
        document.getElementById('successMsg').innerHTML =
            `Bestellung für dich reserviert!<br>Bitte bringe den Betrag passend zur Abholung mit.<br><br><strong>Betrag: € ${printPrice.replace('.', ',')}</strong>`;
    }

    cart = [];
    localStorage.removeItem('vaux_cart');
    updateCartCount();
    showView('viewSuccess');
}
