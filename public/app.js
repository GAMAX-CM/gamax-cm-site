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
  bi: {},
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

function $(id) {
  return document.getElementById(id);
}

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
   4) CALCUL PRIX + RÉCAP
---------------------------- */

function calculatePriceAndRecap() {
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

  const claddingType =
    document.querySelector('input[name="claddingType"]:checked')?.value;
  const cladUnit = CLADDING_PRICE_PER_M2[claddingType] ?? 0;
  const claddingCost = claddingArea * cladUnit;

  const optFaitiereSolin = $("optFaitiereSolin");
  const optRiveSolin = $("optRiveSolin");
  const optGrandeRive = $("optGrandeRive");
  const optAngles = $("optAngles");
  const optRejetEau = $("optRejetEau");
  const optFaitiereDouble = $("optFaitiereDouble");
  const optFaitiereSimple = $("optFaitiereSimple");
  const optInstall = $("optInstall");

  let optionsPrice = 0;
  const finishingSelected =
    (optFaitiereSolin?.checked) ||
    (optRiveSolin?.checked) ||
    (optGrandeRive?.checked) ||
    (optAngles?.checked) ||
    (optRejetEau?.checked) ||
    (optFaitiereDouble?.checked) ||
    (optFaitiereSimple?.checked);

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

  const selectedOptions = [];
  if (optFaitiereSolin?.checked) selectedOptions.push("Faîtière avec solin");
  if (optRiveSolin?.checked) selectedOptions.push("Rive avec solin");
  if (optGrandeRive?.checked) selectedOptions.push("Grande rive");
  if (optAngles?.checked) selectedOptions.push("Angles");
  if (optRejetEau?.checked) selectedOptions.push("Rejet d’eau");
  if (optFaitiereDouble?.checked) selectedOptions.push("Faîtière double");
  if (optFaitiereSimple?.checked) selectedOptions.push("Faîtière simple");
  if (optInstall?.checked) selectedOptions.push("Pose par nos équipes");

  let addressText = "";
  if (deliveryMode === "retrait") {
    addressText = "Retrait à l’atelier GAMAX-CM (Tonneins)";
  } else {
    const city = $("city")?.value || "";
    addressText = postalCode ? (postalCode + (city ? (" " + city) : "")) : "Non renseignée";
  }

  let recapText = "Devis abri métallique GAMAX-CM\n\n";
  recapText += "Type d'abri : " + typeLabel + "\n";
  recapText +=
    "Dimensions : " +
    String(width).replace(".", ",") + " m x " +
    String(length).replace(".", ",") + " m, hauteur " +
    String(height).replace(".", ",") + " m\n";
  recapText += "Surface : " + area.toFixed(1).replace(".", ",") + " m²\n\n";

  recapText += "Toiture : " + (ROOF_TYPE_LABELS[roofType] || "Non précisé") + "\n";
  recapText += "Couleur toiture (RAL) : " + roofColor + "\n\n";

  recapText += "Bardage : " + (CLADDING_TYPE_LABELS[claddingType] || "Non précisé") + "\n";
  recapText += "Couleur bardage (RAL) : " + claddingColor + "\n";
  recapText += "Façades bardées : " + claddingAreaText + "\n\n";

  recapText += "Mode : " + (deliveryMode === "retrait" ? "Retrait à Tonneins" : "Livraison sur chantier") + "\n";
  recapText += "Adresse : " + addressText + "\n";
  recapText += "Livraison estimative : " + (deliveryMode === "retrait" ? "0 € HT (retrait)" : (delivery ? formatCurrency(delivery) + " HT" : "À définir")) + "\n\n";

  recapText += "Prix estimatif : " + formatCurrency(totalHT) + " HT soit env. " + formatCurrency(totalTTC) + " TTC\n\n";
  recapText += "Options : " + (selectedOptions.length ? selectedOptions.join(", ") : "Aucune") + "\n\n";
  recapText += "Ce devis est une estimation indicative. Un devis définitif vous sera transmis par GAMAX-CM.\n";

  afficherRecapitulatif(recapText);

  update3DFromConfig();
}

function afficherRecapitulatif(recapText) {
  const el = $("recapDevis");
  if (el) el.textContent = recapText;
  localStorage.setItem("gamax_abri_devis_texte", recapText);
}

window.goToOrderPage = function goToOrderPage() {
  calculatePriceAndRecap();
  window.location.href = "commander.html";
};

/* ---------------------------
   5) THREE.JS — VUE 3D
---------------------------- */

// Textures / assets
const ROOF_TEX_PATH = "assets/texture-bac-acier.jpg";
const CLAD_TEX_PATH = "assets/texture-bac-acier.jpg";
const PAVE_TEX_PATH = "assets/texture-pave-gris.jpg";
const BG_TEX_PATH   = "assets/fond-jardin.jpg";

// Modèle
const MODEL_PATH = "assets/abri-monopente-3x5m.gltf";

// Base module dimensions (m)
const BASE_LENGTH_M = 5;
const BASE_WIDTH_M  = 3;
const BASE_HEIGHT_M = 2.15;

const GLOBAL_SCALE = 2.5;

// Pente + débord (monopente)
const PITCH_RATIO = 0.10;          // 10%
const ROOF_OVERHANG_RATIO = 0.14;  // débord bas de pente (14% largeur)

// Visuel texture (répétition)
const ROOF_TEX_REPEAT_X = 8;
const ROOF_TEX_REPEAT_Z = 2;

const CLAD_TEX_REPEAT_X = 8;
const CLAD_TEX_REPEAT_Y = 3;

// Moins transparent (plus “réaliste”)
const ROOF_OPACITY = 0.92;
const CLAD_OPACITY = 0.92;

// ↓ Décalage vertical de la couverture (rendu “posée”)
const ROOF_DROP = 0.12; // ajuste si besoin (0.08 → 0.18)

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

// Fullscreen helpers
let lastInlineCanvasHeight = 0;

// Utilitaires couleurs RAL depuis les pastilles (CSS)
function getRALColorFromRadio(name) {
  const input = document.querySelector(`input[name="${name}"]:checked`);
  if (!input) return "#666666";
  const box = input.closest(".ral-choice")?.querySelector(".ral-box");
  if (!box) return "#666666";
  return window.getComputedStyle(box).backgroundColor;
}
function getRoofColor3D() { return getRALColorFromRadio("roofColor"); }
function getCladdingColor3D() { return getRALColorFromRadio("claddingColor"); }

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

// Options -> faîtière
function isRidgeSelected() {
  return !!(
    $("optFaitiereSolin")?.checked ||
    $("optFaitiereSimple")?.checked ||
    $("optFaitiereDouble")?.checked
  );
}

function initThree() {
  const canvas = $("viewer3d");
  if (!canvas) return;

  const w = canvas.clientWidth || 420;
  const h = canvas.clientHeight || 320;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f4ee);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
  camera.position.set(8, 5, 10);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(w, h, false);

  // ✅ ombres réalistes
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // lumières
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));

  const dir = new THREE.DirectionalLight(0xffffff, 0.95);
  dir.position.set(10, 20, 10);

  // ✅ shadow tuning
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.bias = -0.0002;

  scene.add(dir);

  // sol
  groundDisc = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshPhongMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  groundDisc.rotation.x = -Math.PI / 2;
  groundDisc.position.y = 0;
  groundDisc.receiveShadow = true; // ✅
  scene.add(groundDisc);

  padMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 3),
    new THREE.MeshPhongMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  padMesh.rotation.x = -Math.PI / 2;
  padMesh.position.y = 0.01;
  padMesh.receiveShadow = true; // ✅
  scene.add(padMesh);

  // controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.5, 0);

  // ✅ limiter les vues “impossibles”
  controls.enablePan = false;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2.05;

  // textures
  const tl = new THREE.TextureLoader();

  // pavés
  tl.load(
    PAVE_TEX_PATH,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 8);
      groundDisc.material.map = tex;
      groundDisc.material.needsUpdate = true;

      const tex2 = tex.clone();
      tex2.wrapS = tex2.wrapT = THREE.RepeatWrapping;
      tex2.repeat.set(4, 4);
      padMesh.material.map = tex2;
      padMesh.material.needsUpdate = true;
    },
    undefined,
    () => {}
  );

  // bac acier toiture
  tl.load(
    ROOF_TEX_PATH,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(ROOF_TEX_REPEAT_X, ROOF_TEX_REPEAT_Z);
      roofTex = tex;
    },
    undefined,
    () => {}
  );

  // bac acier bardage
  tl.load(
    CLAD_TEX_PATH,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(CLAD_TEX_REPEAT_X, CLAD_TEX_REPEAT_Y);
      cladTex = tex;
    },
    undefined,
    () => {}
  );

  // fond
  tl.load(
    BG_TEX_PATH,
    (tex) => {
      const bgGeo = new THREE.PlaneGeometry(40, 15);
      const bgMat = new THREE.MeshBasicMaterial({ map: tex });
      backgroundPlane = new THREE.Mesh(bgGeo, bgMat);
      backgroundPlane.position.set(0, 7, -20);
      scene.add(backgroundPlane);
    },
    undefined,
    () => {}
  );

  // modèle
  const loader = new THREE.GLTFLoader();
  loader.load(
    MODEL_PATH,
    (gltf) => {
      baseModule = gltf.scene;
      baseModule.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.material = obj.material.clone();
        }
      });
      baseBBox = new THREE.Box3().setFromObject(baseModule);
      update3DFromConfig();
    },
    undefined,
    (err) => console.error("Erreur GLTF :", err)
  );

  window.addEventListener("resize", () => setTimeout(onThreeResize, 40));
  animateThree();
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

  const { width, length, height } = getCurrentDimensions();
  const bays = getBayCount(length);
  const bayLengthM = length / bays;

  const baseSize = new THREE.Vector3();
  baseBBox.getSize(baseSize);

  let currentX = 0;

  for (let i = 0; i < bays; i++) {
    const clone = baseModule.clone(true);

    const scaleX = (bayLengthM / BASE_LENGTH_M) * GLOBAL_SCALE;
    const scaleZ = (width / BASE_WIDTH_M) * GLOBAL_SCALE;
    const scaleY = (height / BASE_HEIGHT_M) * GLOBAL_SCALE;

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
  structureGroup.position.sub(center);

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
    roughness: 0.85,
  });

  if (tex) {
    mat.map = tex;
    mat.map.needsUpdate = true;
  }
  return mat;
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
  const heightY = max.y - min.y;
  const eps = 0.02 * Math.max(lenX, widthZ, heightY);

  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;

  // matériaux nervurés + couleurs RAL + faible transparence
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

  // ===== TOITURE =====
  const slopeType = getSelectedType();

  if (slopeType === "mono") {
    // pente 10% : deltaY dépend de la largeur (Z)
    const deltaY = widthZ * PITCH_RATIO;
    const angle = Math.atan(deltaY / widthZ);

    // débord bas de pente (vers -Z)
    const overhang = widthZ * ROOF_OVERHANG_RATIO;

    const roofGeo = new THREE.PlaneGeometry(lenX, widthZ + overhang);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.userData.part = "roof";
    roof.castShadow = true;
    roof.receiveShadow = false;

    // plan horizontal (-PI/2) puis inclinaison (+angle)
    roof.rotation.x = -Math.PI / 2 + angle;

    roof.position.set(
      cx,
      (max.y - ROOF_DROP) + eps - deltaY * 0.15,
      cz - overhang * 0.35
    );

    overlayGroup.add(roof);
  } else {
    // bipente : 2 pans
    const angle = Math.atan(PITCH_RATIO);
    const halfW = widthZ / 2;

    const roofL = new THREE.Mesh(new THREE.PlaneGeometry(lenX, halfW), roofMat.clone());
    roofL.userData.part = "roof";
    roofL.castShadow = true;
    roofL.rotation.x = -Math.PI / 2 + angle;
    roofL.position.set(cx, (max.y - ROOF_DROP) + eps, cz - halfW / 2);
    overlayGroup.add(roofL);

    const roofR = new THREE.Mesh(new THREE.PlaneGeometry(lenX, halfW), roofMat.clone());
    roofR.userData.part = "roof";
    roofR.castShadow = true;
    roofR.rotation.x = -Math.PI / 2 - angle;
    roofR.position.set(cx, (max.y - ROOF_DROP) + eps, cz + halfW / 2);
    overlayGroup.add(roofR);
  }

  // ===== FAÎTIÈRE (option) =====
  if (isRidgeSelected()) {
    const ridgeMat = materialWithTexture({
      color: getRoofColor3D(),
      tex: roofTex,
      opacity: 1,
    });

    const ridgeHeight = Math.max(0.04, heightY * 0.03);
    const ridgeWidth  = Math.max(0.06, widthZ * 0.03);

    if (getSelectedType() === "bi") {
      // faîtière au centre
      const geo = new THREE.BoxGeometry(lenX * 0.98, ridgeHeight, ridgeWidth);
      const ridge = new THREE.Mesh(geo, ridgeMat);
      ridge.userData.part = "roof"; // ✅ pour suivre couleur toiture
      ridge.position.set(cx, (max.y - ROOF_DROP) + eps + ridgeHeight * 0.6, cz);
      ridge.castShadow = true;
      ridge.receiveShadow = true;
      overlayGroup.add(ridge);
    } else {
      // ✅ MONOPENTE : haut de toiture côté façade A
      // Dans ton repère actuel : Façade A = +Z = max.z
      const zHigh = max.z;

      const geo = new THREE.BoxGeometry(lenX * 0.98, ridgeHeight, ridgeWidth);
      const ridge = new THREE.Mesh(geo, ridgeMat);
      ridge.userData.part = "roof";
      ridge.position.set(cx, (max.y - ROOF_DROP) + eps + ridgeHeight * 0.6, zHigh);
      ridge.castShadow = true;
      ridge.receiveShadow = true;
      overlayGroup.add(ridge);
    }
  }

  // ===== BARDAGE (plans) =====
  const geoLong = new THREE.PlaneGeometry(lenX, heightY);
  const geoShort = new THREE.PlaneGeometry(widthZ, heightY);

  const cladA = new THREE.Mesh(geoLong, cladMat.clone());
  cladA.userData.part = "cladding";
  cladA.castShadow = true;
  cladA.receiveShadow = false;
  cladA.position.set(cx, (min.y + max.y) / 2, max.z + eps);
  overlayGroup.add(cladA);

  const cladC = new THREE.Mesh(geoLong, cladMat.clone());
  cladC.userData.part = "cladding";
  cladC.castShadow = true;
  cladC.receiveShadow = false;
  cladC.position.set(cx, (min.y + max.y) / 2, min.z - eps);
  cladC.rotation.y = Math.PI;
  overlayGroup.add(cladC);

  const cladB = new THREE.Mesh(geoShort, cladMat.clone());
  cladB.userData.part = "cladding";
  cladB.castShadow = true;
  cladB.receiveShadow = false;
  cladB.position.set(min.x - eps, (min.y + max.y) / 2, cz);
  cladB.rotation.y = Math.PI / 2;
  overlayGroup.add(cladB);

  const cladD = new THREE.Mesh(geoShort, cladMat.clone());
  cladD.userData.part = "cladding";
  cladD.castShadow = true;
  cladD.receiveShadow = false;
  cladD.position.set(max.x + eps, (min.y + max.y) / 2, cz);
  cladD.rotation.y = -Math.PI / 2;
  overlayGroup.add(cladD);

  function applyCladdingVisibility() {
    cladA.visible = !!document.querySelector('input[name="claddingSide"][value="A"]:checked');
    cladB.visible = !!document.querySelector('input[name="claddingSide"][value="B"]:checked');
    cladC.visible = !!document.querySelector('input[name="claddingSide"][value="C"]:checked');
    cladD.visible = !!document.querySelector('input[name="claddingSide"][value="D"]:checked');
  }
  applyCladdingVisibility();

  overlayGroup.userData = { applyCladdingVisibility };

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

  // ===== CAMÉRA + LIMITES =====
  if (controls && camera) {
    const center = new THREE.Vector3(cx, (min.y + max.y) / 2, cz);
    controls.target.set(center.x, center.y * 0.7, center.z);

    camera.position.set(
      center.x + lenX * 0.9,
      center.y + heightY * 1.1,
      center.z + widthZ * 1.0
    );

    // ✅ distances limites (adaptatives)
    const size = Math.max(lenX, widthZ, heightY);
    controls.minDistance = size * 0.6;
    controls.maxDistance = size * 3.0;
  }
}

function updateOverlayStylesOnly() {
  if (!overlayGroup) return;

  const roofColor = getRoofColor3D();
  const cladColor = getCladdingColor3D();
  const showRidge = isRidgeSelected();

  overlayGroup.traverse((obj) => {
    if (!obj.isMesh) return;
    const mat = obj.material;
    if (!mat || Array.isArray(mat)) return;

    if (obj.userData.part === "roof") {
      mat.color.set(roofColor);
      mat.opacity = (obj.geometry?.type === "BoxGeometry") ? 1 : ROOF_OPACITY; // faîtière opaque
      if (roofTex) mat.map = roofTex;
      obj.visible = obj.geometry?.type === "BoxGeometry" ? showRidge : true; // faîtière on/off
    } else {
      mat.color.set(cladColor);
      mat.opacity = CLAD_OPACITY;
      if (cladTex) mat.map = cladTex;
    }
    mat.needsUpdate = true;
  });

  overlayGroup.userData?.applyCladdingVisibility?.();
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

  if (!wrapper || !canvas || !btnFS) return;

  const toolbar = wrapper.querySelector(".viewer-toolbar");

  function setToolbarVisible(visible) {
    if (!toolbar) return;
    toolbar.style.display = visible ? "flex" : "none";
  }

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
    setToolbarVisible(true);
    setTimeout(resize3D, 80);
  });

  btnClose?.addEventListener("click", () => {
    wrapper.classList.remove("is-fullscreen");
    setToolbarVisible(false);
    setTimeout(resize3D, 80);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (wrapper.classList.contains("is-fullscreen")) {
        wrapper.classList.remove("is-fullscreen");
        setToolbarVisible(false);
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
  setTimeout(() => {
    setToolbarVisible(false);
    resize3D();
  }, 180);
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

  document.querySelectorAll('input[name="slopeType"]').forEach((el) => {
    el.addEventListener("change", () => {
      populateDimensions();
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
      calculatePriceAndRecap();
      updateOverlayStylesOnly(); // ✅ faîtière on/off + couleurs
    })
  );

  $("btnCalculate")?.addEventListener("click", calculatePriceAndRecap);

  calculatePriceAndRecap();
});
