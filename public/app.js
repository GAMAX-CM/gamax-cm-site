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

// Récap devis (section RÉCAPITULATIF + VUE 3D)
const recapDevisEl = document.getElementById('recapDevis');

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
  if(!productListEl) return;
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
    div.querySelector('button').addEventListener('click', () =>
      addToCart({id:p.id, name:p.name, price:p.price})
    );
    productListEl.appendChild(div);
  });
}

if(typeFilterEl){
  typeFilterEl.addEventListener('change', () => {
    const val = typeFilterEl.value;
    if(val === 'all') renderProducts();
    else renderProducts(produits.filter(p => p.type === val));
  });
}

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
  if(!cartItemsEl) return;
  cartItemsEl.innerHTML = "";
  cart.forEach((i, idx) => {
    const row = document.createElement('div');
    row.className = "cart-item";
    row.innerHTML = `${i.name} - ${(i.price).toFixed(0)}€ <button aria-label="Supprimer">X</button>`;
    row.querySelector('button').addEventListener('click', () => removeFromCart(idx));
    cartItemsEl.appendChild(row);
  });
  if(cartTotalEl){
    cartTotalEl.textContent = cartTotal().toFixed(0);
  }
  // Met à jour le devis après modification du panier
  updateRecapDevis();
}
function persistCart(){
  localStorage.setItem('gamax_cart', JSON.stringify(cart));
}

/* ========= CONFIGURATEUR : PRIX + TEXTE DE DEVIS ========= */

// Calcule un prix estimatif en fonction du type + dimensions
function updateConfigPrice(){
  if(!typeEl || !largeurEl || !longueurEl || !hauteurEl || !prixEl){
    return 0;
  }
  const type = typeEl.value;
  const largeur = parseFloat(largeurEl.value) || 0;
  const longueur = parseFloat(longueurEl.value) || 0;
  const hauteur = parseFloat(hauteurEl.value) || 0;

  const base = type === 'abri'
    ? 1500
    : (type === 'hangar'
      ? 2800
      : 1200);

  const price = base * Math.max(1, (largeur * longueur * hauteur) / 50);
  prixEl.textContent = "Prix estimé : " + price.toFixed(0) + "€";

  // À chaque recalcul de prix, on met à jour le devis
  updateRecapDevis(price);

  return Math.round(price);
}

// Construit le texte du devis à partir du configurateur + panier
function buildDevisText(currentPrice){
  if(!typeEl) return "";

  const typeLabel = typeEl.options && typeEl.selectedIndex >= 0
    ? typeEl.options[typeEl.selectedIndex].textContent
    : typeEl.value;

  const largeur = largeurEl ? (largeurEl.value || "-") : "-";
  const longueur = longueurEl ? (longueurEl.value || "-") : "-";
  const hauteur = hauteurEl ? (hauteurEl.value || "-") : "-";

  const prixEstime = typeof currentPrice === "number"
    ? currentPrice
    : cartTotal() || 0;

  let texte = "Devis abri métallique GAMAX-CM\n\n";

  texte += `Type d'abri : ${typeLabel || "Non renseigné"}\n`;
  texte += `Dimensions : ${largeur} m x ${longueur} m, hauteur ${hauteur} m\n\n`;

  if(cart.length > 0){
    texte += "Détail du panier :\n";
    cart.forEach(i => {
      texte += `- ${i.name} : ${i.price.toFixed(0)} €\n`;
    });
    texte += `\nTotal estimé panier : ${cartTotal().toFixed(0)} €\n\n`;
  }

  if(prixEstime){
    texte += `Prix estimé configurateur : ${prixEstime.toFixed(0)} € TTC\n`;
  }

  texte += "\nCe devis est une estimation indicative. Un devis définitif vous sera transmis par GAMAX-CM.\n";

  return texte;
}

// Met à jour l’affichage du devis + stockage localStorage
function updateRecapDevis(forcedPrice){
  if(!recapDevisEl) return;
  const devisTexte = buildDevisText(forcedPrice);
  recapDevisEl.textContent = devisTexte;
  localStorage.setItem("gamax_abri_devis_texte", devisTexte);
}

// Écouteurs du configurateur
if(typeEl && largeurEl && longueurEl && hauteurEl){
  [typeEl, largeurEl, longueurEl, hauteurEl].forEach(el =>
    el.addEventListener('input', () => {
      const price = updateConfigPrice();
      // updateConfigPrice appelle déjà updateRecapDevis
      return price;
    })
  );
}

// Ajout de l’abri configuré au panier
if(configAddBtn){
  configAddBtn.addEventListener('click', () => {
    const price = updateConfigPrice();
    const typeVal = typeEl ? typeEl.value : "abri";
    const labelType = typeEl && typeEl.options && typeEl.selectedIndex >= 0
      ? typeEl.options[typeEl.selectedIndex].textContent
      : (typeVal.charAt(0).toUpperCase() + typeVal.slice(1));

    const label = labelType + " sur mesure";
    addToCart({id: Date.now(), name: label, price});
    // Le renderCart → updateRecapDevis est déjà appelé
  });
}

// Initialisation prix + devis au chargement
updateConfigPrice();

/* ========= STRIPE : PAYEMENT PANIER ========= */

if(payBtn){
  payBtn.addEventListener('click', async () => {
    if(cart.length === 0){ alert('Votre panier est vide'); return; }
    const res = await fetch(API_BASE + "/api/create-checkout-session", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        items: cart.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity || 1
        })),
        success_url: FRONTEND_BASE + "/success.html",
        cancel_url: FRONTEND_BASE + "/cancel.html"
      })
    });
    const data = await res.json();
    if(!data.id){ alert('Erreur de paiement'); return; }
    const stripe = Stripe(data.publishableKey);
    stripe.redirectToCheckout({ sessionId: data.id });
  });
}

/* ========= LIEN VERS LA PAGE COMMANDE ========= */

function goToOrderPage(){
  // On s'assure que le devis est bien à jour dans le localStorage
  updateRecapDevis();
  window.location.href = "commander.html";
}

// Init
(async () => {
  await loadConfig();
  loadProducts();
})();
renderCart();
