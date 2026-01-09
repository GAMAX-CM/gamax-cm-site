/* =========================================================
   GAMAX-CM — CONFIGURATEUR + RÉCAP + VUE 3D (THREE r146)
   Fichier : public/app.js

   ✅ Version complète + rendu PRO des profilés :
   - Profilé SIGMA 170 (ép. 2 mm galvanisé) en 3D (tôle pliée)
   - Masquage "chirurgical" des pièces GLTF de toiture/pannes (sans cacher les poteaux)
   - Toiture/bardage calculés en overlay (pente 10% constante)

   ✅ PATCH 3D COHÉRENTE (mono + bi) :
   - GLTF en DoubleSide (évite les faces invisibles)
   - Overlays stables (depthWrite:false + polygonOffset) => fini les “trous”
   - Masquage toiture/pannes sécurisé (évite de cacher la charpente)
   - renderOrder overlays au-dessus de la structure

   ✅ NOUVEAUTÉ : CONFIG CENTRALE
   - buildConfigFromUI() = une seule vérité (type, dimensions, bardage, couleurs, options, livraison)
   - Prix + récap + 3D lisent tous cette même config
========================================================= */

/* ---------------------------
   1) DONNÉES CONFIGURATEUR
---------------------------- */

const DIMENSIONS = {
  mono: {
    widths: [3, 4, 5, 6],
    lengths: [3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 24, 25, 30],
    heights: [2.15, 3.5],
  },
  bi: {
    widths: [4, 5, 6, 7, 8, 10, 12],
    lengths: [3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 24, 25, 30],
    heights: [3],
  },
};

const FACADE_LABELS = {
  A: "Façade A – Long pan avant",
  B: "Façade B – Pignon gauche",
  C: "Façade C – Long pan arrière",
  D: "Façade D – Pignon droit",
};

const ROOF_TYPE_LABELS = {
  bac_simple: "Bac acier simple",
  bac_regul: "Bac acier avec régulateur de condensation",
  sandwich40: "Panneau sandwich ép. 40 mm",
};

const CLADDING_TYPE_LABELS = {
  bac_simple: "Bac acier simple",
  sandwich40: "Panneau sandwich ép. 40 mm",
};

// ---- TARIFS STRUCTURE PAR DIMENSION ----
const STRUCTURE_PRICE_TABLE = {
  mono: {
    "3x3": 740, "3x4": 790, "3x5": 840, "3x6": 890,
    "3x8": 1360, "3x10": 1460, "3x12": 1560, "3x15": 2050,
    "3x18": 2190, "3x20": 2630, "3x24": 2830, "3x25": 3220, "3x30": 3470,

    "4x3": 780, "4x4": 830, "4x5": 880, "4x6": 930,
    "4x8": 1410, "4x10": 1510, "4x12": 1610, "4x15": 2130,
    "4x18": 2270, "4x20": 2730, "4x24": 2920, "4x25": 3340, "4x30": 3580,

    "5x3": 900, "5x4": 980, "5x5": 1060, "5x6": 1150,
    "5x8": 1470, "5x10": 1570, "5x12": 1670, "5x15": 2190,
    "5x18": 2340, "5x20": 2810, "5x24": 3000, "5x25": 3440, "5x30": 3680,

    "6x3": 950, "6x4": 1030, "6x5": 1110, "6x6": 1190,
    "6x8": 1560, "6x10": 1660, "6x12": 1750, "6x15": 2330,
    "6x18": 2480, "6x20": 2980, "6x24": 3180, "6x25": 3640, "6x30": 3880,
  },
  bi: {
    // (à compléter plus tard)
  },
};

// ---- PRIX COUVERTURE & BARDAGE (€/m²) ----
const ROOF_PRICE_PER_M2 = {
  bac_simple: 15.34,
  bac_regul: 17.35,
  sandwich40: 37.95,
};

const CLADDING_PRICE_PER_M2 = {
  bac_simple: 13.09,
  sandwich40: 36.0,
};

const OPTIONS_PRICES = {
  finishingPerM2: 8,
  installPerM2: 35,
};

const TVA_RATE = 0.2;

/* ---------------------------
   2) HELPERS UI
---------------------------- */

function $(id) { return document.getElementById(id); }

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getSelectedType() {
  const input = document.querySelector('input[name="slopeType"]:checked');
  return input ? input.value : "mono";
}

function getDeliveryMode() {
  const input = document.querySelector('input[name="deliveryMode"]:checked');
  return input ? input.value : "livraison";
}

function populateSelect(selectEl, values) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = "";

  values.forEach((val) => {
    const opt = document.createElement("option");
    opt.value = String(val);
    opt.textContent = String(val).replace(".", ",") + " m";
    selectEl.appendChild(opt);
  });

  if (current && values.map(String).includes(current)) selectEl.value = current;
  else if (values.length) selectEl.value = String(values[0]);
}

function populateDimensions() {
  const type = getSelectedType();
  const config = DIMENSIONS[type] || DIMENSIONS.mono;
  populateSelect($("width"), config.widths);
  populateSelect($("length"), config.lengths);
  populateSelect($("height"), config.heights);
}

/* ---------------------------
   2.5) HELPERS RÉCAP (HTML + TEXTE)
---------------------------- */

function L(label) { return `<strong>${label}</strong>`; }
function LINE(label, value) { return `${L(label)} ${value}<br>`; }
function BLANK() { return `<br>`; }
function LINE_TXT(label, value) { return `${label} ${value}\n`; }

/* ---------------------------
   3) LIVRAISON + VILLES
---------------------------- */

function getDeliveryPrice(postalCode) {
  if (!postalCode || postalCode.length !== 5) return 0;
  const dep = parseInt(postalCode.slice(0, 2), 10);
  if (dep === 47) return 150;
  if ([40, 33, 24, 46].includes(dep)) return 250;
  return 350;
}

async function fetchCitiesFromAPI(postalCode) {
  if (!postalCode || postalCode.length !== 5) return [];
  try {
    const response = await fetch("https://apicarto.ign.fr/api/codes-postaux/communes/" + postalCode);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((item) => item.nomCommune);
  } catch {
    return [];
  }
}

async function updateCityOptions() {
  const mode = getDeliveryMode();
  const cpEl = $("postalCode");
  const select = $("city");
  if (!select) return;

  if (mode === "retrait") {
    select.innerHTML = "<option value=''>Retrait à Tonneins</option>";
    select.value = "";
    return;
  }

  const cp = (cpEl?.value || "").trim();
  select.innerHTML = "";

  if (cp.length !== 5) {
    select.innerHTML = "<option value=''>Sélectionnez votre ville après saisie du code postal</option>";
    return;
  }

  const cities = await fetchCitiesFromAPI(cp);
  if (cities.length === 0) {
    select.innerHTML = "<option value=''>Aucune ville trouvée</option>";
    return;
  }

  cities.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });

  if (cities.length === 1) select.value = cities[0];
}

function updateDeliveryUI() {
  const mode = getDeliveryMode();
  const cpEl = $("postalCode");
  const cityEl = $("city");

  const disabled = mode === "retrait";
  if (cpEl) {
    cpEl.disabled = disabled;
    if (disabled) cpEl.value = "";
  }
  if (cityEl) {
    cityEl.disabled = disabled;
    if (disabled) {
      cityEl.innerHTML = "<option value=''>Retrait à Tonneins</option>";
      cityEl.value = "";
    }
  }
}

/* ---------------------------
   3.5) OPTIONS — CÔTÉS (Rive / Grande rive)
---------------------------- */

function isChecked(id) { return !!$(id)?.checked; }
function setChecked(id, v) { const el = $(id); if (el) el.checked = !!v; }

function anySideChecked(sideIds) {
  return sideIds.some((sid) => isChecked(sid));
}

function syncMainWithSides(mainId, sideIds) {
  const main = $(mainId);
  if (!main) return;
  main.checked = anySideChecked(sideIds);
}

function ensureSidesIfMainChecked(mainId, sideIds) {
  const main = $(mainId);
  if (!main) return;

  if (main.checked && !anySideChecked(sideIds)) {
    sideIds.forEach((sid) => setChecked(sid, true));
  }
  if (!main.checked) {
    sideIds.forEach((sid) => setChecked(sid, false));
  }
}

function setupSideOption(mainId, sideBId, sideDId) {
  const main = $(mainId);
  const sideB = $(sideBId);
  const sideD = $(sideDId);
  if (!main || !sideB || !sideD) return;

  main.addEventListener("change", () => {
    ensureSidesIfMainChecked(mainId, [sideBId, sideDId]);
    calculatePriceAndRecap();
    update3DFromConfig();
  });

  [sideB, sideD].forEach((sideEl) => {
    sideEl.addEventListener("change", () => {
      syncMainWithSides(mainId, [sideBId, sideDId]);
      ensureSidesIfMainChecked(mainId, [sideBId, sideDId]);
      calculatePriceAndRecap();
      update3DFromConfig();
    });
  });

  syncMainWithSides(mainId, [sideBId, sideDId]);
}

function enforceMutualExclusivePerSide() {
  const grB = $("optGrandeRiveB");
  const grD = $("optGrandeRiveD");
  const rsB = $("optRiveSolinB");
  const rsD = $("optRiveSolinD");
  if (!grB || !grD || !rsB || !rsD) return;

  function apply() {
    if (grB.checked) { rsB.checked = false; rsB.disabled = true; } else { rsB.disabled = false; }
    if (grD.checked) { rsD.checked = false; rsD.disabled = true; } else { rsD.disabled = false; }

    if (rsB.checked) { grB.checked = false; grB.disabled = true; } else { grB.disabled = false; }
    if (rsD.checked) { grD.checked = false; grD.disabled = true; } else { grD.disabled = false; }

    syncMainWithSides("optGrandeRive", ["optGrandeRiveB", "optGrandeRiveD"]);
    syncMainWithSides("optRiveSolin",  ["optRiveSolinB",  "optRiveSolinD"]);
  }

  [grB, grD, rsB, rsD].forEach((el) => el.addEventListener("change", apply));
  apply();
}

function applyOptionAvailabilityByType() {
  const type = getSelectedType();
  const optFaitiereDouble = $("optFaitiereDouble");
  const optFaitiereSimple = $("optFaitiereSimple");
  const optFaitiereSolin  = $("optFaitiereSolin");

  if (type === "mono") {
    if (optFaitiereDouble) { optFaitiereDouble.checked = false; optFaitiereDouble.disabled = true; }
    if (optFaitiereSimple) optFaitiereSimple.disabled = false;
    if (optFaitiereSolin)  optFaitiereSolin.disabled = false;
  } else {
    if (optFaitiereDouble) optFaitiereDouble.disabled = false;
    if (optFaitiereSimple) { optFaitiereSimple.checked = false; optFaitiereSimple.disabled = true; }
    if (optFaitiereSolin)  { optFaitiereSolin.checked  = false; optFaitiereSolin.disabled  = true; }
  }
}

/* ---------------------------
   4) CONFIG CENTRALE + CALCUL PRIX + RÉCAP
---------------------------- */

/**
 * buildConfigFromUI
 * Une seule vérité pour :
 * - type / dimensions / surface / nb de travées
 * - couverture / bardage / couleurs
 * - options d’habillage
 * - livraison
 */
function buildConfigFromUI() {
  const type = getSelectedType();

  const width = parseFloat($("width")?.value || "0");
  const length = parseFloat($("length")?.value || "0");
  const height = parseFloat($("height")?.value || "0");
  const area = (width && length) ? width * length : 0;

  const roofType = document.querySelector('input[name="roofType"]:checked')?.value || null;
  const claddingType = document.querySelector('input[name="claddingType"]:checked')?.value || null;

  const claddingSideInputs = document.querySelectorAll('input[name="claddingSide"]:checked');
  const claddings = Array.from(claddingSideInputs).map((el) => el.value);

  const roofColor = document.querySelector('input[name="roofColor"]:checked')?.value || "Non précisée";
  const claddingColor = document.querySelector('input[name="claddingColor"]:checked')?.value || "Non précisée";
  const trimColor = document.querySelector('input[name="trimColor"]:checked')?.value || "Non précisée";

  const deliveryMode = getDeliveryMode();
  const postalCode = ($("postalCode")?.value || "").trim();
  const city = $("city")?.value || "";

  const optInstall        = !!$("optInstall")?.checked;
  const optAngles         = !!$("optAngles")?.checked;
  const optRejetEau       = !!$("optRejetEau")?.checked;
  const optFaitiereDouble = !!$("optFaitiereDouble")?.checked;
  const optFaitiereSimple = !!$("optFaitiereSimple")?.checked;
  const optFaitiereSolin  = !!$("optFaitiereSolin")?.checked;
  const optGrandeRive     = !!$("optGrandeRive")?.checked;
  const optRiveSolin      = !!$("optRiveSolin")?.checked;
  const grB = !!$("optGrandeRiveB")?.checked;
  const grD = !!$("optGrandeRiveD")?.checked;
  const rsB = !!$("optRiveSolinB")?.checked;
  const rsD = !!$("optRiveSolinD")?.checked;

  const bays = getBayCount(length);

  return {
    type,
    width,
    length,
    height,
    area,
    bays,

    roofType,
    claddingType,
    claddings,

    roofColor,
    claddingColor,
    trimColor,

    deliveryMode,
    postalCode,
    city,

    options: {
      install: optInstall,
      angles: optAngles,
      rejetEau: optRejetEau,
      faitiereDouble: optFaitiereDouble,
      faitiereSimple: optFaitiereSimple,
      faitiereSolin: optFaitiereSolin,
      grandeRive: optGrandeRive,
      riveSolin: optRiveSolin,
      grandeRiveB: grB,
      grandeRiveD: grD,
      riveSolinB: rsB,
      riveSolinD: rsD,
    },
  };
}

function calculatePriceAndRecap() {
  const cfg = buildConfigFromUI();
  const {
    type,
    width,
    length,
    height,
    area,
    claddings,
    roofType,
    claddingType,
    roofColor,
    claddingColor,
    trimColor,
    deliveryMode,
    postalCode,
    city,
    options,
  } = cfg;

  if (!width || !length || !height) return;

  const sizeKey = width + "x" + length;
  let structureBase = STRUCTURE_PRICE_TABLE[type]?.[sizeKey] ?? 0;

  if (height > 3) {
    const extra = height - 3;
    const steps = extra / 0.5;
    structureBase *= 1 + steps * 0.1;
  }

  const roofUnit = ROOF_PRICE_PER_M2[roofType] ?? 0;
  const roofCost = area * roofUnit;

  let claddingArea = 0;
  claddings.forEach((code) => {
    if (code === "A" || code === "C") claddingArea += length * height;
    else claddingArea += width * height;
  });

  const cladUnit = CLADDING_PRICE_PER_M2[claddingType] ?? 0;
  const claddingCost = claddingArea * cladUnit;

  const finishingSelected =
    options.riveSolin ||
    options.grandeRive ||
    options.angles ||
    options.rejetEau ||
    options.faitiereDouble ||
    options.faitiereSimple ||
    options.faitiereSolin;

  let optionsPrice = 0;
  if (finishingSelected) optionsPrice += area * OPTIONS_PRICES.finishingPerM2;
  if (options.install) optionsPrice += area * OPTIONS_PRICES.installPerM2;

  const delivery = (deliveryMode === "retrait") ? 0 : getDeliveryPrice(postalCode);

  let totalHT = structureBase + roofCost + claddingCost + optionsPrice + delivery;
  totalHT = Math.round(totalHT / 50) * 50;
  const totalTTC = Math.round((totalHT * (1 + TVA_RATE)) / 10) * 10;

  const typeLabel = (type === "bi") ? "Abris bipente" : "Abris monopente";

  const claddingCount = claddings.length;
  let claddingAreaText = "";
  if (claddingCount === 0) {
    claddingAreaText = "Abris ouvert (sans bardage)";
  } else {
    const sides = claddings.map((code) => FACADE_LABELS[code] || ("Façade " + code));
    claddingAreaText =
      claddingCount + " façade(s) bardée(s) : " +
      sides.join(", ") +
      " (env. " + claddingArea.toFixed(1).replace(".", ",") + " m²)";
  }

  const dimTxt =
    String(width).replace(".", ",") + " m x " +
    String(length).replace(".", ",") + " m, hauteur " +
    String(height).replace(".", ",") + " m";

  const roofTxt = ROOF_TYPE_LABELS[roofType] || "Non précisé";
  const cladTxt = CLADDING_TYPE_LABELS[claddingType] || "Non précisé";

  const livTxt =
    (deliveryMode === "retrait")
      ? "0 € HT (retrait)"
      : (delivery ? (formatCurrency(delivery) + " HT") : "À définir");

  let addressText = "";
  if (deliveryMode === "retrait") {
    addressText = "Retrait à l’atelier GAMAX-CM (Tonneins)";
  } else {
    addressText = postalCode ? (postalCode + (city ? (" " + city) : "")) : "Non renseignée";
  }

  const selectedOptions = [];
  if (options.rejetEau) selectedOptions.push("Rejet d’eau");
  if (options.angles) selectedOptions.push("Angles de bardage");

  if (options.grandeRive) {
    const sides = [];
    if (options.grandeRiveB) sides.push("B");
    if (options.grandeRiveD) sides.push("D");
    selectedOptions.push("Grande rive" + (sides.length ? ` (côté ${sides.join("+")})` : ""));
  }

  if (options.riveSolin) {
    const sides = [];
    if (options.riveSolinB) sides.push("B");
    if (options.riveSolinD) sides.push("D");
    selectedOptions.push("Rive avec solin" + (sides.length ? ` (côté ${sides.join("+")})` : ""));
  }

  if (options.faitiereSolin)  selectedOptions.push("Faîtière avec solin");
  if (options.faitiereSimple) selectedOptions.push("Faîtière simple");
  if (options.faitiereDouble) selectedOptions.push("Faîtière double");
  if (options.install)        selectedOptions.push("Pose par nos équipes");

  // ----- HTML -----
  let recapHTML = "";
  recapHTML += `<div style="margin-bottom:10px;">${L("Devis abri métallique")} GAMAX-CM</div>`;
  recapHTML += LINE("Type d'abri :", typeLabel);
  recapHTML += LINE("Dimensions :", dimTxt);
  recapHTML += LINE("Surface :", area.toFixed(1).replace(".", ",") + " m²");
  recapHTML += BLANK();
  recapHTML += LINE("Toiture :", roofTxt);
  recapHTML += LINE("Couleur toiture (RAL) :", roofColor);
  recapHTML += BLANK();
  recapHTML += LINE("Bardage :", cladTxt);
  recapHTML += LINE("Couleur bardage (RAL) :", claddingColor);
  recapHTML += LINE("Façades bardées :", claddingAreaText);
  recapHTML += BLANK();
  recapHTML += LINE("Habillages (RAL) :", trimColor);
  recapHTML += LINE("Mode :", (deliveryMode === "retrait" ? "Retrait à Tonneins" : "Livraison sur chantier"));
  recapHTML += LINE("Adresse :", addressText);
  recapHTML += LINE("Livraison estimative :", livTxt);
  recapHTML += BLANK();
  recapHTML += LINE("Prix estimatif :", `${formatCurrency(totalHT)} HT soit env. ${formatCurrency(totalTTC)} TTC`);
  recapHTML += BLANK();
  recapHTML += LINE("Options :", (selectedOptions.length ? selectedOptions.join(", ") : "Aucune"));
  recapHTML += BLANK();
  recapHTML += `<div style="opacity:.9">${L("Note :")} Ce devis est une estimation indicative. Un devis définitif vous sera transmis par GAMAX-CM.</div>`;

  // ----- TEXTE -----
  let recapText = "Devis abri métallique GAMAX-CM\n\n";
  recapText += LINE_TXT("Type d'abri :", typeLabel);
  recapText += LINE_TXT("Dimensions :", dimTxt);
  recapText += LINE_TXT("Surface :", area.toFixed(1).replace(".", ",") + " m²");
  recapText += "\n";
  recapText += LINE_TXT("Toiture :", roofTxt);
  recapText += LINE_TXT("Couleur toiture (RAL) :", roofColor);
  recapText += "\n";
  recapText += LINE_TXT("Bardage :", cladTxt);
  recapText += LINE_TXT("Couleur bardage (RAL) :", claddingColor);
  recapText += LINE_TXT("Façades bardées :", claddingAreaText);
  recapText += "\n";
  recapText += LINE_TXT("Habillages (RAL) :", trimColor);
  recapText += "\n";
  recapText += LINE_TXT("Mode :", (deliveryMode === "retrait" ? "Retrait à Tonneins" : "Livraison sur chantier"));
  recapText += LINE_TXT("Adresse :", addressText);
  recapText += LINE_TXT("Livraison estimative :", livTxt);
  recapText += "\n";
  recapText += LINE_TXT("Prix estimatif :", `${formatCurrency(totalHT)} HT soit env. ${formatCurrency(totalTTC)} TTC`);
  recapText += "\n";
  recapText += LINE_TXT("Options :", (selectedOptions.length ? selectedOptions.join(", ") : "Aucune"));
  recapText += "\n";
  recapText += "Ce devis est une estimation indicative. Un devis définitif vous sera transmis par GAMAX-CM.\n";

  afficherRecapitulatif(recapHTML, recapText);
  update3DFromConfig(cfg); // ✅ 3D = même config que le devis
}

function afficherRecapitulatif(recapHTML, recapTextForStorage) {
  const el = $("recapDevis");
  if (el) el.innerHTML = recapHTML;

  if (typeof recapTextForStorage === "string") {
    localStorage.setItem("gamax_abri_devis_texte", recapTextForStorage);
  }
  localStorage.setItem("gamax_abri_devis_html", recapHTML);
}

window.goToOrderPage = function goToOrderPage() {
  calculatePriceAndRecap();
  window.location.href = "commander.html";
};

/* ---------------------------
   5) THREE.JS — VUE 3D
---------------------------- */

const ROOF_TEX_PATH = "assets/texture-bac-acier.jpg";
const CLAD_TEX_PATH = "assets/texture-bac-acier.jpg";
const PAVE_TEX_PATH = "assets/texture-pave-gris.jpg";

const MODELS = {
  mono: {
    path: "assets/abri-monopente-3x5m.gltf",
    base: { length: 5, width: 3, height: 2.15 },
  },
  bi: {
    path: "assets/abri-bipente-4x5m.gltf",
    base: { length: 5, width: 4, height: 3 },
  },
};

const GLOBAL_SCALE = 1;

// pente 10% (mono & bi)
const PITCH_RATIO = 0.10;

const ROOF_OPACITY = 0.985;
const CLAD_OPACITY = 0.985;

// épaisseurs
const ROOF_THICKNESS = 0.06;
const CLAD_THICKNESS = 0.032;

// contact / ajustements
const ROOF_GAP = -0.015;
const CLAD_TOP_GAP = 0.010;
const UNDER_ROOF_CLEARANCE = 0.012;

const ORBIT_MIN_POLAR = 0.12 * Math.PI;
const ORBIT_MAX_POLAR = 0.52 * Math.PI;

const SHADOW_ENABLED = true;

let scene, camera, renderer, controls;
let baseModule = null;
let baseBBox = null;
let structureGroup = null;
let overlayGroup = null;

let studioGroup = null;
let groundPlane = null;
let groundDecal = null;
let contactShadow = null;

let roofTex = null;
let cladTex = null;

let lastInlineCanvasHeight = 0;

/* =========================================================
   MASQUAGE "CHIRURGICAL" des pièces GLTF de toiture/pannes
========================================================= */

const HIDE_NAME_RX = /(roof|toit|toiture|cover|sheet|bac|t[ôo]le|panel|panne|purlin|sabliere|sablière|fa[iî]ti[eè]re|ridge|rafter|chevron)/i;
// ✅ sécurité : ne jamais masquer les éléments de structure
const KEEP_NAME_RX = /(poteau|post|column|frame|portique|upright|pillar|leg)/i;

function setStructureUpperVisibility(eaveWorldY, bbox, type) {
  if (!structureGroup) return;

  const tol = 0.06;
  const hideFromY = eaveWorldY - tol;

  const tmpBox = new THREE.Box3();
  const tmpSize = new THREE.Vector3();
  const tmpCenter = new THREE.Vector3();

  const lenX = bbox ? (bbox.max.x - bbox.min.x) : 10;
  const widthZ = bbox ? (bbox.max.z - bbox.min.z) : 6;

  // reset visibilité à chaque rebuild
  structureGroup.traverse((obj) => {
    if (obj && obj.isMesh) obj.visible = true;
  });

  structureGroup.traverse((obj) => {
    if (!obj.isMesh) return;

    tmpBox.setFromObject(obj);
    tmpBox.getSize(tmpSize);
    tmpBox.getCenter(tmpCenter);

    const sizeY = tmpSize.y;
    const sizeX = tmpSize.x;
    const sizeZ = tmpSize.z;
    const centerY = tmpCenter.y;

    const name = String(obj.name || "");
    const matName = String(obj.material?.name || "");

    const isStructuralTall = sizeY > 0.85;

    const nameSuggestsKeep = KEEP_NAME_RX.test(name) || KEEP_NAME_RX.test(matName);

    // heuristique TRÈS stricte (évite de masquer des cadres)
    const looksLikeRoofPieceStrict =
      (sizeY <= 0.18) &&
      (
        sizeX >= Math.min(2.0, lenX * 0.50) ||
        sizeZ >= Math.min(2.0, widthZ * 0.50)
      );

    const nameSuggestsRoof = HIDE_NAME_RX.test(name) || HIDE_NAME_RX.test(matName);
    const isAboveEave = centerY >= hideFromY;
    const veryHighSmall = (centerY >= (eaveWorldY + 0.25)) && (sizeY <= 0.45);

    if (!isStructuralTall && !nameSuggestsKeep) {
      if (nameSuggestsRoof && isAboveEave) {
        obj.visible = false;
        return;
      }
      if (isAboveEave && looksLikeRoofPieceStrict) {
        obj.visible = false;
        return;
      }
      if (veryHighSmall) {
        obj.visible = false;
        return;
      }
    }
  });
}

function createContactShadowTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.10,
    size / 2, size / 2, size * 0.50
  );
  g.addColorStop(0, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = g;
  // ⬇⬇⬇ ICI la correction : 4ème argument = hauteur
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}


function buildStudio() {
  if (!scene) return;

  if (studioGroup) scene.remove(studioGroup);
  studioGroup = new THREE.Group();
  scene.add(studioGroup);

  if (SHADOW_ENABLED) {
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), shadowMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    groundPlane.receiveShadow = true;
    studioGroup.add(groundPlane);
  }

  groundDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
  );
  groundDecal.rotation.x = -Math.PI / 2;
  groundDecal.position.y = -0.002;
  studioGroup.add(groundDecal);

  const radius = 38;
  const height = 22;
  const cyl = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, Math.PI * 0.15, Math.PI * 0.70);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf3eee6,
    roughness: 1,
    metalness: 0,
    side: THREE.BackSide,
  });
  const wall = new THREE.Mesh(cyl, wallMat);
  wall.position.set(0, height * 0.46, -10);
  wall.rotation.y = Math.PI;
  studioGroup.add(wall);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 30),
    new THREE.MeshStandardMaterial({ color: 0xf8f4ee, roughness: 1, metalness: 0 })
  );
  back.position.set(0, 9, -28);
  studioGroup.add(back);
}

/* =========================================================
   PROFILÉ SIGMA 170 (ép. 2mm) — GALVA PRO
========================================================= */

const MM = 0.001;

const SIGMA170 = {
  W: 170 * MM,
  TOP: 34 * MM,
  STEP: 25 * MM,
  MID: 60 * MM,
  H: 56 * MM,
  LIP: 15 * MM,
  T: 2 * MM,
};

function makeGalvaMat() {
  return new THREE.MeshStandardMaterial({
    color: 0xd3d3d3,
    metalness: 0.35,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
}

function createSigma170Beam(lengthX, mat) {
  const g = new THREE.Group();
  const M = mat || makeGalvaMat();

  const { W, TOP, STEP, MID, H, LIP, T } = SIGMA170;
  const halfW = W / 2;
  const halfMID = MID / 2;

  const yTop = 0;
  const yMid = -STEP;
  const yBot = -H;

  const zOuterL = -halfW;
  const zOuterR = +halfW;
  const zTopL2 = zOuterL + TOP;
  const zTopR2 = zOuterR - TOP;
  const zMidL = -halfMID;
  const zMidR = +halfMID;

  const addH = (zCenter, yCenter, widthZ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(lengthX, T, Math.max(T, widthZ)), M);
    m.position.set(0, yCenter, zCenter);
    m.castShadow = SHADOW_ENABLED;
    m.receiveShadow = SHADOW_ENABLED;
    g.add(m);
    return m;
  };

  const addV = (zCenter, yCenter, heightY) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(lengthX, Math.max(T, heightY), T), M);
    m.position.set(0, yCenter, zCenter);
    m.castShadow = SHADOW_ENABLED;
    m.receiveShadow = SHADOW_ENABLED;
    g.add(m);
    return m;
  };

  addH((zOuterL + zTopL2) / 2, yTop, (zTopL2 - zOuterL));
  addH((zTopR2 + zOuterR) / 2, yTop, (zOuterR - zTopR2));

  addV(zTopL2 + T / 2, (yTop + yMid) / 2, (yTop - yMid));
  addH((zTopL2 + zMidL) / 2, yMid, Math.abs(zMidL - zTopL2));

  addV(zTopR2 - T / 2, (yTop + yMid) / 2, (yTop - yMid));
  addH((zMidR + zTopR2) / 2, yMid, Math.abs(zTopR2 - zMidR));

  addH(0, yMid, MID);

  addV(zOuterL + T / 2, (yTop + yBot) / 2, (yTop - yBot));
  addV(zOuterR - T / 2, (yTop + yBot) / 2, (yTop - yBot));

  addH((zOuterL + (zOuterL + LIP)) / 2, yBot, LIP);
  addH(((zOuterR - LIP) + zOuterR) / 2, yBot, LIP);

  return g;
}

function addSigmaBeam(group, { len, x, y, z, rx = 0, ry = 0, rz = 0, mat = null }) {
  const beam = createSigma170Beam(len, mat || makeGalvaMat());
  beam.position.set(x, y, z);
  beam.rotation.set(rx, ry, rz);
  group.add(beam);
  return beam;
}

/* ---------------------------
   Couleurs 3D depuis RAL
---------------------------- */

function getRALColorFromRadio(name) {
  const input = document.querySelector(`input[name="${name}"]:checked`);
  if (!input) return "#666666";
  const box = input.closest(".ral-choice")?.querySelector(".ral-box");
  if (!box) return "#666666";
  return window.getComputedStyle(box).backgroundColor;
}
function getRoofColor3D() { return getRALColorFromRadio("roofColor"); }
function getCladdingColor3D() { return getRALColorFromRadio("claddingColor"); }
function getTrimColor3D() { return getRALColorFromRadio("trimColor"); }

function getCurrentDimensions() {
  // ✅ On lit désormais les dimensions depuis la config centrale
  const cfg = buildConfigFromUI();
  const width = cfg.width || 3;
  const length = cfg.length || 5;
  const height = cfg.height || 2.15;
  return { width, length, height };
}

function getBayCount(length) {
  if (length <= 6) return 1;
  if (length <= 12) return 2;
  if (length <= 18) return 3;
  if (length <= 24) return 4;
  return 6;
}

function initThree() {
  const canvas = $("viewer3d");
  if (!canvas) return;

  if (!window.THREE) {
    console.error("THREE.js non chargé. Vérifie tes <script> (three, OrbitControls, GLTFLoader) avant app.js");
    return;
  }

  const w = canvas.clientWidth || 420;
  const h = canvas.clientHeight || 320;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6f2ea);
  scene.fog = new THREE.Fog(0xf6f2ea, 25, 85);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2500);
  camera.position.set(9, 5.5, 10.5);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(w, h, false);

  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.physicallyCorrectLights = true;

  if (SHADOW_ENABLED) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.52));

  const key = new THREE.DirectionalLight(0xffffff, 1.10);
  key.position.set(12, 22, 10);
  key.castShadow = SHADOW_ENABLED;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.radius = 6;
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 120;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.42);
  fill.position.set(-18, 14, 6);
  scene.add(fill);

  const topSoft = new THREE.DirectionalLight(0xffffff, 0.35);
  topSoft.position.set(0, 30, 0);
  scene.add(topSoft);

  const rim = new THREE.DirectionalLight(0xfff3dd, 0.25);
  rim.position.set(0, 12, -18);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xe9dcc2, 0.50);
  scene.add(hemi);

  buildStudio();

  const contactTex = createContactShadowTexture(512);
  contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  scene.add(contactShadow);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.target.set(0, 1.5, 0);
  controls.minPolarAngle = ORBIT_MIN_POLAR;
  controls.maxPolarAngle = ORBIT_MAX_POLAR;
  controls.minDistance = 5;
  controls.maxDistance = 35;

  const tl = new THREE.TextureLoader();

  tl.load(PAVE_TEX_PATH, (tex) => {
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    if (groundDecal?.material) {
      groundDecal.material.map = tex;
      groundDecal.material.needsUpdate = true;
    }
  });

  tl.load(ROOF_TEX_PATH, (tex) => {
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 2);
    roofTex = tex;
  });

  tl.load(CLAD_TEX_PATH, (tex) => {
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 3);
    cladTex = tex;
  });

  loadModelForType(getSelectedType());

  window.addEventListener("resize", () => setTimeout(onThreeResize, 40));
  animateThree();
}

function loadModelForType(type) {
  const modelCfg = MODELS[type] || MODELS.mono;
  const loader = new THREE.GLTFLoader();

  loader.load(
    modelCfg.path,
    (gltf) => {
      baseModule = gltf.scene;

      // ✅ Structure GLTF : DoubleSide + normals (évite “zones invisibles”)
      baseModule.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = SHADOW_ENABLED;
        obj.receiveShadow = SHADOW_ENABLED;

        if (obj.geometry?.computeVertexNormals) obj.geometry.computeVertexNormals();

        obj.material = new THREE.MeshStandardMaterial({
          color: 0xc9c9c9,
          metalness: 0.12,
          roughness: 0.55,
          side: THREE.DoubleSide, // ✅ CRUCIAL
        });
      });

      baseBBox = new THREE.Box3().setFromObject(baseModule);
      update3DFromConfig(); // 1er build 3D basé sur la config courante
    },
    undefined,
    (err) => console.error("Erreur GLTF :", err)
  );
}

function onThreeResize() {
  const canvas = $("viewer3d");
  if (!canvas || !renderer || !camera) return;
  const w = canvas.clientWidth || 420;
  const h = canvas.clientHeight || 320;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function animateThree() {
  requestAnimationFrame(animateThree);
  controls?.update?.();
  renderer?.render?.(scene, camera);
}

function buildStructureFromConfig(cfg) {
  if (!baseModule || !baseBBox) return null;

  if (structureGroup) scene.remove(structureGroup);
  structureGroup = new THREE.Group();
  scene.add(structureGroup);

  const type = cfg?.type || getSelectedType();
  const baseCfg = MODELS[type]?.base || MODELS.mono.base;

  const width  = cfg?.width  ?? getCurrentDimensions().width;
  const length = cfg?.length ?? getCurrentDimensions().length;
  const height = cfg?.height ?? getCurrentDimensions().height;
  const bays   = cfg?.bays   ?? getBayCount(length);
  const bayLengthM = length / bays;

  const baseSize = new THREE.Vector3();
  baseBBox.getSize(baseSize);

  let currentX = 0;

  for (let i = 0; i < bays; i++) {
    const clone = baseModule.clone(true);

    const scaleX = (bayLengthM / baseCfg.length) * GLOBAL_SCALE;
    const scaleZ = (width / baseCfg.width) * GLOBAL_SCALE;
    const scaleY = (height / baseCfg.height) * GLOBAL_SCALE;

    clone.scale.set(scaleX, scaleY, scaleZ);

    const minXScaled = baseBBox.min.x * scaleX;
    const offsetX = currentX - minXScaled;

    clone.position.set(offsetX, 0, 0);
    structureGroup.add(clone);

    const segLength = baseSize.x * scaleX;
    currentX += segLength;
  }

  let bbox = new THREE.Box3().setFromObject(structureGroup);
  const center = bbox.getCenter(new THREE.Vector3());

  structureGroup.position.x -= center.x;
  structureGroup.position.z -= center.z;

  bbox = new THREE.Box3().setFromObject(structureGroup);
  structureGroup.position.y -= bbox.min.y;

  bbox = new THREE.Box3().setFromObject(structureGroup);
  return bbox;
}

function materialWithTexture({ color, tex, opacity }) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    metalness: 0.08,
    roughness: 0.78,

    // ✅ anti “trous” / tri transparent
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  if (tex) {
    mat.map = tex;
    mat.map.needsUpdate = true;
  }
  return mat;
}

// pignon mono (trapèze)
function createMonoGableShape(widthZ, y0, yLow, yHigh) {
  const halfW = widthZ / 2;
  const s = new THREE.Shape();
  s.moveTo(-halfW, y0);
  s.lineTo( halfW, y0);
  s.lineTo( halfW, yHigh);
  s.lineTo(-halfW, yLow);
  s.lineTo(-halfW, y0);
  return s;
}

// pignon bi (maison)
function createBiGableShape(widthZ, y0, yEave, yRidge) {
  const halfW = widthZ / 2;
  const s = new THREE.Shape();
  s.moveTo(-halfW, y0);
  s.lineTo( halfW, y0);
  s.lineTo( halfW, yEave);
  s.lineTo( 0,     yRidge);
  s.lineTo(-halfW, yEave);
  s.lineTo(-halfW, y0);
  return s;
}

function rebuildOverlays(bbox) {
  if (!bbox) return;

  if (overlayGroup) scene.remove(overlayGroup);
  overlayGroup = new THREE.Group();
  scene.add(overlayGroup);

  const min = bbox.min;
  const max = bbox.max;

  const lenX = max.x - min.x;
  const widthZ = max.z - min.z;

  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;

  let roofThick = ROOF_THICKNESS * GLOBAL_SCALE;
  let cladThick = CLAD_THICKNESS * GLOBAL_SCALE;

  const roofType = document.querySelector('input[name="roofType"]:checked')?.value;
  const claddingType = document.querySelector('input[name="claddingType"]:checked')?.value;

  // Toiture sandwich visuellement plus épaisse
  if (roofType === "sandwich40") {
    roofThick *= 1.8;  // tu ajustes si tu veux plus ou moins
  }

  // Bardage sandwich légèrement plus épais
  if (claddingType === "sandwich40") {
    cladThick *= 1.5;
  }

  const eps = 0.004 * Math.max(lenX, widthZ);

  const { height } = getCurrentDimensions();
  const eaveY = min.y + height;
  const angle = Math.atan(PITCH_RATIO);

  setStructureUpperVisibility(eaveY, bbox, getSelectedType());

  const roofMat = materialWithTexture({
    color: getRoofColor3D(),
    tex: roofTex,
    opacity: ROOF_OPACITY,
  });

  const cladMat = materialWithTexture({
    color: getCladdingColor3D(),
    tex: cladTex,
    opacity: CLAD_OPACITY,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: getTrimColor3D(),
    metalness: 0.10,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });

  const slopeType = getSelectedType();

  /* ============================
     TOITURE — COLLE + PENTE 10%
  ============================ */

  if (slopeType === "mono") {
    const roofGeo = new THREE.BoxGeometry(lenX, roofThick, widthZ);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.userData.kind = "roof";

    roof.rotation.x = -angle;

    const lift = (widthZ / 2) * Math.sin(angle);
    const centerY = (eaveY + ROOF_GAP) + (roofThick / 2) + lift;

    roof.position.set(cx, centerY, cz);
    roof.castShadow = SHADOW_ENABLED;
    roof.receiveShadow = SHADOW_ENABLED;
    overlayGroup.add(roof);

    overlayGroup.userData.roof = { type: "mono", roof, centerY, eaveY };
  } else {
    const halfW = widthZ / 2;
    const roofGeoHalf = new THREE.BoxGeometry(lenX, roofThick, halfW);

    const lift = (halfW / 2) * Math.sin(angle);
    const centerY = (eaveY + ROOF_GAP) + (roofThick / 2) + lift;

    const roofPlusZ = new THREE.Mesh(roofGeoHalf, roofMat.clone());
    roofPlusZ.userData.kind = "roof";
    roofPlusZ.rotation.x = +angle;
    roofPlusZ.position.set(cx, centerY, cz + halfW / 2);
    roofPlusZ.castShadow = SHADOW_ENABLED;
    roofPlusZ.receiveShadow = SHADOW_ENABLED;
    overlayGroup.add(roofPlusZ);

    const roofMinusZ = new THREE.Mesh(roofGeoHalf, roofMat.clone());
    roofMinusZ.userData.kind = "roof";
    roofMinusZ.rotation.x = -angle;
    roofMinusZ.position.set(cx, centerY, cz - halfW / 2);
    roofMinusZ.castShadow = SHADOW_ENABLED;
    roofMinusZ.receiveShadow = SHADOW_ENABLED;
    overlayGroup.add(roofMinusZ);

    overlayGroup.userData.roof = { type: "bi", roofPlusZ, roofMinusZ, centerY, eaveY };
  }

  /* ============================
     CHARPENTE PRO (visible) — BIPENTE
  ============================ */
  if (slopeType === "bi") {
    const halfW = widthZ / 2;
    const ridgeH = halfW * PITCH_RATIO;

    const r = overlayGroup.userData?.roof;
    const roofCenterY = r?.centerY ?? (eaveY + roofThick);

    const underRidge = (roofCenterY - roofThick / 2) - UNDER_ROOF_CLEARANCE;
    const underEave  = underRidge - ridgeH;

    const frameFX = new THREE.Group();
    frameFX.name = "frameFX";
    overlayGroup.add(frameFX);

    const galva = makeGalvaMat();

    addSigmaBeam(frameFX, { len: lenX, x: cx, y: underRidge, z: cz, rx: 0, ry: 0, rz: 0, mat: galva });

    const t = 0.55;
    addSigmaBeam(frameFX, { len: lenX, x: cx, y: underRidge - (ridgeH * t), z: cz + (halfW * t), rx: +angle, ry: 0, rz: 0, mat: galva });
    addSigmaBeam(frameFX, { len: lenX, x: cx, y: underRidge - (ridgeH * t), z: cz - (halfW * t), rx: -angle, ry: 0, rz: 0, mat: galva });

    addSigmaBeam(frameFX, { len: lenX, x: cx, y: underEave, z: cz + halfW - 0.03, rx: 0, ry: 0, rz: 0, mat: galva });
    addSigmaBeam(frameFX, { len: lenX, x: cx, y: underEave, z: cz - halfW + 0.03, rx: 0, ry: 0, rz: 0, mat: galva });
  }

  /* ============================
     BARDAGE — COLLE SOUS COUVERTURE
  ============================ */

  const ridgeY_mono = eaveY + (widthZ * PITCH_RATIO);
  const ridgeY_bi   = eaveY + ((widthZ / 2) * PITCH_RATIO);

  let topA = eaveY;
  let topC = eaveY;

  if (slopeType === "mono") {
    topA = ridgeY_mono - UNDER_ROOF_CLEARANCE;
    topC = eaveY       - UNDER_ROOF_CLEARANCE;
  } else {
    topA = eaveY - UNDER_ROOF_CLEARANCE;
    topC = eaveY - UNDER_ROOF_CLEARANCE;
  }

  const panelHeightA = Math.max(0.2, (topA - min.y) - CLAD_TOP_GAP);
  const panelHeightC = Math.max(0.2, (topC - min.y) - CLAD_TOP_GAP);

  const geoA = new THREE.BoxGeometry(lenX, panelHeightA, cladThick);
  const geoC = new THREE.BoxGeometry(lenX, panelHeightC, cladThick);

  const cladA_outer = new THREE.Mesh(geoA, cladMat.clone());
  cladA_outer.position.set(cx, min.y + panelHeightA / 2, max.z + eps);

  const cladC_outer = new THREE.Mesh(geoC, cladMat.clone());
  cladC_outer.position.set(cx, min.y + panelHeightC / 2, min.z - eps);

  let gableShapeB = null;
  let gableShapeD = null;

  if (slopeType === "mono") {
    const yLow  = (eaveY       - UNDER_ROOF_CLEARANCE) - CLAD_TOP_GAP;
    const yHigh = (ridgeY_mono - UNDER_ROOF_CLEARANCE) - CLAD_TOP_GAP;

    const shapeB = createMonoGableShape(widthZ, min.y, yLow, yHigh);
    const shapeD = createMonoGableShape(widthZ, min.y, yHigh, yLow);

    gableShapeB = new THREE.Mesh(new THREE.ShapeGeometry(shapeB), cladMat.clone());
    gableShapeD = new THREE.Mesh(new THREE.ShapeGeometry(shapeD), cladMat.clone());

    gableShapeB.rotation.y = -Math.PI / 2;
    gableShapeD.rotation.y = +Math.PI / 2;

    const gableOffset = (cladThick / 2) + eps;
    gableShapeB.position.set(min.x - gableOffset, 0, cz);
    gableShapeD.position.set(max.x + gableOffset, 0, cz);
  } else {
    const yEave  = (eaveY     - UNDER_ROOF_CLEARANCE) - CLAD_TOP_GAP;
    const yRidge = (ridgeY_bi - UNDER_ROOF_CLEARANCE) - CLAD_TOP_GAP;

    const shape = createBiGableShape(widthZ, min.y, yEave, yRidge);

    gableShapeB = new THREE.Mesh(new THREE.ShapeGeometry(shape), cladMat.clone());
    gableShapeD = new THREE.Mesh(new THREE.ShapeGeometry(shape), cladMat.clone());

    gableShapeB.rotation.y = Math.PI / 2;
    gableShapeD.rotation.y = -Math.PI / 2;

    const gableOffset = (cladThick / 2) + eps;
    gableShapeB.position.set(min.x - gableOffset, 0, cz);
    gableShapeD.position.set(max.x + gableOffset, 0, cz);
  }

  function addDoubleSkin(mesh, outwardDir) {
    mesh.castShadow = SHADOW_ENABLED;
    mesh.receiveShadow = SHADOW_ENABLED;
    mesh.userData.kind = "clad";
    overlayGroup.add(mesh);

    const inner = new THREE.Mesh(mesh.geometry, mesh.material.clone());
    inner.rotation.copy(mesh.rotation);
    inner.position.copy(mesh.position);
    inner.position.addScaledVector(outwardDir, -cladThick);
    inner.material.opacity = Math.min(1, CLAD_OPACITY * 0.98);
    inner.castShadow = SHADOW_ENABLED;
    inner.receiveShadow = SHADOW_ENABLED;
    inner.userData.kind = "clad";
    overlayGroup.add(inner);

    return { outer: mesh, inner };
  }

  const A = addDoubleSkin(cladA_outer, new THREE.Vector3(0, 0, 1));
  const C = addDoubleSkin(cladC_outer, new THREE.Vector3(0, 0, -1));
  const B = addDoubleSkin(gableShapeB, new THREE.Vector3(-1, 0, 0));
  const D = addDoubleSkin(gableShapeD, new THREE.Vector3(1, 0, 0));

  function applyCladdingVisibility() {
    const showA = !!document.querySelector('input[name="claddingSide"][value="A"]:checked');
    const showB = !!document.querySelector('input[name="claddingSide"][value="B"]:checked');
    const showC = !!document.querySelector('input[name="claddingSide"][value="C"]:checked');
    const showD = !!document.querySelector('input[name="claddingSide"][value="D"]:checked');

    A.outer.visible = showA; A.inner.visible = showA;
    B.outer.visible = showB; B.inner.visible = showB;
    C.outer.visible = showC; C.inner.visible = showC;
    D.outer.visible = showD; D.inner.visible = showD;
  }

  applyCladdingVisibility();
  overlayGroup.userData.applyCladdingVisibility = applyCladdingVisibility;

  /* ============================
     HABILLAGES (3D)
  ============================ */
  const TRIM_TH = 0.018;
  const TRIM_W  = 0.070;

  function addTrimBox(sizeX, sizeY, sizeZ, px, py, pz, rotX = 0, rotY = 0, rotZ = 0, visible = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sizeX, sizeY, sizeZ), trimMat.clone());
    m.position.set(px, py, pz);
    m.rotation.set(rotX, rotY, rotZ);
    m.castShadow = SHADOW_ENABLED;
    m.receiveShadow = false;
    m.userData.kind = "trim";
    m.visible = visible;
    overlayGroup.add(m);
    return m;
  }

  const optAngles         = $("optAngles")?.checked;
  const optRejetEau       = $("optRejetEau")?.checked;
  const optFaitiereDouble = $("optFaitiereDouble")?.checked;
  const optFaitiereSimple = $("optFaitiereSimple")?.checked;
  const optFaitiereSolin  = $("optFaitiereSolin")?.checked;

  const optGrandeRive = $("optGrandeRive")?.checked;
  const optRiveSolin  = $("optRiveSolin")?.checked;

  const grB2 = $("optGrandeRiveB")?.checked;
  const grD2 = $("optGrandeRiveD")?.checked;
  const rsB2 = $("optRiveSolinB")?.checked;
  const rsD2 = $("optRiveSolinD")?.checked;

  // Angles verticaux
  if (optAngles) {
    const h = Math.max(panelHeightA, panelHeightC);
    const y = min.y + h / 2;
    addTrimBox(TRIM_TH, h, TRIM_W, min.x - eps, y, min.z - eps);
    addTrimBox(TRIM_TH, h, TRIM_W, min.x - eps, y, max.z + eps);
    addTrimBox(TRIM_TH, h, TRIM_W, max.x + eps, y, min.z - eps);
    addTrimBox(TRIM_TH, h, TRIM_W, max.x + eps, y, max.z + eps);
  }

  // Rejet d’eau bas
  if (optRejetEau) {
    const y = min.y + 0.05;
    const zA = max.z + eps;
    const zC = min.z - eps;

    const showA = !!document.querySelector('input[name="claddingSide"][value="A"]:checked');
    const showC = !!document.querySelector('input[name="claddingSide"][value="C"]:checked');

    if (showA) addTrimBox(lenX, TRIM_TH, TRIM_W, cx, y, zA);
    if (showC) addTrimBox(lenX, TRIM_TH, TRIM_W, cx, y, zC);

    const showB = !!document.querySelector('input[name="claddingSide"][value="B"]:checked');
    const showD = !!document.querySelector('input[name="claddingSide"][value="D"]:checked');

    if (showB) addTrimBox(TRIM_W, TRIM_TH, widthZ, min.x - eps, y, cz);
    if (showD) addTrimBox(TRIM_W, TRIM_TH, widthZ, max.x + eps, y, cz);
  }
  // 🔧 RIVES SUR PIGNONS : suivent la pente du toit (mono + bi)
  function addGableTrim(side) {
    const x = (side === "B") ? (min.x - eps) : (max.x + eps);

    if (slopeType === "mono") {
      // Une seule pente (du pan C vers pan A)
      const dy = ridgeY_mono - eaveY;
      const centerY = eaveY + dy / 2 + ROOF_GAP;
      const sizeZ = widthZ + 0.04;

      addTrimBox(
        TRIM_W,
        TRIM_TH,
        sizeZ,
        x,
        centerY,
        cz,
        -angle,   // pente dans le même sens que la toiture mono
        0,
        0,
        true
      );
    } else {
      // Bipente : deux segments de rive par pignon (C->faîtage et A->faîtage)
      const dy = ridgeY_bi - eaveY;
      const segZ = (widthZ / 2) + 0.02;
      const centerY = eaveY + dy / 2 + ROOF_GAP;

      // Segment côté C -> faîtage (même signe que le pan C = roofMinusZ)
      addTrimBox(
        TRIM_W,
        TRIM_TH,
        segZ,
        x,
        centerY,
        cz - segZ / 2,
        -angle,   // ⬅️ AVANT c’était +angle (inversé)
        0,
        0,
        true
      );

      // Segment côté A -> faîtage (même signe que le pan A = roofPlusZ)
      addTrimBox(
        TRIM_W,
        TRIM_TH,
        segZ,
        x,
        centerY,
        cz + segZ / 2,
        +angle,   // ⬅️ AVANT c’était -angle (inversé)
        0,
        0,
        true
      );
    }
  }



  const topRefY = (slopeType === "mono") ? (ridgeY_mono + ROOF_GAP) : (ridgeY_bi + ROOF_GAP);

  // Grandes rives / rives avec solin (sur pente)
  if (optGrandeRive) {
    if (grB2) addGableTrim("B");
    if (grD2) addGableTrim("D");
  }
  if (optRiveSolin) {
    if (rsB2) addGableTrim("B");
    if (rsD2) addGableTrim("D");
  }

    // Faîtières
  // On les place AU-DESSUS de la couverture pour bien les voir
  const FAITIERE_OFFSET_Y = 0.10; // ~10 cm au-dessus du bac acier

  if (slopeType === "mono" && (optFaitiereSimple || optFaitiereSolin)) {
    addTrimBox(
      lenX + 0.02,
      TRIM_TH,
      TRIM_W,
      cx,
      (ridgeY_mono + ROOF_GAP) + FAITIERE_OFFSET_Y,
      max.z - 0.02
    );
  }

  if (slopeType === "bi" && optFaitiereDouble) {
    addTrimBox(
      lenX + 0.02,
      TRIM_TH,
      TRIM_W,
      cx,
      (ridgeY_bi + ROOF_GAP) + FAITIERE_OFFSET_Y,
      cz
    );
  }


  // Sol
  if (groundPlane) groundPlane.position.y = min.y;
  if (groundDecal) groundDecal.position.y = min.y - 0.002;

  if (groundDecal?.material?.map) {
    const tex = groundDecal.material.map;
    const repX = Math.max(6, Math.round(lenX / 0.4));
    const repZ = Math.max(6, Math.round(widthZ / 0.4));
    tex.repeat.set(repX, repZ);
    tex.needsUpdate = true;
    groundDecal.material.needsUpdate = true;
  }

  // Contact shadow
  if (contactShadow) {
    const pad = 0.20;
    contactShadow.geometry.dispose();
    contactShadow.geometry = new THREE.PlaneGeometry(lenX + pad, widthZ + pad);
    contactShadow.position.set(cx, min.y + 0.01, cz);
    contactShadow.material.opacity = 0.55;
  }

  // Caméra
  if (controls && camera) {
    const center = new THREE.Vector3(cx, min.y + height * 0.55, cz);
    controls.target.set(center.x, center.y, center.z);

    const d = Math.max(lenX, widthZ, height);
    camera.position.set(
      center.x + d * 1.22,
      center.y + d * 0.85,
      center.z + d * 1.22
    );
  }
}

function updateOverlayStylesOnly() {
  if (!overlayGroup) return;

  const roofColor = getRoofColor3D();
  const cladColor = getCladdingColor3D();
  const trimColor = getTrimColor3D();

  overlayGroup.traverse((obj) => {
    if (!obj.isMesh) return;
    const mat = obj.material;
    if (!mat || Array.isArray(mat)) return;

    const kind = obj.userData?.kind || "";

    if (kind === "roof") {
      mat.color.set(roofColor);
      mat.opacity = ROOF_OPACITY;
      if (roofTex) mat.map = roofTex;
    } else if (kind === "clad") {
      mat.color.set(cladColor);
      mat.opacity = CLAD_OPACITY;
      if (cladTex) mat.map = cladTex;
    } else if (kind === "trim") {
      mat.color.set(trimColor);
      mat.opacity = 1;
      mat.map = null;
    }
    mat.needsUpdate = true;
  });

  overlayGroup.userData?.applyCladdingVisibility?.();
}

function update3DFromConfig(configOverride) {
  if (!baseModule) return;
  const cfg = configOverride || buildConfigFromUI();
  const bbox = buildStructureFromConfig(cfg);
  rebuildOverlays(bbox);
  updateOverlayStylesOnly();
}

/* ---------------------------
   6) FULLSCREEN + ZOOM UI 3D
---------------------------- */

function setup3DFullscreenUI() {
  const wrapper = $("viewer3d-wrapper");
  const canvas = $("viewer3d");
  const btnFS = $("btnFullscreen3D");
  const btnClose = $("btnClose3D");
  const btnZoomIn = $("btnZoomIn3D");
  const btnZoomOut = $("btnZoomOut3D");
  const toolbar = wrapper?.querySelector?.(".viewer-toolbar");

  if (!wrapper || !canvas || !btnFS) return;

  function resize3D() {
    if (!renderer || !camera) return;

    const w = wrapper.clientWidth || 420;
    const isFS = wrapper.classList.contains("is-fullscreen");

    const h = isFS
      ? Math.max(320, window.innerHeight - 140)
      : (lastInlineCanvasHeight || canvas.clientHeight || 320);

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    controls?.update?.();
  }

  btnFS.addEventListener("click", () => {
    lastInlineCanvasHeight = canvas.clientHeight || lastInlineCanvasHeight || 320;
    wrapper.classList.add("is-fullscreen");
    if (toolbar) toolbar.style.display = "flex";
    setTimeout(resize3D, 80);
  });

  btnClose?.addEventListener("click", () => {
    wrapper.classList.remove("is-fullscreen");
    if (toolbar) toolbar.style.display = "";
    setTimeout(resize3D, 80);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (wrapper.classList.contains("is-fullscreen")) {
        wrapper.classList.remove("is-fullscreen");
        if (toolbar) toolbar.style.display = "";
        setTimeout(resize3D, 80);
      }
    }
  });

  function zoom(delta) {
    if (!camera || !controls) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.addScaledVector(dir, delta);
    controls.update();
  }

  btnZoomIn?.addEventListener("click", () => zoom(0.8));
  btnZoomOut?.addEventListener("click", () => zoom(-0.8));

  window.addEventListener("resize", () => setTimeout(resize3D, 60));
  setTimeout(resize3D, 180);
}

/* ---------------------------
   7) INIT — LIAISONS EVENTS
---------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  populateDimensions();

  initThree();
  setup3DFullscreenUI();

  updateDeliveryUI();
  await updateCityOptions();

  applyOptionAvailabilityByType();

  document.querySelectorAll('input[name="slopeType"]').forEach((el) => {
    el.addEventListener("change", () => {
      populateDimensions();
      applyOptionAvailabilityByType();
      loadModelForType(getSelectedType());
      calculatePriceAndRecap();
    });
  });

  ["width", "length", "height"].forEach((id) => {
    $(id)?.addEventListener("change", calculatePriceAndRecap);
  });

  document.querySelectorAll('input[name="deliveryMode"]').forEach((el) => {
    el.addEventListener("change", async () => {
      updateDeliveryUI();
      await updateCityOptions();
      calculatePriceAndRecap();
    });
  });

  $("postalCode")?.addEventListener("input", async () => {
    await updateCityOptions();
    calculatePriceAndRecap();
  });
  $("city")?.addEventListener("change", calculatePriceAndRecap);

  document.querySelectorAll('input[name="roofType"]').forEach((el) =>
    el.addEventListener("change", calculatePriceAndRecap)
  );

  document.querySelectorAll('input[name="roofColor"]').forEach((el) =>
    el.addEventListener("change", () => {
      calculatePriceAndRecap();
      updateOverlayStylesOnly();
    })
  );

  document.querySelectorAll('input[name="claddingType"]').forEach((el) =>
    el.addEventListener("change", calculatePriceAndRecap)
  );

  document.querySelectorAll('input[name="claddingColor"]').forEach((el) =>
    el.addEventListener("change", () => {
      calculatePriceAndRecap();
      updateOverlayStylesOnly();
    })
  );

  document.querySelectorAll('input[name="claddingSide"]').forEach((el) =>
    el.addEventListener("change", () => {
      calculatePriceAndRecap();
      updateOverlayStylesOnly();
    })
  );

  document.querySelectorAll('input[name="trimColor"]').forEach((el) =>
    el.addEventListener("change", () => {
      calculatePriceAndRecap();
      update3DFromConfig();
    })
  );

  setupSideOption("optGrandeRive", "optGrandeRiveB", "optGrandeRiveD");
  setupSideOption("optRiveSolin",  "optRiveSolinB",  "optRiveSolinD");
  enforceMutualExclusivePerSide();

  [
    "optInstall",
    "optAngles",
    "optRejetEau",
    "optFaitiereDouble",
    "optFaitiereSimple",
    "optFaitiereSolin",
    "optGrandeRive",
    "optRiveSolin",
  ].forEach((id) =>
    $(id)?.addEventListener("change", () => {
      calculatePriceAndRecap();
      update3DFromConfig();
    })
  );

  $("btnCalculate")?.addEventListener("click", calculatePriceAndRecap);

  calculatePriceAndRecap();
});
