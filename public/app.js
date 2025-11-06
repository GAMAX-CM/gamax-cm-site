let API_BASE = "http://localhost:3000"; // fallback
const FRONTEND_BASE = window.location.origin;
let produits = [];
let cart = JSON.parse(localStorage.getItem('gamax_cart') || "[]");

const productListEl = document.getElementById('productList');
const typeFilterEl = document.getElementById('typeFilter');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const payBtn = document.getElementById('payBtn');

// Configurator
const typeEl = document.getElementById('type');
const largeurEl = document.getElementById('largeur');
const longueurEl = document.getElementById('longueur');
const hauteurEl = document.getElementById('hauteur');
const prixEl = document.getElementById('prix');
const configAddBtn = document.getElementById('configAdd');

// Charger config.json si présent
async function loadConfig(){
  try{
    const res = await fetch('./config.json', { cache: 'no-store' });
    if(res.ok){
      const cfg = await res.json();
      if(cfg.API_BASE){ API_BASE = cfg.API_BASE; }
    }
  }catch(e){ /* ignore */ }
}

// Fetch products from backend
async function loadProducts(){
  const res = await fetch(API_BASE + "/api/products");
  produits = await res.json();
  renderProducts();
}

function renderProducts(list = produits){
  productListEl.innerHTML = "";
  list.forEach(p => {
    const div = document.createElement('div');
    div.className = "product-card";
    div.innerHTML = `
      <img src="${p.image}" alt="${p.name}" onerror="this.style.background='#ddd'; this.src='';">
      <h3>${p.name}</h3>
      <p>Prix : ${p.price}€</p>
      <button data-id="${p.id}">Ajouter au panier</button>
    `;
    div.querySelector('button').addEventListener('click', () => addToCart({id:p.id, name:p.name, price:p.price}));
    productListEl.appendChild(div);
  });
}

typeFilterEl.addEventListener('change', () => {
  const val = typeFilterEl.value;
  if(val === 'all') renderProducts();
  else renderProducts(produits.filter(p => p.type === val));
});

function addToCart(item){
  cart.push({...item, quantity:1});
  persistCart();
  renderCart();
}
function removeFromCart(index){
  cart.splice(index,1);
  persistCart();
  renderCart();
}
function cartTotal(){
  return cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
}
function renderCart(){
  cartItemsEl.innerHTML = "";
  cart.forEach((i, idx) => {
    const row = document.createElement('div');
    row.className = "cart-item";
    row.innerHTML = `${i.name} - ${(i.price).toFixed(0)}€ <button aria-label="Supprimer">X</button>`;
    row.querySelector('button').addEventListener('click', () => removeFromCart(idx));
    cartItemsEl.appendChild(row);
  });
  cartTotalEl.textContent = cartTotal().toFixed(0);
}
function persistCart(){
  localStorage.setItem('gamax_cart', JSON.stringify(cart));
}

// Configurator price calc
function updateConfigPrice(){
  const type = typeEl.value;
  const largeur = parseFloat(largeurEl.value) || 0;
  const longueur = parseFloat(longueurEl.value) || 0;
  const hauteur = parseFloat(hauteurEl.value) || 0;
  const base = type === 'abri' ? 1500 : (type === 'hangar' ? 2800 : 1200);
  const price = base * Math.max(1, (largeur * longueur * hauteur) / 50);
  prixEl.textContent = "Prix estimé : " + price.toFixed(0) + "€";
  return Math.round(price);
}
[typeEl, largeurEl, longueurEl, hauteurEl].forEach(el => el.addEventListener('input', updateConfigPrice));
configAddBtn.addEventListener('click', () => {
  const price = updateConfigPrice();
  const label = typeEl.value.charAt(0).toUpperCase() + typeEl.value.slice(1) + " sur mesure";
  addToCart({id: Date.now(), name: label, price});
});
updateConfigPrice();

// Pay with Stripe Checkout
payBtn.addEventListener('click', async () => {
  if(cart.length === 0){ alert('Votre panier est vide'); return; }
  const res = await fetch(API_BASE + "/api/create-checkout-session", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity || 1 })),
                           success_url: FRONTEND_BASE + "/success.html",
                           cancel_url: FRONTEND_BASE + "/cancel.html" })
  });
  const data = await res.json();
  if(!data.id){ alert('Erreur de paiement'); return; }
  const stripe = Stripe(data.publishableKey);
  stripe.redirectToCheckout({ sessionId: data.id });
});

// Init
(async () => { await loadConfig(); loadProducts(); })();
renderCart();
