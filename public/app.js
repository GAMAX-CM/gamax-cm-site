/* =========================================================
   GAMAX-CM — CONFIGURATEUR + RÉCAP + VUE 3D (THREE)
   Fichier : public/app.js
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
    const response = await fetch(
      "https://apicarto.ign.fr/api/codes-postaux/communes/" + postalCode
    );
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
    select.innerHTML =
      "<option value=''>Sélectionnez votre ville après saisie du code postal</option>";
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
   3.5) OPTIONS — LOGIQUE (désactivation + côtés + exclusivité)
---------------------------- */

function setOptionDisabled(optionId, disabled) {
  const input = $(optionId);
  if (!input) return;
  input.disabled = !!disabled;
  if (disabled) input.checked = false;

  // Optionnel : si tu as une classe CSS pour griser
  const label = input.closest("label");
  if (label) label.classList.toggle("is-disabled", !!disabled);
}

function setSideInputsEnabled(prefix, enabled) {
  const b = $(prefix + "SideB");
  const d = $(prefix + "SideD");
  if (b) b.disabled = !enabled;
  if (d) d.disabled = !enabled;

  if (!enabled) {
    if (b) b.checked = false;
    if (d) d.checked = false;
  }
}

function ensureDefaultSideIfNeeded(optionId, prefix) {
  const opt = $(optionId);
  if (!opt) return;

  const b = $(prefix + "SideB");
  const d = $(prefix + "SideD");

  if (!b || !d) return;

  if (opt.checked) {
    if (!b.checked && !d.checked) b.checked = true; // défaut : côté B
  } else {
    b.checked = false;
    d.checked = false;
  }
}

function enforceRiveExclusivity() {
  // Sur un même côté : Rive avec solin OU Grande rive (pas les deux)
  const riveB = $("riveSolinSideB");
  const riveD = $("riveSolinSideD");
  const grandeB = $("grandeRiveSideB");
  const grandeD = $("grandeRiveSideD");

  if (riveB?.checked && grandeB?.checked) grandeB.checked = false;
  if (riveD?.checked && grandeD?.checked) grandeD.checked = false;
}

function updateOptionsAvailabilityAndUI() {
  const type = getSelectedType();

  // Monopente : faîtière double non sélectionnable
  setOptionDisabled("optFaitiereDouble", type === "mono");

  // Bipente : faîtière avec solin & faîtière simple non sélectionnables
  setOptionDisabled("optFaitiereSolin", type === "bi");
  setOptionDisabled("optFaitiereSimple", type === "bi");

  // Activer/désactiver les sélecteurs de côté seulement si l’option est cochée
  setSideInputsEnabled("faitiereSolin", !!$("optFaitiereSolin")?.checked && !($("optFaitiereSolin")?.disabled));
  setSideInputsEnabled("riveSolin", !!$("optRiveSolin")?.checked);
  setSideInputsEnabled("grandeRive", !!$("optGrandeRive")?.checked);

  // Si option cochée et aucun côté : défaut B
  ensureDefaultSideIfNeeded("optFaitiereSolin", "faitiereSolin");
  ensureDefaultSideIfNeeded("optRiveSolin", "riveSolin");
  ensureDefaultSideIfNeeded("optGrandeRive", "grandeRive");

  // Exclusivité rive/grande rive par côté
  enforceRiveExclusivity();

  // Si un côté est coché, s’assurer que l’option correspondante est cochée
  if ($("riveSolinSideB")?.checked || $("riveSolinSideD")?.checked) $("optRiveSolin").checked = true;
  if ($("grandeRiveSideB")?.checked || $("grandeRiveSideD")?.checked) $("optGrandeRive").checked = true;
  if ($("faitiereSolinSideB")?.checked || $("faitiereSolinSideD")?.checked) {
    if (!$("optFaitiereSolin")?.disabled) $("optFaitiereSolin").checked = true;
  }
}

/* ---------------------------
   4) CALCUL PRIX + RÉCAP
---------------------------- */

function calculatePriceAndRecap() {
  updateOptionsAvailabilityAndUI();

  const type = getSelectedType();
  const width = parseFloat($("width")?.value || "0");
  const length = parseFloat($("length")?.value || "0");
  const height = parseFloat($("height")?.value || "0");
  if (!width || !length || !height) return;

  const area = width * length;

  const sizeKey = width + "x" + length;
  let structureBase = STRUCTURE_PRICE_TABLE[type]?.[sizeKey] ?? 0;

  if (height > 3) {
    const extra = height - 3;
    const steps = extra / 0.5;
    structureBase *= 1 + steps * 0.1;
  }

  const roofType = document.querySelector('input[name="roofType"]:checked')?.value;
  const roofUnit = ROOF_PRICE_PER_M2[roofType] ?? 0;
  const roofCost = area * roofUnit;

  let claddingArea = 0;
  const claddings = document.querySelectorAll('input[name="claddingSide"]:checked');
  claddings.forEach((el) => {
    if (el.value === "A" || el.value === "C") claddingArea += length * height;
    else claddingArea += width * height;
  });

  const claddingType = document.querySelector('input[name="claddingType"]:checked')?.value;
  const cladUnit = CLADDING_PRICE_PER_M2[claddingType] ?? 0;
  const claddingCost = claddingArea * cladUnit;

  // options
  const optInstall = $("optInstall");
  const optFaitiereSolin = $("optFaitiereSolin");
  const optRiveSolin = $("optRiveSolin");
  const optGrandeRive = $("optGrandeRive");
  const optAngles = $("optAngles");
  const optRejetEau = $("optRejetEau");
  const optFaitiereDouble = $("optFaitiereDouble");
  const optFaitiereSimple = $("optFaitiereSimple");

  // finitions actives ?
  const finishingSelected =
    (optFaitiereSolin?.checked && !optFaitiereSolin.disabled) ||
    (optRiveSolin?.checked) ||
    (optGrandeRive?.checked) ||
    (optAngles?.checked) ||
    (optRejetEau?.checked) ||
    (optFaitiereDouble?.checked && !optFaitiereDouble.disabled) ||
    (optFaitiereSimple?.checked && !optFaitiereSimple.disabled);

  let optionsPrice = 0;
  if (finishingSelected) optionsPrice += area * OPTIONS_PRICES.finishingPerM2;
  if (optInstall?.checked) optionsPrice += area * OPTIONS_PRICES.installPerM2;

  const deliveryMode = getDeliveryMode();
  const postalCode = ($("postalCode")?.value || "").trim();
  const delivery = (deliveryMode === "retrait") ? 0 : getDeliveryPrice(postalCode);

  let totalHT = structureBase + roofCost + claddingCost + optionsPrice + delivery;
  totalHT = Math.round(totalHT / 50) * 50;
  const totalTTC = Math.round((totalHT * (1 + TVA_RATE)) / 10) * 10;

  const typeLabel = (type === "bi") ? "Abris bipente" : "Abris monopente";

  const claddingChecked = Array.from(claddings);
  const claddingCount = claddingChecked.length;

  let claddingAreaText = "";
  if (claddingCount === 0) {
    claddingAreaText = "Abris ouvert (sans bardage)";
  } else {
    const codes = claddingChecked.map((c) => c.value);
    const sides = codes.map((code) => FACADE_LABELS[code] || ("Façade " + code));
    claddingAreaText =
      claddingCount + " façade(s) bardée(s) : " +
      sides.join(", ") + " (env. " + claddingArea.toFixed(1) + " m²)";
  }

  const roofColor = document.querySelector('input[name="roofColor"]:checked')?.value || "Non précisée";
  const claddingColor = document.querySelector('input[name="claddingColor"]:checked')?.value || "Non précisée";
  const trimColor = document.querySelector('input[name="trimColor"]:checked')?.value || "Non précisée";

  const selectedOptions = [];

// ✅ Faîtière avec solin
if (optFaitiereSolin?.checked) {
  if (slopeType === "mono") {
    // Monopente : arête haute façade A (+Z), sur toute la longueur
    const yHigh = max.y;        // point haut structure
    const zHigh = max.z + eps;  // façade A (extérieur)
    addBand(
      new THREE.Vector3(min.x, yHigh, zHigh),
      new THREE.Vector3(max.x, yHigh, zHigh),
      trimColor,
      0.055
    );
  } else {
    // Bipente : option désactivée normalement, mais si jamais => faîtage (ligne centrale z=cz)
    addBand(
      new THREE.Vector3(min.x, max.y, cz),
      new THREE.Vector3(max.x, max.y, cz),
      trimColor,
      0.055
    );
  }
}


  // Rive solin / grande rive (avec côté)
  if (optRiveSolin?.checked) {
    const b = $("riveSolinSideB")?.checked;
    const d = $("riveSolinSideD")?.checked;
    const sides = [b ? "B" : null, d ? "D" : null].filter(Boolean).join("/");
    selectedOptions.push("Rive avec solin" + (sides ? ` (côté ${sides})` : ""));
  }

  if (optGrandeRive?.checked) {
    const b = $("grandeRiveSideB")?.checked;
    const d = $("grandeRiveSideD")?.checked;
    const sides = [b ? "B" : null, d ? "D" : null].filter(Boolean).join("/");
    selectedOptions.push("Grande rive" + (sides ? ` (côté ${sides})` : ""));
  }

  if (optAngles?.checked) selectedOptions.push("Angles");
  if (optRejetEau?.checked) selectedOptions.push("Rejet d’eau");

  if (optFaitiereDouble?.checked && !optFaitiereDouble.disabled) selectedOptions.push("Faîtière double");
  if (optFaitiereSimple?.checked && !optFaitiereSimple.disabled) selectedOptions.push("Faîtière simple");
  if (optInstall?.checked) selectedOptions.push("Pose par nos équipes");

  let addressText = "";
  if (deliveryMode === "retrait") {
    addressText = "Retrait à l’atelier GAMAX-CM (Tonneins)";
  } else {
    const city = $("city")?.value || "";
    addressText = postalCode ? (postalCode + (city ? (" " + city) : "")) : "Non renseignée";
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
  recapHTML += LINE("Options :", (selectedOptions.length ? selectedOptions.join(", ") : "Aucune"));
  recapHTML += BLANK();
  recapHTML += LINE("Mode :", (deliveryMode === "retrait" ? "Retrait à Tonneins" : "Livraison sur chantier"));
  recapHTML += LINE("Adresse :", addressText);
  recapHTML += LINE("Livraison estimative :", livTxt);
  recapHTML += BLANK();
  recapHTML += LINE("Prix estimatif :", `${formatCurrency(totalHT)} HT soit env. ${formatCurrency(totalTTC)} TTC`);
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
  recapText += LINE_TXT("Options :", (selectedOptions.length ? selectedOptions.join(", ") : "Aucune"));
  recapText += "\n";
  recapText += LINE_TXT("Mode :", (deliveryMode === "retrait" ? "Retrait à Tonneins" : "Livraison sur chantier"));
  recapText += LINE_TXT("Adresse :", addressText);
  recapText += LINE_TXT("Livraison estimative :", livTxt);
  recapText += "\n";
  recapText += LINE_TXT("Prix estimatif :", `${formatCurrency(totalHT)} HT soit env. ${formatCurrency(totalTTC)} TTC`);
  recapText += "\n";
  recapText += "Ce devis est une estimation indicative. Un devis définitif vous sera transmis par GAMAX-CM.\n";

  afficherRecapitulatif(recapHTML, recapText);

  // MAJ 3D
  update3DFromConfig();
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

// Assets (dans public/assets/)
const ROOF_TEX_PATH = "assets/texture-bac-acier.jpg";
const CLAD_TEX_PATH = "assets/texture-bac-acier.jpg";
const PAVE_TEX_PATH = "assets/texture-pave-gris.jpg";
const BG_TEX_PATH   = "assets/fond-jardin.jpg";

// ===== MODÈLES PAR TYPE =====
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

// Échelle globale (laisser à 1)
const GLOBAL_SCALE = 1;

// Pente
const PITCH_RATIO = 0.10;          // 10%
const ROOF_OVERHANG_RATIO = 0.14;  // débord

// Visuel texture (répétition)
const ROOF_TEX_REPEAT_X = 8;
const ROOF_TEX_REPEAT_Z = 2;
const CLAD_TEX_REPEAT_X = 8;
const CLAD_TEX_REPEAT_Y = 3;

// Opacité
const ROOF_OPACITY = 0.98;
const CLAD_OPACITY = 0.98;

// Epaisseurs
const ROOF_THICKNESS = 0.06;
const CLAD_THICKNESS = 0.035;

// Couverture (collage)
const ROOF_SINK_RATIO = 0.015;
const ROOF_DROP = 0.04;
const ROOF_GAP = 0.01;

// Bardage sous couverture
const CLAD_TOP_GAP = 0.03;

// OrbitControls
const ORBIT_MIN_POLAR = 0.15 * Math.PI;
const ORBIT_MAX_POLAR = 0.48 * Math.PI;

// Ombres
const SHADOW_ENABLED = true;

// Three globals
let scene, camera, renderer, controls;
let baseModule = null;
let baseBBox = null;
let structureGroup = null;
let overlayGroup = null;

let backgroundPlane = null;
let groundDisc = null;
let padMesh = null;

let roofTex = null;
let cladTex = null;

let lastInlineCanvasHeight = 0;

/* -------- Couleurs 3D depuis RAL -------- */

function getRALColorFromRadio(name) {
  const input = document.querySelector(`input[name="${name}"]:checked`);
  if (!input) return "#666666";
  const box = input.closest(".ral-choice")?.querySelector(".ral-box");
  if (!box) return "#666666";
  return window.getComputedStyle(box).backgroundColor;
}
function getRoofColor3D() { return getRALColorFromRadio("roofColor"); }
function getCladdingColor3D() { return getRALColorFromRadio("claddingColor"); }
// Habillages : même palette, groupe "trimColor"
function getTrimColor3D() {
  const color = getRALColorFromRadio("trimColor");
  return color || getRoofColor3D();
}

function getCurrentDimensions() {
  const width = parseFloat($("width")?.value || "3");
  const length = parseFloat($("length")?.value || "5");
  const height = parseFloat($("height")?.value || "2.15");
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
  scene.background = new THREE.Color(0xf7f4ee);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
  camera.position.set(8, 5, 10);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(w, h, false);

  if (SHADOW_ENABLED) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // lumières
  scene.add(new THREE.AmbientLight(0xffffff, 0.70));

  const dir = new THREE.DirectionalLight(0xffffff, 0.95);
  dir.position.set(10, 20, 10);
  dir.castShadow = SHADOW_ENABLED;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 80;
  scene.add(dir);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xe9dcc2, 0.30);
  scene.add(hemi);

  // sol
  groundDisc = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
  );
  groundDisc.rotation.x = -Math.PI / 2;
  groundDisc.position.y = 0;
  groundDisc.receiveShadow = SHADOW_ENABLED;
  scene.add(groundDisc);

  padMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
  );
  padMesh.rotation.x = -Math.PI / 2;
  padMesh.position.y = 0.01;
  padMesh.receiveShadow = SHADOW_ENABLED;
  scene.add(padMesh);

  // controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.5, 0);
  controls.minPolarAngle = ORBIT_MIN_POLAR;
  controls.maxPolarAngle = ORBIT_MAX_POLAR;

  // textures
  const tl = new THREE.TextureLoader();

  tl.load(PAVE_TEX_PATH, (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    groundDisc.material.map = tex;
    groundDisc.material.needsUpdate = true;

    const tex2 = tex.clone();
    tex2.repeat.set(4, 4);
    padMesh.material.map = tex2;
    padMesh.material.needsUpdate = true;
  });

  tl.load(ROOF_TEX_PATH, (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(ROOF_TEX_REPEAT_X, ROOF_TEX_REPEAT_Z);
    roofTex = tex;
  });

  tl.load(CLAD_TEX_PATH, (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(CLAD_TEX_REPEAT_X, CLAD_TEX_REPEAT_Y);
    cladTex = tex;
  });

  tl.load(BG_TEX_PATH, (tex) => {
    const bgGeo = new THREE.PlaneGeometry(40, 15);
    const bgMat = new THREE.MeshBasicMaterial({ map: tex });
    backgroundPlane = new THREE.Mesh(bgGeo, bgMat);
    backgroundPlane.position.set(0, 7, -20);
    scene.add(backgroundPlane);
  });

  // Charger modèle initial
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
      baseModule.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = SHADOW_ENABLED;
          obj.receiveShadow = SHADOW_ENABLED;
          obj.material = obj.material.clone();
        }
      });
      baseBBox = new THREE.Box3().setFromObject(baseModule);
      update3DFromConfig();
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

function buildStructureFromConfig() {
  if (!baseModule || !baseBBox) return null;

  if (structureGroup) scene.remove(structureGroup);
  structureGroup = new THREE.Group();
  scene.add(structureGroup);

  const type = getSelectedType();
  const baseCfg = MODELS[type]?.base || MODELS.mono.base;

  const { width, length, height } = getCurrentDimensions();
  const bays = getBayCount(length);
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

  // Center X/Z + poser au sol (min.y => 0)
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
    metalness: 0.05,
    roughness: 0.88,
  });

  if (tex) {
    mat.map = tex;
    mat.map.needsUpdate = true;
  }
  return mat;
}

// ----- Géométrie pignon mono (trapèze) : point haut côté +Z
function createMonoGableShape(widthZ, y0, yLow, yHigh) {
  const halfW = widthZ / 2;
  const s = new THREE.Shape();
  s.moveTo(-halfW, y0);
  s.lineTo( halfW, y0);
  s.lineTo( halfW, yHigh); // haut sur +Z
  s.lineTo(-halfW, yLow);
  s.lineTo(-halfW, y0);
  return s;
}

// ----- Géométrie pignon bi (forme maison)
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

/* -------- Habillages : lignes de surbrillance -------- */

function rebuildOverlays(bbox) {
  if (!bbox) return;

  if (overlayGroup) scene.remove(overlayGroup);
  overlayGroup = new THREE.Group();
  scene.add(overlayGroup);

  const min = bbox.min;
  const max = bbox.max;

  const lenX = max.x - min.x;
  const widthZ = max.z - min.z;
  const heightY = max.y - min.y;
  const eps = 0.02 * Math.max(lenX, widthZ, heightY);

  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;

  const roofThick = ROOF_THICKNESS * GLOBAL_SCALE;
  const cladThick = CLAD_THICKNESS * GLOBAL_SCALE;

  const roofSink = Math.max(0.01, heightY * ROOF_SINK_RATIO);

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

  const slopeType = getSelectedType();
  const angle = Math.atan(PITCH_RATIO);

  // Stockage context pour les highlights
  overlayGroup.userData.ctx = {
    min, max, cx, cz, lenX, widthZ, heightY, eps, angle, roofSink, roofThick, cladThick
  };
   
  // ===== TOITURE =====
    // ===== Helpers (snap + détection panne haute) =====
  function snapMeshMinYTo(mesh, targetMinY) {
    const bb = new THREE.Box3().setFromObject(mesh);
    const dy = targetMinY - bb.min.y;
    mesh.position.y += dy;
  }

  function getRoofSeatYFromStructure(structureGroup, bbox) {
    if (!structureGroup || !bbox) return null;

    const min = bbox.min, max = bbox.max;
    const lenX = max.x - min.x;
    const widthZ = max.z - min.z;
    const heightY = max.y - min.y;

    const topZoneMinY = max.y - heightY * 0.35;     // zone haute
    const thinYMax = Math.max(0.06, heightY * 0.08); // pièce "fine" en Y

    let best = null;

    structureGroup.traverse((obj) => {
      if (!obj.isMesh) return;

      const bb = new THREE.Box3().setFromObject(obj);
      const size = bb.getSize(new THREE.Vector3());

      // proche du haut
      if (bb.max.y < topZoneMinY) return;

      // pièce "fine" verticalement
      if (size.y > thinYMax) return;

      // plutôt longue (pannes : très longues en X, ou parfois en Z)
      const longEnoughX = size.x > lenX * 0.35;
      const longEnoughZ = size.z > widthZ * 0.35;
      if (!longEnoughX && !longEnoughZ) return;

      // score : on privilégie la plus haute et la plus longue
      const score = (bb.max.y * 10) + Math.max(size.x, size.z);

      if (!best || score > best.score) {
        best = { score, yTop: bb.max.y };
      }
    });

    return best ? best.yTop : null;
  }

  // ===== TOITURE (couverture) =====
  const ROOF_CONTACT_GAP = 0.004; // anti scintillement (très faible)
  const slopeType = getSelectedType();
  const angle = Math.atan(PITCH_RATIO);

  // 👉 niveau "porteur" : dessus de la panne haute (auto)
  // bbox vient de buildStructureFromConfig() -> structureGroup est déjà en place
  const seatY = getRoofSeatYFromStructure(structureGroup, bbox);
  // fallback si jamais la détection ne trouve rien
  const seatFallbackY = (max.y - roofSink) - 0.18;
  const targetMinY = (seatY ?? seatFallbackY) - ROOF_CONTACT_GAP;

  if (slopeType === "mono") {
    const overhang = widthZ * ROOF_OVERHANG_RATIO;
    const roofGeo = new THREE.BoxGeometry(lenX, roofThick, widthZ + overhang);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.userData.kind = "roof";

    // pente vers -Z (point haut façade A = +Z)
    roof.rotation.x = -angle;

    const lift = (widthZ / 2) * Math.sin(angle);

    // position "approx" (le snap finira le collage)
    roof.position.set(
      cx,
      (max.y - roofSink) + lift - ROOF_DROP, // on garde juste ROOF_DROP
      cz - (overhang / 2)
    );

    roof.castShadow = SHADOW_ENABLED;
    roof.receiveShadow = false;
    overlayGroup.add(roof);

    // ✅ collage réel sur la panne haute
    snapMeshMinYTo(roof, targetMinY);

    overlayGroup.userData.roof = { type: "mono", roof };

  } else {
    const halfW = widthZ / 2;
    const roofGeoHalf = new THREE.BoxGeometry(lenX, roofThick, halfW);
    const lift = (halfW / 2) * Math.sin(angle);

    const roofPlusZ = new THREE.Mesh(roofGeoHalf, roofMat.clone());
    roofPlusZ.userData.kind = "roof";
    roofPlusZ.rotation.x = +angle;
    roofPlusZ.position.set(
      cx,
      (max.y - roofSink) + lift - ROOF_DROP,
      cz + halfW / 2
    );
    roofPlusZ.castShadow = SHADOW_ENABLED;
    overlayGroup.add(roofPlusZ);

    const roofMinusZ = new THREE.Mesh(roofGeoHalf, roofMat.clone());
    roofMinusZ.userData.kind = "roof";
    roofMinusZ.rotation.x = -angle;
    roofMinusZ.position.set(
      cx,
      (max.y - roofSink) + lift - ROOF_DROP,
      cz - halfW / 2
    );
    roofMinusZ.castShadow = SHADOW_ENABLED;
    overlayGroup.add(roofMinusZ);

    // ✅ collage réel sur la panne haute (même niveau pour les 2 pans)
    snapMeshMinYTo(roofPlusZ, targetMinY);
    snapMeshMinYTo(roofMinusZ, targetMinY);

    overlayGroup.userData.roof = { type: "bi", roofPlusZ, roofMinusZ };
  }


  // ===== BARDAGE =====
  const panelHeight = Math.max(0.2, heightY - CLAD_TOP_GAP);
  const yCenter = min.y + panelHeight / 2;

  const geoLong = new THREE.BoxGeometry(lenX, panelHeight, cladThick);

  const cladA_outer = new THREE.Mesh(geoLong, cladMat.clone());
  cladA_outer.position.set(cx, yCenter, max.z + eps);

  const cladC_outer = new THREE.Mesh(geoLong, cladMat.clone());
  cladC_outer.position.set(cx, yCenter, min.z - eps);

  // Pignons B/D
  let gableShapeB = null;
  let gableShapeD = null;

  if (slopeType === "mono") {
    const deltaH = widthZ * PITCH_RATIO;

    const yLow  = min.y + panelHeight - deltaH;
    const yHigh = min.y + panelHeight;

    const shape = createMonoGableShape(widthZ, min.y, yLow, yHigh);
    const geoGable = new THREE.ShapeGeometry(shape);

    gableShapeB = new THREE.Mesh(geoGable, cladMat.clone());
    gableShapeD = new THREE.Mesh(geoGable, cladMat.clone());

    // Faces : B gauche, D droite
    gableShapeB.rotation.y = -Math.PI / 2;
    gableShapeD.rotation.y = +Math.PI / 2;

    // ✅ FIX pente façade D : on inverse le shape sur D (sinon pente inversée)
    gableShapeD.scale.x = -1;

    const gableOffset = (cladThick / 2) + eps;
    gableShapeB.position.set(min.x - gableOffset, 0, cz);
    gableShapeD.position.set(max.x + gableOffset, 0, cz);

  } else {
    const halfW = widthZ / 2;
    const ridgeH = halfW * PITCH_RATIO;

    const yEave  = min.y + panelHeight - ridgeH;
    const yRidge = min.y + panelHeight;

    const shape = createBiGableShape(widthZ, min.y, yEave, yRidge);
    const geoGable = new THREE.ShapeGeometry(shape);

    gableShapeB = new THREE.Mesh(geoGable, cladMat.clone());
    gableShapeD = new THREE.Mesh(geoGable, cladMat.clone());

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

  // ✅ Pour les pignons (ShapeGeometry), on NE FAIT PAS de double peau
  const isGable = (mesh.geometry?.type === "ShapeGeometry");
  if (isGable) {
    return { outer: mesh, inner: null };
  }

  // ✅ Double peau uniquement pour A/C (BoxGeometry)
  const inner = new THREE.Mesh(mesh.geometry, mesh.material.clone());
  inner.rotation.copy(mesh.rotation);
  inner.position.copy(mesh.position);

  // inward
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

  A.outer.visible = showA; if (A.inner) A.inner.visible = showA;
  B.outer.visible = showB; if (B.inner) B.inner.visible = showB;
  C.outer.visible = showC; if (C.inner) C.inner.visible = showC;
  D.outer.visible = showD; if (D.inner) D.inner.visible = showD;
}


  applyCladdingVisibility();
  overlayGroup.userData.applyCladdingVisibility = applyCladdingVisibility;

  // ===== GROUPE HIGHLIGHTS (habillages) =====
  const highlightGroup = new THREE.Group();
  highlightGroup.userData.kind = "trimHL";
  overlayGroup.add(highlightGroup);
  overlayGroup.userData.highlightGroup = highlightGroup;

  // helpers y sur toiture
  function yOnMonoRoof(z) {
    const r = overlayGroup.userData.roof?.roof;
    if (!r) return max.y;
    // rotation -angle => y = y0 + (z - z0)*tan(angle)
    return r.position.y + (z - r.position.z) * Math.tan(angle);
  }

  function yOnBiRoofPlus(z) {
    const r = overlayGroup.userData.roof?.roofPlusZ;
    if (!r) return max.y;
    // rotation +angle => y = y0 - (z - z0)*tan(angle)
    return r.position.y - (z - r.position.z) * Math.tan(angle);
  }

  function yOnBiRoofMinus(z) {
    const r = overlayGroup.userData.roof?.roofMinusZ;
    if (!r) return max.y;
    // rotation -angle => y = y0 + (z - z0)*tan(angle)
    return r.position.y + (z - r.position.z) * Math.tan(angle);
  }

  function clearHighlights() {
    while (highlightGroup.children.length) {
      const obj = highlightGroup.children.pop();
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }
  }

function addBand(p1, p2, color, radius = 0.045) {
  const curve = new THREE.CatmullRomCurve3([p1, p2]);

  const geom = new THREE.TubeGeometry(
    curve,
    1,          // tubularSegments
    radius,     // épaisseur (augmente pour + visible)
    10,         // radialSegments
    false
  );

  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
    metalness: 0.1,
    roughness: 0.35,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 999;
  highlightGroup.add(mesh);
}


  function applyTrimHighlights() {
    clearHighlights();

    // couleur choisie pour habillages
    const trimColor = getTrimColor3D();

    const isMono = slopeType === "mono";

    const optFaitiereSolin = $("optFaitiereSolin");
    const optRiveSolin = $("optRiveSolin");
    const optGrandeRive = $("optGrandeRive");
    const optAngles = $("optAngles");
    const optRejetEau = $("optRejetEau");
    const optFaitiereDouble = $("optFaitiereDouble");
    const optFaitiereSimple = $("optFaitiereSimple");

    // ---------- FAITIÈRE (arête de faîtage / arête haute) ----------
    // - Faîtière double / simple : ligne entière
    // - Faîtière avec solin : segments selon côté B/D
    const wantFullRidge =
      (!!optFaitiereDouble?.checked && !optFaitiereDouble.disabled) ||
      (!!optFaitiereSimple?.checked && !optFaitiereSimple.disabled);

    const wantRidgeSolin = (!!optFaitiereSolin?.checked && !optFaitiereSolin.disabled);

    if (wantFullRidge || wantRidgeSolin) {
      if (isMono) {
        // arête haute = côté +Z, sur toute la longueur (x)
        const zHigh = max.z + eps * 0.2;
        const yHigh = yOnMonoRoof(max.z) + 0.02;

        if (wantFullRidge) {
          addBand(
            new THREE.Vector3(min.x, yHigh, zHigh),
            new THREE.Vector3(max.x, yHigh, zHigh),
            trimColor
          );
        }

        if (wantRidgeSolin) {
          const seg = Math.min(lenX * 0.25, 2.5);
          const b = $("faitiereSolinSideB")?.checked;
          const d = $("faitiereSolinSideD")?.checked;

          if (b) {
            addBand(
              new THREE.Vector3(min.x, yHigh, zHigh),
              new THREE.Vector3(min.x + seg, yHigh, zHigh),
              trimColor
            );
          }
          if (d) {
            addBand(
              new THREE.Vector3(max.x - seg, yHigh, zHigh),
              new THREE.Vector3(max.x, yHigh, zHigh),
              trimColor
            );
          }
        }

      } else {
        // bipente : faîtage = z=cz
        const zR = cz;
        const yR = yOnBiRoofPlus(cz) + 0.03;

        // en bipente, faîtière solin & simple sont désactivées
        if (wantFullRidge) {
          addBand(
            new THREE.Vector3(min.x, yR, zR),
            new THREE.Vector3(max.x, yR, zR),
            trimColor
          );
        }
      }
    }

    // ---------- RIVES (pignons, extrémités) ----------
    // Rive avec solin / Grande rive : sélection de côté B / D
    const riveB = ($("riveSolinSideB")?.checked) || ($("grandeRiveSideB")?.checked);
    const riveD = ($("riveSolinSideD")?.checked) || ($("grandeRiveSideD")?.checked);

    // seulement si une des 2 options est cochée
    const wantRives = (!!optRiveSolin?.checked) || (!!optGrandeRive?.checked);

    if (wantRives) {
      if (isMono) {
        // Au pignon x=min et x=max : une arête oblique (du bas vers le haut)
        function addMonoGableRakeAtX(x, outwardX) {
          const z1 = min.z - eps * 0.2;
          const z2 = max.z + eps * 0.2;
          const y1 = yOnMonoRoof(min.z) + 0.02;
          const y2 = yOnMonoRoof(max.z) + 0.02;
          addBand(
            new THREE.Vector3(x + outwardX, y1, z1),
            new THREE.Vector3(x + outwardX, y2, z2),
            trimColor
          );
        }
        if (riveB) addMonoGableRakeAtX(min.x, -eps * 0.6);
        if (riveD) addMonoGableRakeAtX(max.x, +eps * 0.6);

      } else {
        // bipente : au pignon, 2 arêtes (eave->ridge) de chaque pan
        function addBiGableRakesAtX(x, outwardX) {
          const yR = yOnBiRoofPlus(cz) + 0.03;

          const yEavePlus = yOnBiRoofPlus(max.z) + 0.02;
          const yEaveMinus = yOnBiRoofMinus(min.z) + 0.02;

          // pan +Z : (x, max.z) -> (x, cz)
          addBand(
            new THREE.Vector3(x + outwardX, yEavePlus, max.z + eps * 0.2),
            new THREE.Vector3(x + outwardX, yR, cz),
            trimColor
          );

          // pan -Z : (x, min.z) -> (x, cz)
          addBand(
            new THREE.Vector3(x + outwardX, yEaveMinus, min.z - eps * 0.2),
            new THREE.Vector3(x + outwardX, yR, cz),
            trimColor
          );
        }

        if (riveB) addBiGableRakesAtX(min.x, -eps * 0.6);
        if (riveD) addBiGableRakesAtX(max.x, +eps * 0.6);
      }
    }

    // ---------- ANGLES (4 coins verticaux) ----------
    if (optAngles?.checked) {
      const y0 = min.y + 0.02;
      const yTop = max.y - 0.02;

      const corners = [
        [min.x - eps * 0.2, min.z - eps * 0.2],
        [min.x - eps * 0.2, max.z + eps * 0.2],
        [max.x + eps * 0.2, min.z - eps * 0.2],
        [max.x + eps * 0.2, max.z + eps * 0.2],
      ];

      corners.forEach(([x, z]) => {
        addBand(
          new THREE.Vector3(x, y0, z),
          new THREE.Vector3(x, yTop, z),
          trimColor
        );
      });
    }

    // ---------- REJET D’EAU (pied de bardage sur façades sélectionnées) ----------
    if (optRejetEau?.checked) {
      const yBase = min.y + 0.03;

      const showA = !!document.querySelector('input[name="claddingSide"][value="A"]:checked');
      const showB = !!document.querySelector('input[name="claddingSide"][value="B"]:checked');
      const showC = !!document.querySelector('input[name="claddingSide"][value="C"]:checked');
      const showD = !!document.querySelector('input[name="claddingSide"][value="D"]:checked');

      if (showA) {
        addBand(
          new THREE.Vector3(min.x, yBase, max.z + eps * 0.6),
          new THREE.Vector3(max.x, yBase, max.z + eps * 0.6),
          trimColor
        );
      }
      if (showC) {
        addBand(
          new THREE.Vector3(min.x, yBase, min.z - eps * 0.6),
          new THREE.Vector3(max.x, yBase, min.z - eps * 0.6),
          trimColor
        );
      }
      if (showB) {
        addBand(
          new THREE.Vector3(min.x - eps * 0.6, yBase, min.z),
          new THREE.Vector3(min.x - eps * 0.6, yBase, max.z),
          trimColor
        );
      }
      if (showD) {
        addBand(
          new THREE.Vector3(max.x + eps * 0.6, yBase, min.z),
          new THREE.Vector3(max.x + eps * 0.6, yBase, max.z),
          trimColor
        );
      }
    }
  }

  // Exposer la fonction highlights à updateOverlayStylesOnly()
  overlayGroup.userData.applyTrimHighlights = applyTrimHighlights;

  // Appliquer tout de suite
  applyTrimHighlights();

  // ===== SCALE SOL + FOND =====
  const radius = Math.max(lenX, widthZ) * 0.9;

  if (groundDisc) {
    groundDisc.geometry.dispose();
    groundDisc.geometry = new THREE.CircleGeometry(radius, 80);
    groundDisc.position.y = min.y - 0.01;
  }

  if (padMesh) {
    padMesh.geometry.dispose();
    padMesh.geometry = new THREE.PlaneGeometry(lenX * 1.05, widthZ * 1.15);
    padMesh.position.y = min.y;
  }

  if (backgroundPlane) {
    backgroundPlane.position.set(cx, min.y + heightY * 0.6, -radius * 1.2);
    backgroundPlane.scale.set(1.3, 1.3, 1);
  }

  // ===== CAMÉRA =====
  if (controls && camera) {
    const center = new THREE.Vector3(cx, min.y + heightY * 0.55, cz);
    controls.target.set(center.x, center.y, center.z);

    const d = Math.max(lenX, widthZ, heightY);
    camera.position.set(
      center.x + d * 1.2,
      center.y + d * 0.9,
      center.z + d * 1.2
    );
  }
}

function updateOverlayStylesOnly() {
  if (!overlayGroup) return;

  const roofColor = getRoofColor3D();
  const cladColor = getCladdingColor3D();

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
    }

    mat.needsUpdate = true;
  });

  overlayGroup.userData?.applyCladdingVisibility?.();
  overlayGroup.userData?.applyTrimHighlights?.();
}

function update3DFromConfig() {
  if (!baseModule) return;
  const bbox = buildStructureFromConfig();
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

  // Type d'abri
  document.querySelectorAll('input[name="slopeType"]').forEach((el) => {
    el.addEventListener("change", () => {
      populateDimensions();
      updateOptionsAvailabilityAndUI();
      loadModelForType(getSelectedType());
      calculatePriceAndRecap();
    });
  });

  ["width", "length", "height"].forEach((id) => {
    $(id)?.addEventListener("change", calculatePriceAndRecap);
  });

  // Livraison
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

  // Toiture
  document.querySelectorAll('input[name="roofType"]').forEach((el) =>
    el.addEventListener("change", calculatePriceAndRecap)
  );

  document.querySelectorAll('input[name="roofColor"]').forEach((el) =>
    el.addEventListener("change", () => {
      calculatePriceAndRecap();
      updateOverlayStylesOnly();
    })
  );

  // Bardage
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

  // Couleur habillages
  document.querySelectorAll('input[name="trimColor"]').forEach((el) =>
    el.addEventListener("change", () => {
      calculatePriceAndRecap();
      updateOverlayStylesOnly();
    })
  );

  // Options (checkbox)
  [
    "optInstall",
    "optFaitiereSolin",
    "optRiveSolin",
    "optGrandeRive",
    "optAngles",
    "optRejetEau",
    "optFaitiereDouble",
    "optFaitiereSimple",
  ].forEach((id) =>
    $(id)?.addEventListener("change", () => {
      updateOptionsAvailabilityAndUI();
      calculatePriceAndRecap();
      updateOverlayStylesOnly();
    })
  );

  // Options (côtés)
  [
    "faitiereSolinSideB", "faitiereSolinSideD",
    "riveSolinSideB", "riveSolinSideD",
    "grandeRiveSideB", "grandeRiveSideD",
  ].forEach((id) =>
    $(id)?.addEventListener("change", () => {
      updateOptionsAvailabilityAndUI();
      calculatePriceAndRecap();
      updateOverlayStylesOnly();
    })
  );

  $("btnCalculate")?.addEventListener("click", calculatePriceAndRecap);

  updateOptionsAvailabilityAndUI();
  calculatePriceAndRecap();
});
