/* ================================
   CONFIGURATEUR GAMAX-CM – app.js
   (index.html)
================================== */

/* ---- DIMENSIONS AUTORISÉES ---- */
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

/* ---- TARIFS (structure + couvertures + bardage) ---- */
const STRUCTURE_PRICE_TABLE = {
  mono: {
    "3x3": 740,
    "3x4": 790,
    "3x5": 840,
    "3x6": 890,
    "3x8": 1360,
    "3x10": 1460,
    "3x12": 1560,
    "3x15": 2050,
    "3x18": 2190,
    "3x20": 2630,
    "3x24": 2830,
    "3x25": 3220,
    "3x30": 3470,

    "4x3": 780,
    "4x4": 830,
    "4x5": 880,
    "4x6": 930,
    "4x8": 1410,
    "4x10": 1510,
    "4x12": 1610,
    "4x15": 2130,
    "4x18": 2270,
    "4x20": 2730,
    "4x24": 2920,
    "4x25": 3340,
    "4x30": 3580,

    "5x3": 900,
    "5x4": 980,
    "5x5": 1060,
    "5x6": 1150,
    "5x8": 1470,
    "5x10": 1570,
    "5x12": 1670,
    "5x15": 2190,
    "5x18": 2340,
    "5x20": 2810,
    "5x24": 3000,
    "5x25": 3440,
    "5x30": 3680,

    "6x3": 950,
    "6x4": 1030,
    "6x5": 1110,
    "6x6": 1190,
    "6x8": 1560,
    "6x10": 1660,
    "6x12": 1750,
    "6x15": 2330,
    "6x18": 2480,
    "6x20": 2980,
    "6x24": 3180,
    "6x25": 3640,
    "6x30": 3880,
  },
  bi: {
    // à remplir plus tard si besoin
  },
};

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
  finishingPerM2: 8,  // habillages, rejet d’eau, etc.
  installPerM2: 35,   // pose
};

const TVA_RATE = 0.2;

/* ---- LABELS ---- */
const ROOF_TYPE_LABELS = {
  bac_simple: "Bac acier simple",
  bac_regul: "Bac acier avec régulateur de condensation",
  sandwich40: "Panneau sandwich ép. 40 mm",
};

const CLADDING_TYPE_LABELS = {
  bac_simple: "Bac acier simple",
  sandwich40: "Bardage panneau sandwich ép. 40 mm",
};

/* =========================================
   UTILITAIRES
========================================= */
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

function populateSelect(selectEl, values) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  values.forEach((val, index) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val.toString().replace(".", ",") + " m";
    if (index === 0) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function populateDimensions() {
  const type = getSelectedType();
  const cfg = DIMENSIONS[type];
  if (!cfg) return;

  populateSelect(document.getElementById("width"), cfg.widths);
  populateSelect(document.getElementById("length"), cfg.lengths);
  populateSelect(document.getElementById("height"), cfg.heights);
}

/* ====== LIVRAISON / VILLES ====== */

function getDeliveryMode() {
  const mode = document.querySelector('input[name="deliveryMode"]:checked');
  return mode ? mode.value : "livraison";
}

function getDeliveryPrice(postalCode, mode) {
  if (mode === "retrait") return 0; // retrait atelier = 0 €

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
  const cpInput = document.getElementById("postalCode");
  const citySelect = document.getElementById("city");
  if (!cpInput || !citySelect) return;

  const cp = cpInput.value.trim();
  citySelect.innerHTML = "";

  if (cp.length !== 5) {
    citySelect.innerHTML =
      "<option value=''>Sélectionnez votre ville après saisie du code postal</option>";
    return;
  }

  const cities = await fetchCitiesFromAPI(cp);
  if (cities.length === 0) {
    citySelect.innerHTML = "<option value=''>Aucune ville trouvée</option>";
    return;
  }

  cities.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    citySelect.appendChild(opt);
  });

  if (cities.length === 1) citySelect.value = cities[0];
}

/* =========================================
   CALCUL PRIX + TEXTE DEVIS
========================================= */

function calculatePriceAndRecap() {
  const widthEl = document.getElementById("width");
  const lengthEl = document.getElementById("length");
  const heightEl = document.getElementById("height");
  if (!widthEl || !lengthEl || !heightEl) return;

  const type = getSelectedType();
  const width = parseFloat(widthEl.value);
  const length = parseFloat(lengthEl.value);
  const height = parseFloat(heightEl.value);
  if (!width || !length || !height) return;

  const area = width * length;
  const sizeKey = width + "x" + length;

  let structureBase = STRUCTURE_PRICE_TABLE[type]?.[sizeKey] ?? 0;

  // Surcoût hauteur > 3 m
  if (height > 3) {
    const extra = height - 3;
    const steps = extra / 0.5;
    structureBase *= 1 + steps * 0.1;
  }

  // Toiture
  const roofType =
    document.querySelector('input[name="roofType"]:checked')?.value;
  const roofUnit = ROOF_PRICE_PER_M2[roofType] ?? 0;
  const roofCost = area * roofUnit;

  // Bardage
  let claddingArea = 0;
  const claddings = document.querySelectorAll(
    'input[name="claddingSide"]:checked'
  );
  claddings.forEach((el) => {
    if (el.value === "A" || el.value === "C")
      claddingArea += length * height;
    else claddingArea += width * height;
  });

  const claddingType =
    document.querySelector('input[name="claddingType"]:checked')?.value;
  const cladUnit = CLADDING_PRICE_PER_M2[claddingType] ?? 0;
  const claddingCost = claddingArea * cladUnit;

  // Options
  const optFaitiereSolin = document.getElementById("optFaitiereSolin");
  const optRiveSolin = document.getElementById("optRiveSolin");
  const optGrandeRive = document.getElementById("optGrandeRive");
  const optAngles = document.getElementById("optAngles");
  const optRejetEau = document.getElementById("optRejetEau");
  const optFaitiereDouble = document.getElementById("optFaitiereDouble");
  const optFaitiereSimple = document.getElementById("optFaitiereSimple");
  const optInstall = document.getElementById("optInstall");

  let optionsPrice = 0;
  const finishingSelected =
    (optFaitiereSolin && optFaitiereSolin.checked) ||
    (optRiveSolin && optRiveSolin.checked) ||
    (optGrandeRive && optGrandeRive.checked) ||
    (optAngles && optAngles.checked) ||
    (optRejetEau && optRejetEau.checked) ||
    (optFaitiereDouble && optFaitiereDouble.checked) ||
    (optFaitiereSimple && optFaitiereSimple.checked);

  if (finishingSelected) {
    optionsPrice += area * OPTIONS_PRICES.finishingPerM2;
  }
  if (optInstall && optInstall.checked) {
    optionsPrice += area * OPTIONS_PRICES.installPerM2;
  }

  // Livraison / retrait
  const postalCodeEl = document.getElementById("postalCode");
  const postalCode = postalCodeEl ? postalCodeEl.value.trim() : "";
  const mode = getDeliveryMode();
  const delivery = getDeliveryPrice(postalCode, mode);

  let totalHT =
    structureBase + roofCost + claddingCost + optionsPrice + delivery;
  totalHT = Math.round(totalHT / 50) * 50;
  const totalTTC = Math.round((totalHT * (1 + TVA_RATE)) / 10) * 10;

  /* -------- TEXTE RÉCAP -------- */
  const typeLabel = type === "bi" ? "Abris bipente" : "Abris monopente";

  const claddingChecked = Array.from(claddings);
  const claddingCount = claddingChecked.length;

  let claddingAreaText = "";
  if (claddingCount === 0) {
    claddingAreaText =
      "Abris ouvert (sans bardage) – 0 m² de bardage calculé";
  } else {
    const codes = claddingChecked.map((c) => c.value);
    const sides = codes.map(
      (code) => FACADE_LABELS[code] || "Façade " + code
    );
    claddingAreaText =
      claddingCount +
      " façade(s) bardée(s) : " +
      sides.join(", ") +
      " – env. " +
      claddingArea.toFixed(1) +
      " m² de bardage";
  }

  const roofColor = document.querySelector(
    'input[name="roofColor"]:checked'
  )?.value;

  const claddingColorInput = document.querySelector(
    'input[name="claddingColor"]:checked'
  );
  const claddingColor = claddingColorInput
    ? claddingColorInput.value
    : "Non précisé";

  const selectedOptions = [];
  if (finishingSelected) selectedOptions.push("Habillages de finition");
  if (optFaitiereSolin && optFaitiereSolin.checked)
    selectedOptions.push("Faîtière avec solin");
  if (optRiveSolin && optRiveSolin.checked)
    selectedOptions.push("Rive avec solin");
  if (optGrandeRive && optGrandeRive.checked)
    selectedOptions.push("Grande rive");
  if (optAngles && optAngles.checked)
    selectedOptions.push("Angles de bardage");
  if (optRejetEau && optRejetEau.checked)
    selectedOptions.push("Rejet d’eau");
  if (optFaitiereDouble && optFaitiereDouble.checked)
    selectedOptions.push("Faîtière double");
  if (optFaitiereSimple && optFaitiereSimple.checked)
    selectedOptions.push("Faîtière simple");
  if (optInstall && optInstall.checked)
    selectedOptions.push("Pose par nos équipes");

  const cityEl = document.getElementById("city");
  let addressText = "Non renseignée";
  let deliveryText = "";

  if (mode === "retrait") {
    addressText = "Retrait à l’atelier GAMAX-CM – 47400 Tonneins";
    deliveryText = "Retrait sur place (0 €)";
  } else {
    addressText = postalCode
      ? postalCode + (cityEl && cityEl.value ? " " + cityEl.value : "")
      : "Non renseignée";
    deliveryText = delivery
      ? formatCurrency(delivery) + " HT (livraison estimative)"
      : "À définir";
  }

  let recapText = "Devis abri métallique GAMAX-CM\n\n";

  recapText += "Type d'abri : " + typeLabel + "\n";
  recapText +=
    "Dimensions : " +
    width.toString().replace(".", ",") +
    " m x " +
    length.toString().replace(".", ",") +
    " m, hauteur " +
    height.toString().replace(".", ",") +
    " m\n\n";

  recapText +=
    "Toiture : " +
    (ROOF_TYPE_LABELS[roofType] || "Non précisé") +
    "\n";
  recapText +=
    "Couleur de toiture (RAL) : " +
    (roofColor || "Non précisée") +
    "\n\n";

  recapText +=
    "Bardage : " +
    (CLADDING_TYPE_LABELS[claddingType] || "Non précisé") +
    "\n";
  recapText +=
    "Couleur de bardage (RAL) : " +
    claddingColor +
    "\n";
  recapText += "Façades bardées : " + claddingAreaText + "\n\n";

  recapText += "Adresse / mode : " + addressText + "\n";
  recapText += "Livraison / retrait : " + deliveryText + "\n\n";

  recapText +=
    "Options sélectionnées : " +
    (selectedOptions.length > 0
      ? selectedOptions.join(", ")
      : "Aucune option") +
    "\n\n";

  recapText +=
    "Prix estimatif : " +
    formatCurrency(totalHT) +
    " HT soit env. " +
    formatCurrency(totalTTC) +
    " TTC\n\n";

  recapText +=
    "Ce devis est une estimation indicative. Un devis définitif vous sera transmis par GAMAX-CM.\n";

  const recapEl = document.getElementById("recapDevis");
  if (recapEl) {
    recapEl.textContent = recapText;
  }
  localStorage.setItem("gamax_abri_devis_texte", recapText);

  // met à jour la 3D
  update3DFromConfig();
}

/* ---- bouton commander ---- */
function goToOrderPage() {
  calculatePriceAndRecap();
  window.location.href = "commander.html";
}
window.goToOrderPage = goToOrderPage;

/* =========================================
   THREE.JS – VUE 3D
========================================= */

let scene, camera, renderer, controls;
let baseModule = null;
let baseBBox = null;
let structureGroup = null;
let overlayGroup = null;
let roofMesh = null;
let groundDisc = null;
let padMesh = null;
let backgroundPlane = null;
const cladMeshes = { A: null, B: null, C: null, D: null };

const MODEL_PATH = "assets/abri-monopente-3x5m.gltf";
const PAVE_TEXTURE_PATH = "assets/texture-pave-gris.jpg";

// Module de base (en mètres)
const BASE_LENGTH_M = 5;   // X
const BASE_WIDTH_M = 3;    // Z
const BASE_HEIGHT_M = 2.15;
const GLOBAL_SCALE = 2.5;

function initThree() {
  const canvas = document.getElementById("viewer3d");
  if (!canvas || !window.THREE) return;

  const width = canvas.clientWidth || 400;
  const height = canvas.clientHeight || (width * 3) / 4;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(8, 5, 10);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height);

  const amb = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  // Disque sol
  const discGeo = new THREE.CircleGeometry(5, 64);
  const discMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  groundDisc = new THREE.Mesh(discGeo, discMat);
  groundDisc.rotation.x = -Math.PI / 2;
  groundDisc.position.y = 0;
  scene.add(groundDisc);

  // Dalle sous l’abri
  const padGeo = new THREE.PlaneGeometry(4, 3);
  const padMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  padMesh = new THREE.Mesh(padGeo, padMat);
  padMesh.rotation.x = -Math.PI / 2;
  padMesh.position.y = 0.01;
  scene.add(padMesh);

  // Texture pavée
  const paveLoader = new THREE.TextureLoader();
  paveLoader.load(
    PAVE_TEXTURE_PATH,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 8);
      groundDisc.material.map = tex;
      groundDisc.material.needsUpdate = true;

      const tex2 = tex.clone();
      tex2.repeat.set(4, 4);
      padMesh.material.map = tex2;
      padMesh.material.needsUpdate = true;
    },
    undefined,
    () => {}
  );

  // Fond
  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    "assets/fond-jardin.jpg",
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

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.5, 0);

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
    (error) => {
      console.error("Erreur chargement GLTF :", error);
    }
  );

  window.addEventListener("resize", onThreeResize);
  animateThree();
}

function onThreeResize() {
  const canvas = document.getElementById("viewer3d");
  if (!canvas || !renderer || !camera) return;
  const width = canvas.clientWidth || 400;
  const height = canvas.clientHeight || (width * 3) / 4;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animateThree() {
  requestAnimationFrame(animateThree);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/* ---- COULEURS 3D ---- */
function getRALColorFromRadio(name) {
  const input = document.querySelector(`input[name="${name}"]:checked`);
  if (!input) return "#666666";
  const box = input.closest(".ral-choice")?.querySelector(".ral-box");
  if (!box) return "#666666";
  return window.getComputedStyle(box).backgroundColor;
}

function getRoofColor3D() {
  return getRALColorFromRadio("roofColor");
}

function getCladdingColor3D() {
  return getRALColorFromRadio("claddingColor");
}

/* ---- DIMENSIONS COURANTES ---- */
function getCurrentDimensions() {
  const widthSel = document.getElementById("width");
  const lengthSel = document.getElementById("length");
  const heightSel = document.getElementById("height");
  const width = parseFloat(widthSel?.value || "3");
  const length = parseFloat(lengthSel?.value || "3");
  const height = parseFloat(heightSel?.value || "2.15");
  return { width, length, height };
}

function getBayCount(length) {
  if (length <= 6) return 1;
  if (length <= 12) return 2;
  if (length <= 18) return 3;
  if (length <= 24) return 4;
  return 6;
}

/* ---- STRUCTURE À PARTIR DU MODULE ---- */
function buildStructureFromConfig() {
  if (!baseModule || !baseBBox) return null;

  if (structureGroup) {
    scene.remove(structureGroup);
  }
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

/* ---- TOIT + BARDAGE SEMI-OPAQUE ---- */
function rebuildOverlays(bbox) {
  if (!bbox) return;

  if (overlayGroup) {
    scene.remove(overlayGroup);
  }
  overlayGroup = new THREE.Group();
  scene.add(overlayGroup);

  const min = bbox.min;
  const max = bbox.max;

  const lenX = max.x - min.x;
  const widthZ = max.z - min.z;
  const heightY = max.y - min.y;
  const eps = 0.02 * Math.max(lenX, widthZ, heightY);

  const roofMat = new THREE.MeshStandardMaterial({
    color: getRoofColor3D(),
    transparent: true,
    opacity: 0.85,          // moins transparent
    side: THREE.DoubleSide,
  });

  const claddingMat = new THREE.MeshStandardMaterial({
    color: getCladdingColor3D(),
    transparent: true,
    opacity: 0.9,           // moins transparent
    side: THREE.DoubleSide,
  });

  // Toiture
  const roofGeo = new THREE.PlaneGeometry(lenX, widthZ);
  roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.rotation.x = -Math.PI / 2;
  roofMesh.position.set(
    (min.x + max.x) / 2,
    max.y + eps,
    (min.z + max.z) / 2
  );
  overlayGroup.add(roofMesh);

  // Façades
  const geoLong = new THREE.PlaneGeometry(lenX, heightY);
  cladMeshes.A = new THREE.Mesh(geoLong, claddingMat.clone());
  cladMeshes.A.position.set(
    (min.x + max.x) / 2,
    (min.y + max.y) / 2,
    max.z + eps
  );
  overlayGroup.add(cladMeshes.A);

  cladMeshes.C = new THREE.Mesh(geoLong, claddingMat.clone());
  cladMeshes.C.position.set(
    (min.x + max.x) / 2,
    (min.y + max.y) / 2,
    min.z - eps
  );
  cladMeshes.C.rotation.y = Math.PI;
  overlayGroup.add(cladMeshes.C);

  const geoShort = new THREE.PlaneGeometry(widthZ, heightY);
  cladMeshes.B = new THREE.Mesh(geoShort, claddingMat.clone());
  cladMeshes.B.position.set(
    min.x - eps,
    (min.y + max.y) / 2,
    (min.z + max.z) / 2
  );
  cladMeshes.B.rotation.y = Math.PI / 2;
  overlayGroup.add(cladMeshes.B);

  cladMeshes.D = new THREE.Mesh(geoShort, claddingMat.clone());
  cladMeshes.D.position.set(
    max.x + eps,
    (min.y + max.y) / 2,
    (min.z + max.z) / 2
  );
  cladMeshes.D.rotation.y = -Math.PI / 2;
  overlayGroup.add(cladMeshes.D);

  // Sol + fond
  const radius = Math.max(lenX, widthZ) * 0.9;
  if (groundDisc) {
    groundDisc.geometry.dispose();
    groundDisc.geometry = new THREE.CircleGeometry(radius, 80);
    groundDisc.position.y = min.y - 0.01;
  }

  if (padMesh) {
    const padLength = lenX * 1.05;
    const padWidth = widthZ * 1.15;
    padMesh.geometry.dispose();
    padMesh.geometry = new THREE.PlaneGeometry(padLength, padWidth);
    padMesh.position.y = min.y;
  }

  if (backgroundPlane) {
    backgroundPlane.position.set(
      (min.x + max.x) / 2,
      min.y + heightY * 0.6,
      -radius * 1.2
    );
    backgroundPlane.scale.set(1.3, 1.3, 1);
  }

  if (controls && camera) {
    const center = new THREE.Vector3(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2
    );
    controls.target.set(center.x, center.y * 0.7, center.z);
    camera.position.set(
      center.x + lenX * 0.9,
      center.y + heightY * 1.1,
      center.z + widthZ * 1.0
    );
  }

  updateOverlayStyles();
}

function updateOverlayStyles() {
  const cladColor = getCladdingColor3D();
  const roofColor = getRoofColor3D();

  if (roofMesh) {
    roofMesh.material.color.set(roofColor);
  }

  ["A", "B", "C", "D"].forEach((side) => {
    const cb = document.querySelector(
      `input[name="claddingSide"][value="${side}"]`
    );
    const mesh = cladMeshes[side];
    if (!mesh) return;
    mesh.visible = !!(cb && cb.checked);
    mesh.material.color.set(cladColor);
  });
}

function update3DFromConfig() {
  if (!baseModule) return;
  const bbox = buildStructureFromConfig();
  rebuildOverlays(bbox);
}

/* ---- ZOOM BOUTONS ---- */
function zoom3D(factor) {
  if (!camera || !controls) return;
  const dir = new THREE.Vector3();
  dir.subVectors(camera.position, controls.target);
  dir.multiplyScalar(factor);
  camera.position.copy(controls.target).add(dir);
}

/* ---- PLEIN ÉCRAN / TOOLBAR ---- */
function initViewerUI() {
  const wrapper = document.getElementById("viewer3d-wrapper");
  const btnFull = document.getElementById("btnFullscreen3D");
  const btnClose = document.getElementById("btnClose3D");
  const btnZoomIn = document.getElementById("btnZoomIn3D");
  const btnZoomOut = document.getElementById("btnZoomOut3D");

  if (btnFull && wrapper) {
    btnFull.addEventListener("click", () => {
      wrapper.classList.add("is-fullscreen");
      onThreeResize();
    });
  }
  if (btnClose && wrapper) {
    btnClose.addEventListener("click", () => {
      wrapper.classList.remove("is-fullscreen");
      onThreeResize();
    });
  }
  if (btnZoomIn) {
    btnZoomIn.addEventListener("click", () => zoom3D(0.8));
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener("click", () => zoom3D(1.25));
  }
}

/* =========================================
   INIT GLOBAL
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  // dimensions + calcul initial
  populateDimensions();
  calculatePriceAndRecap();

  // type d’abri
  document
    .querySelectorAll('input[name="slopeType"]')
    .forEach((el) =>
      el.addEventListener("change", () => {
        populateDimensions();
        calculatePriceAndRecap();
      })
    );

  // champs principaux
  [
    "width",
    "length",
    "height",
    "postalCode",
    "city",
    "optInstall",
    "optFaitiereSolin",
    "optRiveSolin",
    "optGrandeRive",
    "optAngles",
    "optRejetEau",
    "optFaitiereDouble",
    "optFaitiereSimple",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", calculatePriceAndRecap);
      el.addEventListener("input", calculatePriceAndRecap);
    }
  });

  // mode livraison / retrait
  document
    .querySelectorAll('input[name="deliveryMode"]')
    .forEach((el) =>
      el.addEventListener("change", calculatePriceAndRecap)
    );

  // couleurs toit / bardage
  document
    .querySelectorAll('input[name="roofColor"]')
    .forEach((el) =>
      el.addEventListener("change", () => {
        updateOverlayStyles();
        calculatePriceAndRecap();
      })
    );

  document
    .querySelectorAll('input[name="claddingColor"]')
    .forEach((el) =>
      el.addEventListener("change", () => {
        updateOverlayStyles();
        calculatePriceAndRecap();
      })
    );

  // côtés bardés
  document
    .querySelectorAll('input[name="claddingSide"]')
    .forEach((el) =>
      el.addEventListener("change", () => {
        updateOverlayStyles();
        calculatePriceAndRecap();
      })
    );

  // bouton calculer
  const btnCalc = document.getElementById("btnCalculate");
  if (btnCalc) btnCalc.addEventListener("click", calculatePriceAndRecap);

  // code postal -> villes
  const postalCodeEl = document.getElementById("postalCode");
  if (postalCodeEl) {
    postalCodeEl.addEventListener("input", () => {
      updateCityOptions();
      calculatePriceAndRecap();
    });
  }

  // 3D
  initThree();
  initViewerUI();
});
/* =========================================================
   VUE 3D GAMAX-CM – abri simple + couleurs toiture/bardage
   (à coller tout en bas de script.js)
========================================================= */
(function () {
  // Sécurité : si Three.js n'est pas chargé ou pas de canvas, on sort.
  const canvas = document.getElementById("viewer3d");
  if (!canvas || typeof THREE === "undefined") return;

  let scene, camera, renderer, controls;
  let shedGroup = null;
  let bodyMesh = null;
  let roofMesh = null;

  const wrapper = document.getElementById("viewer3d-wrapper");
  const btnFull = document.getElementById("btnFullscreen3D");
  const btnClose = document.getElementById("btnClose3D");
  const btnZoomIn = document.getElementById("btnZoomIn3D");
  const btnZoomOut = document.getElementById("btnZoomOut3D");

  // --------- Utils pour récupérer les valeurs du configurateur ---------
  function getSelectNumber(id, fallback) {
    const el = document.getElementById(id);
    if (!el || !el.value) return fallback;
    const v = parseFloat(el.value.replace(",", "."));
    return isNaN(v) ? fallback : v;
  }

  function getCheckedRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : "";
  }

  function getRALColorFromRadio(name) {
    const input = document.querySelector(`input[name="${name}"]:checked`);
    if (!input) return "#888888";
    const box = input.closest(".ral-choice")?.querySelector(".ral-box");
    if (!box) return "#888888";
    return window.getComputedStyle(box).backgroundColor; // "rgb(...)"
  }

  function cssColorToThree(colorStr) {
    // accepte "rgb(r,g,b)" ou "#xxxxxx"
    try {
      return new THREE.Color(colorStr);
    } catch {
      return new THREE.Color("#888888");
    }
  }

  // --------- Initialisation Three.js ---------
  function initThree() {
    const width = canvas.clientWidth || 300;
    const height = canvas.clientHeight || 220;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f0e8); // beige clair

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(8, 5, 10);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);

    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    // Sol simple
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshPhongMaterial({
      color: 0xe3d5bd,
      side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.5, 0);

    window.addEventListener("resize", onResize);
    animate();

    // Premier build
    rebuildFromConfig();
  }

  function onResize() {
    if (!renderer || !camera) return;
    const width = canvas.clientWidth || 300;
    const height = canvas.clientHeight || 220;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  // --------- Construction de l’abri 3D ---------
  function rebuildFromConfig() {
    const largeur = getSelectNumber("width", 3);   // m
    const longueur = getSelectNumber("length", 5); // m
    const hauteur = getSelectNumber("height", 2.15); // m

    const roofColorCSS = getRALColorFromRadio("roofColor");
    const claddingColorCSS = getRALColorFromRadio("claddingColor");
    const roofColor = cssColorToThree(roofColorCSS);
    const claddingColor = cssColorToThree(claddingColorCSS);

    // Supprime l’ancien groupe
    if (shedGroup) {
      scene.remove(shedGroup);
      shedGroup.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
    }

    shedGroup = new THREE.Group();

    // Corps de l’abri (volume bardé)
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: claddingColor,
      transparent: true,
      opacity: 0.9, // moins transparent
      metalness: 0.2,
      roughness: 0.6,
    });
    bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.5;
    shedGroup.add(bodyMesh);

    // Toiture (panneau)
    const roofGeo = new THREE.PlaneGeometry(1.1, 1.1);
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9, // moins transparent
      metalness: 0.3,
      roughness: 0.4,
    });
    roofMesh = new THREE.Mesh(roofGeo, roofMat);

    // Légère pente
    roofMesh.rotation.x = -Math.PI / 3.5;
    roofMesh.position.y = 1.05;
    shedGroup.add(roofMesh);

    // Mise à l’échelle en fonction des dimensions (facteur visuel)
    const SCALE = 0.4;
    // On considère X = longueur, Y = hauteur, Z = largeur
    shedGroup.scale.set(longueur * SCALE, hauteur * SCALE, largeur * SCALE);

    // Centre l’abri
    const box = new THREE.Box3().setFromObject(shedGroup);
    const center = box.getCenter(new THREE.Vector3());
    shedGroup.position.sub(center);

    // Ajuste la caméra pour bien cadrer
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length() * 0.7;
    const dist = radius / Math.sin((Math.PI * camera.fov) / 360);

    camera.position.set(dist, dist * 0.6, dist);
    controls.target.set(0, size.y * 0.4, 0);
    controls.update();

    scene.add(shedGroup);
  }

  function updateColorsOnly() {
    if (!bodyMesh || !roofMesh) return;
    const roofColorCSS = getRALColorFromRadio("roofColor");
    const claddingColorCSS = getRALColorFromRadio("claddingColor");
    bodyMesh.material.color.set(cssColorToThree(claddingColorCSS));
    roofMesh.material.color.set(cssColorToThree(roofColorCSS));
  }

  // --------- Plein écran & zoom ---------
  function enableFullscreen() {
    if (!wrapper) return;
    wrapper.classList.add("fullscreen-3d");
    onResize();
  }
  function disableFullscreen() {
    if (!wrapper) return;
    wrapper.classList.remove("fullscreen-3d");
    onResize();
  }

  function zoom(factor) {
    // on rapproche / éloigne la caméra
    camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
  }

  // --------- Écouteurs DOM ---------
  function attachUIEvents() {
    // Dimensions
    ["width", "length", "height"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", rebuildFromConfig);
        el.addEventListener("input", rebuildFromConfig);
      }
    });

    // Couleurs
    document.querySelectorAll('input[name="roofColor"]').forEach((el) => {
      el.addEventListener("change", () => {
        updateColorsOnly();
      });
    });
    document.querySelectorAll('input[name="claddingColor"]').forEach((el) => {
      el.addEventListener("change", () => {
        updateColorsOnly();
      });
    });

    // Plein écran
    if (btnFull) {
      btnFull.addEventListener("click", enableFullscreen);
    }
    if (btnClose) {
      btnClose.addEventListener("click", disableFullscreen);
    }

    // Zoom
    if (btnZoomIn) {
      btnZoomIn.addEventListener("click", () => zoom(0.8)); // rapproche
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener("click", () => zoom(1.25)); // éloigne
    }
  }

  // --------- Lancement ---------
  window.addEventListener("DOMContentLoaded", () => {
    initThree();
    attachUIEvents();
  });
})();
