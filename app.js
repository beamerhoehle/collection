// 1. SUPABASE INITIALISIERUNG
const SUPABASE_URL = 'https://kmanxvyaluledddvzdxv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttYW54dnlhbHVsZWRkZHZ6ZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjU5NjIsImV4cCI6MjA5NjYwMTk2Mn0.qBCdrzOo4qSbItETomTJ38Fc4gpvE4dMt5L9rYwMKq8';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentProduct = null;
let selectedSize = null;
let currentQty = 1;
let cart = JSON.parse(localStorage.getItem('vaux_cart')) || [];
let activeImages = [];
let currentDeliveryMethod = 'pickup'; // 'pickup' oder 'shipping'

document.addEventListener('DOMContentLoaded', async () => {
    await loadProduct('beamerhoehle-tshirt-n1');
    updateCartCount();
    renderCartItems();
});

// 2. PRODUKTDATEN DYNAMISCH AUS SUPABASE LADEN
async function loadProduct(slug) {
    const { data: product, error } = await supabaseClient
        .from('shirts')
        .select(`*, shirt_variants (*)`)
        .eq('slug', slug)
        .single();

    if (error) {
        document.getElementById('prodName').innerHTML = `FEHLER:<br><span style="color:red;">${error.message}</span>`;
        return;
    }

    currentProduct = product;
    activeImages = product.images || [];

    // Titel befüllen
    document.getElementById('prodName').innerHTML = product.name.replace(/ /g, '<br>');
    document.getElementById('prodSubtitle').innerText = product.subtitle || '';
    document.getElementById('prodPrice').innerText = `€ ${(product.price_in_cents / 100).toFixed(2).replace('.', ',')}`;

    setupGallery();
    renderSizeGrid(product.shirt_variants);
}

// 3. IMAGES-GALLERY LOGIK
function setupGallery() {
    const mainImg = document.getElementById('mainImg');
    const thumbStrip = document.getElementById('thumbStrip');
    const thumbDots = document.getElementById('thumbDots');
    
    if (!activeImages.length) return;
    
    mainImg.src = activeImages[0];
    thumbStrip.innerHTML = ''; 
    thumbDots.innerHTML = '';
    
    activeImages.forEach((imgUrl, index) => {
        const thumb = document.createElement('div');
        thumb.className = `thumb ${index === 0 ? 'active' : ''}`;
        thumb.onclick = () => switchImg(index, thumb);
        thumb.innerHTML = `<img src="${imgUrl}">`;
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
    document.querySelectorAll('.thumb').forEach((t, i) => t.classList.toggle('active', i === index));
    document.querySelectorAll('.thumb-dot').forEach((d, i) => d.classList.toggle('active', i === index));
}

// 4. GRÖSSEN GENERIEREN & NEU SORTIEREN (Mit genauer Lagerbestandsanzeige)
function renderSizeGrid(variants) {
    const sizeGrid = document.getElementById('sizeGrid');
    sizeGrid.innerHTML = '';
    
    // Reihenfolge-Schema für korrekte Sortierung im Frontend
    const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    variants.sort((a, b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size));
    
    variants.forEach(variant => {
        const btn = document.createElement('button');
        btn.className = 'size-btn';
        
        // Nutzt den echten Stock aus der DB. Falls dieser noch nicht stimmt, 
        // greift das Fallback-Objekt mit deinen exakten Werten gr_stock:
        const staticStock = { 'S': 1, 'M': 8, 'L': 19, 'XL': 10, '2XL': 8, '3XL': 4 };
        const currentStock = (variant.stock !== undefined && variant.stock !== null) ? variant.stock : (staticStock[variant.size] || 0);

        // Text für den Button generieren (z.B. "M (8 Stk.)")
        if (currentStock <= 0) {
            btn.disabled = true;
            btn.style.opacity = '0.3';
            btn.innerText = `${variant.size} (Ausv.)`;
        } else {
            btn.innerText = `${variant.size} (${currentStock} Stk.)`;
            
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

// 5. BASICS
function changeQty(change) { currentQty = Math.max(1, currentQty + change); document.getElementById('qtyDisplay').innerText = currentQty; }
function toggleCart() { document.getElementById('cartOverlay').classList.toggle('open'); document.getElementById('cartPanel').classList.toggle('open'); }

function showView(viewId) {
    document.querySelectorAll('.cart-body .view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.getElementById('checkoutOptions').style.display = (viewId === 'viewItems' && cart.length > 0) ? 'grid' : 'none';
}

function addToCart() {
    if (!selectedSize) { document.getElementById('sizeError').classList.add('show'); return; }
    const cartItem = { id: currentProduct.id, name: currentProduct.name, size: selectedSize, price: currentProduct.price_in_cents, qty: currentQty, image: activeImages[0] };
    const idx = cart.findIndex(i => i.id === cartItem.id && i.size === cartItem.size);
    if (idx > -1) { cart[idx].qty += currentQty; } else { cart.push(cartItem); }
    saveCart(); toggleCart();
}

function saveCart() { localStorage.setItem('vaux_cart', JSON.stringify(cart)); updateCartCount(); renderCartItems(); }
function updateCartCount() { document.getElementById('cartCount').innerText = cart.reduce((t, i) => t + i.qty, 0); }

// 6. VERSANDKOSTEN-BERECHNUNG
function calculateTotals() {
    let pTotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let totalItems = cart.reduce((s, i) => s + i.qty, 0);
    let sCost = (currentDeliveryMethod === 'shipping' && totalItems < 2) ? 299 : 0;
    return { grandTotal: pTotal + sCost, shippingCost: sCost };
}

function renderCartItems() {
    const container = document.getElementById('cartItemsContainer');
    const totalDisplay = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        container.innerHTML = `<div class="cart-empty"><strong>Leergut.</strong>Dein Warenkorb ist leer.</div>`;
        totalDisplay.innerText = '€ 0,00';
        return;
    }
    
    container.innerHTML = '';
    cart.forEach((item, index) => {
        const itemEl = document.createElement('div'); itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <img src="${item.image}" class="cart-item-img">
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
                <button class="remove-item-btn" onclick="removeItem(${index})">Entfernen</button>
            </div>`;
        container.appendChild(itemEl);
    });
    
    let totals = calculateTotals();
    const shippingEl = document.createElement('div');
    shippingEl.style = "display:flex; justify-content:space-between; padding:0.5rem 0; font-size:0.9rem; color:#555; border-top:1px dashed #222; margin-top:1rem;";
    
    if (currentDeliveryMethod === 'pickup') {
        shippingEl.innerHTML = `<span>Versandart:</span><span>🏪 Selbstabholung</span>`;
    } else {
        shippingEl.innerHTML = `<span>Versandkosten:</span><span>${totals.shippingCost > 0 ? '€ 2,99' : '<span style="color:#00ff66;">Kostenlos</span>'}</span>`;
    }
    container.appendChild(shippingEl);
    totalDisplay.innerText = `€ ${(totals.grandTotal / 100).toFixed(2).replace('.', ',')}`;
}

function updateQty(index, change) { cart[index].qty += change; if (cart[index].qty <= 0) { cart.splice(index, 1); } saveCart(); }
function removeItem(index) { cart.splice(index, 1); saveCart(); }

function startCheckout(method) {
    currentDeliveryMethod = method;
    renderCartItems();
    
    const addrFields = document.getElementById('shippingAddressFields');
    const submitBtn = document.getElementById('standardSubmitBtn');
    const payNote = document.getElementById('paymentNote');
    const title = document.getElementById('checkoutTitle');
    
    if (method === 'shipping') {
        title.innerText = "Lieferadresse";
        addrFields.style.display = "block";
        submitBtn.innerText = "Zu PayPal & Bestellen";
        payNote.innerText = "Sichere Zahlungsweiterleitung über PayPal.me.";
    } else {
        title.innerText = "Abholerdetails";
        addrFields.style.display = "none";
        submitBtn.innerText = "Verbindlich Bestellen (Bar)";
        payNote.innerText = "Bezahlung erfolgt bar bei Abholung vor Ort.";
    }
    showView('viewCheckout');
}

function validateForm() {
    const first = document.getElementById('custFirst').value.trim();
    const last = document.getElementById('custLast').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    let valid = true;
    
    if (!first) { document.getElementById('custFirstErr').classList.add('show'); valid = false; } else { document.getElementById('custFirstErr').classList.remove('show'); }
    if (!last) { document.getElementById('custLastErr').classList.add('show'); valid = false; } else { document.getElementById('custLastErr').classList.remove('show'); }
    if (!email || !email.includes('@')) { document.getElementById('custEmailErr').classList.add('show'); valid = false; } else { document.getElementById('custEmailErr').classList.remove('show'); }
    
    if (currentDeliveryMethod === 'shipping') {
        const street = document.getElementById('custStreet').value.trim();
        const zip = document.getElementById('custZip').value.trim();
        const city = document.getElementById('custCity').value.trim();
        if (!street) { document.getElementById('custStreetErr').classList.add('show'); valid = false; } else { document.getElementById('custStreetErr').classList.remove('show'); }
        if (!zip) { document.getElementById('custZipErr').classList.add('show'); valid = false; } else { document.getElementById('custZipErr').classList.remove('show'); }
        if (!city) { document.getElementById('custCityErr').classList.add('show'); valid = false; } else { document.getElementById('custCityErr').classList.remove('show'); }
    }
    return valid;
}

// 7. BESTELLUNG VERARBEITEN & PAYPAL-LINK ÖFFNEN
async function submitOrder() {
    if (!validateForm()) return false;
    
    let totals = calculateTotals();
    let isPayPal = (currentDeliveryMethod === 'shipping');
    
    const orderData = {
        first_name: document.getElementById('custFirst').value.trim(),
        last_name: document.getElementById('custLast').value.trim(),
        email: document.getElementById('custEmail').value.trim(),
        delivery_method: currentDeliveryMethod,
        payment_method: isPayPal ? 'PayPal' : 'Bar',
        total_amount_in_cents: totals.grandTotal,
        cart_items: cart,
        status: 'pending',
        street: isPayPal ? document.getElementById('custStreet').value.trim() : null,
        zip_code: isPayPal ? document.getElementById('custZip').value.trim() : null,
        city: isPayPal ? document.getElementById('custCity').value.trim() : null
    };

    const { error } = await supabaseClient.from('orders').insert([orderData]);
    if (error) { alert('Fehler beim Absenden.'); console.error(error); return false; }
    
    let formattedPrice = (totals.grandTotal / 100).toFixed(2);

    if (isPayPal) {
        // Öffnet PayPal.me direkt mit dem korrekten Euro-Zahlungsbetrag für Julian Gromadka
        window.open(`https://www.paypal.me/JulianGromadka/${formattedPrice}`, '_blank');
        document.getElementById('successMsg').innerHTML = `Deine Bestellung wurde registriert!<br>Bitte schließe die Zahlung über das geöffnete PayPal-Fenster ab.<br><br><b>Betrag: € ${formattedPrice.replace('.', ',')}</b>`;
    } else {
        document.getElementById('successMsg').innerHTML = `Deine Bestellung liegt für dich bereit!<br>Bitte halte den Betrag bei Abholung bereit.<br><br><b>Betrag: € ${formattedPrice.replace('.', ',')}</b>`;
    }

    cart = []; 
    localStorage.removeItem('vaux_cart');
    updateCartCount();
    showView('viewSuccess');
    return true;
}
