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
let cart = JSON.parse(localStorage.getItem('vaux_cart')) || [];
let currentDeliveryMethod = 'pickup';

// DEINE FIXEN BILD-URLS FÜR DEN MODERNEN SLIDER
const activeImages = [
    'https://kmanxvyaluledddvzdxv.supabase.co/storage/v1/object/public/product-images/No.3-(v1).jpg',
    'https://kmanxvyaluledddvzdxv.supabase.co/storage/v1/object/public/product-images/No.3-(v2).jpg'
];

document.addEventListener('DOMContentLoaded', async () => {
    buildCarousel(); // Baut den echten Slider auf
    await loadProductData('beamerhoehle-tshirt-n1');
    updateCartCount();
    renderCartItems();
});

// ==========================================================================
// 2. MODERN CAROUSEL / SLIDER LOGIK
// ==========================================================================
function buildCarousel() {
    const track = document.getElementById('carouselTrack');
    const dotsContainer = document.getElementById('carouselDots');
    if (!track) return;

    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    activeImages.forEach((url, idx) => {
        // Slide Element erstellen
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.innerHTML = `<img src="${url}" alt="Produktansicht ${idx + 1}">`;
        track.appendChild(slide);

        // Dot erstellen
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
    // Update Dots active State
    const dots = document.querySelectorAll('.c-dot');
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentSlideIndex);
    });
}

// ==========================================================================
// 3. PRODUKTDATEN & GRÖSSEN AUS DER DB HOLEN
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
    }

    // Dom-Texte injizieren
    document.getElementById('prodName').innerHTML = currentProduct.name;
    document.getElementById('prodSubtitle').innerText = currentProduct.subtitle;
    document.getElementById('prodPrice').innerText = `€ ${(currentProduct.price_in_cents / 100).toFixed(2).replace('.', ',')}`;

    buildSizes(currentProduct.shirt_variants);
}

function buildSizes(variants) {
    const grid = document.getElementById('sizeGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const fallbackStock = { 'S': 5, 'M': 10, 'L': 15, 'XL': 12, '2XL': 6, '3XL': 3 };
    let finalArray = (variants && variants.length > 0) ? variants : Object.keys(fallbackStock).map(s => ({ size: s, stock: fallbackStock[s] }));

    const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    finalArray.sort((a,b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size));

    finalArray.forEach(variant => {
        const btn = document.createElement('button');
        btn.className = 'size-tile';
        const stock = variant.stock !== undefined ? variant.stock : 5;

        if (stock <= 0) {
            btn.disabled = true;
            btn.innerText = `${variant.size}`;
        } else {
            btn.innerText = variant.size;
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
// 4. QUANTITY & INTERACTION LAYER
// ==========================================================================
function changeQty(mod) {
    currentQty = Math.max(1, currentQty + mod);
    document.getElementById('qtyDisplay').innerText = currentQty;
}

function toggleCart() {
    document.getElementById('cartOverlay').classList.toggle('open');
    document.getElementById('cartPanel').classList.toggle('open');

    if (document.getElementById('cartPanel').classList.contains('open')) {
        showView('viewItems');
    }
}

function showView(viewId) {
    document.querySelectorAll('.drawer-view').forEach(view => {
        view.classList.remove('active');
    });

    document.getElementById(viewId).classList.add('active');

    const checkoutOptions = document.getElementById('checkoutOptions');

    if (viewId === 'viewItems' && cart.length > 0) {
        checkoutOptions.style.display = 'grid';
    } else {
        checkoutOptions.style.display = 'none';
    }
}

function addToCart() {
    if (!selectedSize) {
        document.getElementById('sizeError').classList.add('show');
        return;
    }
    const item = {
        id: currentProduct.id,
        name: currentProduct.name,
        size: selectedSize,
        price: currentProduct.price_in_cents,
        qty: currentQty,
        image: activeImages[0]
    };

    const findIdx = cart.findIndex(c => c.id === item.id && c.size === item.size);
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
    }

    box.innerHTML = '';
    cart.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.image}">
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
                    <span style="font-weight:600;">€ ${((item.price * item.qty)/100).toFixed(2).replace('.', ',')}</span>
                </div>
                <button class="del-btn" onclick="killCartItem(${idx})">Entfernen</button>
            </div>
        `;
        box.appendChild(div);
    });

    let data = getTotals();
    const costRow = document.createElement('div');
    costRow.style = "display:flex; justify-content:space-between; margin-top:1.5rem; padding-top:1rem; border-top:1px dashed var(--border-color); font-size:0.85rem; color:var(--text-muted);";
    if (currentDeliveryMethod === 'pickup') {
        costRow.innerHTML = `<span>Option:</span><span>🏪 Selbstabholung</span>`;
    } else {
        costRow.innerHTML = `<span>Versandkosten:</span><span>${data.shipping > 0 ? '€ 2,99' : '<span style="color:var(--success-green);">Kostenlos</span>'}</span>`;
    }
    box.appendChild(costRow);

    totalField.innerText = `€ ${(data.grand / 100).toFixed(2).replace('.', ',')}`;
if (document.getElementById('viewItems').classList.contains('active')) {
    document.getElementById('checkoutOptions').style.display = 'grid';
}
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
// 6. MODERN CHECKOUT CONTROLLER
// ==========================================================================
function startCheckout(method) {
    currentDeliveryMethod = method;
    renderCartItems();
    
    const adr = document.getElementById('shippingAddressFields');
    const pick = document.getElementById('pickupPaymentSelect');
    const subBtn = document.getElementById('standardSubmitBtn');
    const title = document.getElementById('checkoutTitle');

    if (method === 'shipping') {
        title.innerText = "Lieferadresse";
        adr.style.display = "block";
        pick.style.display = "none";
        subBtn.innerText = "Zu PayPal & Bestellen";
    } else {
        title.innerText = "Abholer-Details";
        adr.style.display = "none";
        pick.style.display = "block";
        updatePickupPaymentNote();
    }
    showView('viewCheckout');
}

function updatePickupPaymentNote() {
    const subBtn = document.getElementById('standardSubmitBtn');
    const note = document.getElementById('paymentNote');
    const value = document.querySelector('input[name="pickupPayment"]:checked').value;

    if (value === 'PayPal') {
        subBtn.innerText = "Zu PayPal & Bestellen";
        note.innerText = "Zahlung erfolgt direkt via PayPal.me.";
    } else {
        subBtn.innerText = "Verbindlich Reservieren";
        note.innerText = "Bezahlung erfolgt bar bei Abholung.";
    }
}

function validateForm() {
    let ok = true;
    const f = (id) => document.getElementById(id).value.trim();
    const err = (id, show) => document.getElementById(id).classList.toggle('show', show);

    if (!f('custFirst')) { err('custFirstErr', true); ok = false; } else { err('custFirstErr', false); }
    if (!f('custLast')) { err('custLastErr', true); ok = false; } else { err('custLastErr', false); }
    if (!f('custEmail') || !f('custEmail').includes('@')) { err('custEmailErr', true); ok = false; } else { err('custEmailErr', false); }

    if (currentDeliveryMethod === 'shipping') {
        if (!f('custStreet')) { err('custStreetErr', true); ok = false; } else { err('custStreetErr', false); }
        if (!f('custZip')) { err('custZipErr', true); ok = false; } else { err('custZipErr', false); }
        if (!f('custCity')) { err('custCityErr', true); ok = false; } else { err('custCityErr', false); }
    }
    return ok;
}

async function submitOrder() {
    if (!validateForm()) return;
    let calculations = getTotals();

    let payMethod = 'Bar';
    if (currentDeliveryMethod === 'shipping') {
        payMethod = 'PayPal';
    } else {
        payMethod = document.querySelector('input[name="pickupPayment"]:checked').value;
    }

    let isPayPal = (payMethod === 'PayPal');
    let finalSizes = cart.map(i => `${i.size} (${i.qty}x)`).join(', ');
    let finalQty = cart.reduce((acc, i) => acc + i.qty, 0);

    const dataPayload = {
        first_name: document.getElementById('custFirst').value.trim(),
        last_name: document.getElementById('custLast').value.trim(),
        email: document.getElementById('custEmail').value.trim(),
        delivery_method: currentDeliveryMethod,
        payment_method: payMethod,
        payment_status: isPayPal ? 'Bezahlt via PayPal' : 'offen',
        total_amount_in_cents: calculations.grand,
        cart_items: cart,
        selected_size: finalSizes,
        total_quantity: finalQty,
        status: 'pending',
        street: currentDeliveryMethod === 'shipping' ? document.getElementById('custStreet').value.trim() : null,
        zip_code: currentDeliveryMethod === 'shipping' ? document.getElementById('custZip').value.trim() : null,
        city: currentDeliveryMethod === 'shipping' ? document.getElementById('custCity').value.trim() : null
    };

    const { error } = await supabaseClient.from('orders').insert([dataPayload]);
    if (error) {
        alert('Datenbankfehler: ' + error.message);
        return;
    }

    let printPrice = (calculations.grand / 100).toFixed(2);
    if (isPayPal) {
        window.open(`https://www.paypal.me/JulianGromadka/${printPrice}`, '_blank');
        document.getElementById('successMsg').innerHTML = `Bestellung übermittelt!<br>Bitte begleiche den Betrag im geöffneten PayPal-Fenster.<br><br><strong>Betrag: € ${printPrice.replace('.', ',')}</strong>`;
    } else {
        document.getElementById('successMsg').innerHTML = `Bestellung für dich reserviert!<br>Bitte bringe den Betrag passend zur Abholung mit.<br><br><strong>Betrag: € ${printPrice.replace('.', ',')}</strong>`;
    }

    cart = [];
    localStorage.removeItem('vaux_cart');
    updateCartCount();
    showView('viewSuccess');
}
