/* =========================================================
   GAMAX-CM — CONFIGURATEUR + RÉCAP + VUE 3D (THREE)
   Fichier : public/app.js
========================================================= */

/* =========================================================
   1) DONNÉES CONFIGURATEUR
========================================================= */

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

/* =========================================================
   2) HELPERS UI
========================================================= */

function $(id) {
  return document.getElementById(id);
}

function getSelectedType() {
  return document.querySelector('input[name="slopeType"]:checked')?.value || "mono";
}

function populateSelect(selectEl, values) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = "";
  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = String(v).replace(".", ",") + " m";
    selectEl.appendChild(o);
  });
  if (current && values.map(String).includes(current)) selectEl.value = current;
}

function populateDimensions() {
  const cfg = DIMENSIONS[getSelectedType()];
  populateSelect($("width"), cfg.widths);
  populateSelect($("length"), cfg.lengths);
  populateSelect($("height"), cfg.heights);
}

/* =========================================================
   3) THREE.JS — CONSTANTES
========================================================= */

// modèles
const MODEL_PATH_MONO = "assets/abri-monopente-3x5m.gltf";
const MODEL_PATH_BI   = "assets/abri-bipente-4x5m.gltf";

// dimensions de référence des modèles
const BASE_MONO = { L: 5, W: 3, H: 2.15 };
const BASE_BI   = { L: 5, W: 4, H: 3 };

const GLOBAL_SCALE = 2.5;

// toiture
const PITCH_RATIO = 0.10;
const ROOF_OVERHANG_RATIO = 0.14;
const ROOF_THICKNESS = 0.06;
const ROOF_DROP = 0.40;

// bardage
const CLAD_THICKNESS = 0.035;

// textures
const ROOF_TEX_PATH = "assets/texture-bac-acier.jpg";
const CLAD_TEX_PATH = "assets/texture-bac-acier.jpg";

// visuel
const ROOF_OPACITY = 0.92;
const CLAD_OPACITY = 0.92;

const SHADOW_ENABLED = true;

/* =========================================================
   4) THREE — VARIABLES GLOBALES
========================================================= */

let scene, camera, renderer, controls;
let structureGroup = null;
let overlayGroup = null;

let baseModuleMono = null;
let baseBBoxMono = null;

let baseModuleBi = null;
let baseBBoxBi = null;

let roofTex = null;
let cladTex = null;

/* =========================================================
   5) THREE — INIT
========================================================= */

function initThree() {
  const canvas = $("viewer3d");
  if (!canvas || !window.THREE) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f4ee);

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  camera.position.set(8, 5, 10);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = SHADOW_ENABLED;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 20, 10);
  dir.castShadow = SHADOW_ENABLED;
  scene.add(dir);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const tl = new THREE.TextureLoader();
  tl.load(ROOF_TEX_PATH, (t) => (roofTex = t));
  tl.load(CLAD_TEX_PATH, (t) => (cladTex = t));

  const loader = new THREE.GLTFLoader();

  loader.load(MODEL_PATH_MONO, (gltf) => {
    baseModuleMono = gltf.scene;
    baseModuleMono.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    baseBBoxMono = new THREE.Box3().setFromObject(baseModuleMono);
    update3DFromConfig();
  });

  loader.load(MODEL_PATH_BI, (gltf) => {
    baseModuleBi = gltf.scene;
    baseModuleBi.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    baseBBoxBi = new THREE.Box3().setFromObject(baseModuleBi);
    update3DFromConfig();
  });

  animateThree();
}

function animateThree() {
  requestAnimationFrame(animateThree);
  controls.update();
  renderer.render(scene, camera);
}

/* =========================================================
   6) STRUCTURE 3D (MONO / BI)
========================================================= */

function buildStructureFromConfig() {
  const type = getSelectedType();
  const baseModule = type === "bi" ? baseModuleBi : baseModuleMono;
  const baseBBox   = type === "bi" ? baseBBoxBi   : baseBBoxMono;
  if (!baseModule || !baseBBox) return null;

  if (structureGroup) scene.remove(structureGroup);
  structureGroup = new THREE.Group();
  scene.add(structureGroup);

  const width = parseFloat($("width").value);
  const length = parseFloat($("length").value);
  const height = parseFloat($("height").value);

  const BASE = type === "bi" ? BASE_BI : BASE_MONO;

  const scaleX = (length / BASE.L) * GLOBAL_SCALE;
  const scaleZ = (width / BASE.W) * GLOBAL_SCALE;
  const scaleY = (height / BASE.H) * GLOBAL_SCALE;

  const clone = baseModule.clone(true);
  clone.scale.set(scaleX, scaleY, scaleZ);
  structureGroup.add(clone);

  const bbox = new THREE.Box3().setFromObject(structureGroup);
  const center = bbox.getCenter(new THREE.Vector3());
  structureGroup.position.sub(center);

  return new THREE.Box3().setFromObject(structureGroup);
}

/* =========================================================
   7) TOITURE + BARDAGE
========================================================= */

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

  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x999999,
    map: roofTex,
    transparent: true,
    opacity: ROOF_OPACITY,
  });

  const slopeType = getSelectedType();
  const angle = Math.atan(PITCH_RATIO);
  const roofThick = ROOF_THICKNESS * GLOBAL_SCALE;

  if (slopeType === "mono") {
    const overhang = widthZ * ROOF_OVERHANG_RATIO;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(lenX, roofThick, widthZ + overhang),
      roofMat
    );
    roof.rotation.x = -angle;
    roof.position.set(cx, max.y - ROOF_DROP, cz - overhang / 2);
    overlayGroup.add(roof);
  } else {
    const halfW = widthZ / 2;
    const geo = new THREE.BoxGeometry(lenX, roofThick, halfW);

    const r1 = new THREE.Mesh(geo, roofMat.clone());
    r1.rotation.x = angle;
    r1.position.set(cx, max.y - ROOF_DROP, cz + halfW / 2);
    overlayGroup.add(r1);

    const r2 = new THREE.Mesh(geo, roofMat.clone());
    r2.rotation.x = -angle;
    r2.position.set(cx, max.y - ROOF_DROP, cz - halfW / 2);
    overlayGroup.add(r2);
  }
}

/* =========================================================
   8) UPDATE GLOBAL
========================================================= */

function update3DFromConfig() {
  const bbox = buildStructureFromConfig();
  rebuildOverlays(bbox);
}

/* =========================================================
   9) INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  populateDimensions();
  initThree();

  document.querySelectorAll('input[name="slopeType"]').forEach((el) =>
    el.addEventListener("change", () => {
      populateDimensions();
      update3DFromConfig();
    })
  );

  ["width", "length", "height"].forEach((id) =>
    $(id)?.addEventListener("change", update3DFromConfig)
  );
});
