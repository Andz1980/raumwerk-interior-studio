import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

function makeFabricTexture(base, seed = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);
  let state = seed + 1;
  for (let i = 0; i < 2500; i += 1) {
    state = (state * 16807) % 2147483647;
    const x = state % 256;
    state = (state * 16807) % 2147483647;
    const y = state % 256;
    context.globalAlpha = (state % 14) / 100;
    context.fillStyle = state % 2 ? "#fff" : "#493b32";
    context.fillRect(x, y, 1, 1);
  }
  context.globalAlpha = 0.12;
  context.fillStyle = "#fff";
  for (let x = 0; x < 256; x += 4) context.fillRect(x, 0, 1, 256);
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 4;
  return texture;
}

function makeRugTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = "#b8a58d";
  context.fillRect(0, 0, 512, 512);
  context.globalAlpha = 0.16;
  for (let i = 0; i < 512; i += 4) {
    context.fillStyle = i % 8 ? "#f5eee4" : "#675847";
    context.fillRect(i, 0, 1, 512);
    context.fillRect(0, i, 512, 1);
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function createRoomGroup(colors, furniturePreference) {
  const group = new THREE.Group();
  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: colors.wall, roughness: 0.94 }),
    floor: new THREE.MeshStandardMaterial({ color: colors.floor, roughness: 0.58 }),
    wood: new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.42 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.72 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x4d4b44, roughness: 0.34, metalness: 0.32 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x463d34, roughness: 0.75 }),
    sofa: new THREE.MeshStandardMaterial({ color: 0xc3a58a, map: makeFabricTexture("#c3a58a", 9), roughness: 0.96 }),
    seat: new THREE.MeshStandardMaterial({ color: 0xd4bea6, map: makeFabricTexture("#d4bea6", 17), roughness: 0.98 }),
    pillow: new THREE.MeshStandardMaterial({ color: 0x8c9a83, map: makeFabricTexture("#8c9a83", 31), roughness: 0.97 }),
    rug: new THREE.MeshStandardMaterial({ color: 0xb8a58d, map: makeRugTexture(), roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x557252, roughness: 0.8, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe0df, roughness: 0.12, metalness: 0.08, transmission: 0.28, transparent: true, opacity: 0.75 }),
    shade: new THREE.MeshStandardMaterial({ color: 0xf5ebd6, roughness: 0.85, side: THREE.DoubleSide })
  };
  const addMesh = (geometry, material, position, options = {}) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (options.rotation) mesh.rotation.set(...options.rotation);
    if (options.scale) mesh.scale.set(...options.scale);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    group.add(mesh);
    return mesh;
  };
  const box = (size, material, position, radius = 0.025, segments = 3) =>
    addMesh(new RoundedBoxGeometry(...size, segments, radius), material, position);
  const cylinder = (top, bottom, height, material, position, radial = 24) =>
    addMesh(new THREE.CylinderGeometry(top, bottom, height, radial), material, position);

  const floor = addMesh(new THREE.PlaneGeometry(3.55, 3.55), materials.floor, [0, 0, 0], {
    rotation: [-Math.PI / 2, 0, 0],
    castShadow: false
  });
  floor.material = materials.floor.clone();
  floor.material.map = makeFabricTexture("#8c7057", 21);
  floor.material.map.repeat.set(1, 8);
  floor.material.roughness = 0.66;

  box([3.5, 2.8, 0.1], materials.wall, [0, 1.4, -1.72], 0.015);
  box([0.1, 2.8, 3.5], materials.wall, [-1.72, 1.4, 0], 0.015);
  box([0.1, 2.8, 3.5], materials.wall, [1.72, 1.4, 0], 0.015);
  box([3.5, 0.1, 0.12], materials.trim, [0, 0.07, -1.64], 0.025);
  box([0.12, 0.1, 3.5], materials.trim, [-1.64, 0.07, 0], 0.025);
  box([0.12, 0.1, 3.5], materials.trim, [1.64, 0.07, 0], 0.025);

  const boardMat = materials.floor.clone();
  boardMat.color.set(0xffffff);
  boardMat.map = makeFabricTexture("#98795d", 24);
  boardMat.map.repeat.set(1, 3);
  for (let row = 0; row < 11; row += 1) {
    const z = -1.51 + row * 0.29;
    const stagger = row % 2 ? 0.16 : 0;
    box([3.38, 0.025, 0.278], boardMat, [0, 0.025, z], 0.006);
    for (const x of [-1.47 + stagger, -0.5 + stagger, 0.47 + stagger, 1.44 + stagger]) {
      if (x > -1.62 && x < 1.62) {
        const seam = addMesh(new THREE.BoxGeometry(0.008, 0.003, 0.275), materials.dark, [x, 0.04, z], { castShadow: false });
        seam.material.transparent = true;
        seam.material.opacity = 0.16;
      }
    }
  }

  const windowFrame = new THREE.MeshStandardMaterial({ color: 0xf2eee5, roughness: 0.55 });
  box([1.28, 1.45, 0.1], windowFrame, [0.35, 1.76, -1.63], 0.018);
  box([1.1, 1.27, 0.035], materials.glass, [0.35, 1.77, -1.565], 0.008);
  box([0.045, 1.27, 0.045], materials.trim, [0.35, 1.77, -1.53], 0.01);
  box([1.1, 0.045, 0.045], materials.trim, [0.35, 1.77, -1.53], 0.01);
  const curtain = new THREE.MeshStandardMaterial({ color: 0xe7dfd1, roughness: 1, side: THREE.DoubleSide });
  for (const x of [-0.38, 1.06]) {
    const panel = box([0.18, 1.62, 0.035], curtain, [x, 1.67, -1.51], 0.025);
    panel.scale.x = 0.88;
  }
  cylinder(0.018, 0.018, 1.63, materials.metal, [0.35, 2.53, -1.51], 16).rotation.z = Math.PI / 2;

  const artwork = new THREE.Group();
  artwork.add(new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.86, 0.07, 4, 0.018), materials.trim));
  const artCanvas = new THREE.MeshStandardMaterial({ color: 0xb88d68, roughness: 0.9 });
  const artPanel = new THREE.Mesh(new RoundedBoxGeometry(0.65, 0.75, 0.02, 4, 0.008), artCanvas);
  artPanel.position.z = 0.048;
  artwork.add(artPanel);
  const artCircle = new THREE.Mesh(new THREE.CircleGeometry(0.19, 40), new THREE.MeshStandardMaterial({ color: 0xe4c79d, roughness: 1 }));
  artCircle.position.set(0.06, 0.08, 0.063);
  artwork.add(artCircle);
  artCircle.scale.set(1, 1.28, 1);
  const artHill = new THREE.Shape();
  artHill.moveTo(-0.3, -0.34);
  artHill.quadraticCurveTo(-0.04, 0.14, 0.08, -0.12);
  artHill.quadraticCurveTo(0.25, -0.32, 0.33, -0.34);
  artHill.closePath();
  const artLandscape = new THREE.Mesh(new THREE.ShapeGeometry(artHill), new THREE.MeshStandardMaterial({ color: 0x63765d, roughness: 1, side: THREE.DoubleSide }));
  artLandscape.position.z = 0.067;
  artwork.add(artLandscape);
  artwork.position.set(-1.63, 1.83, -0.72);
  artwork.rotation.y = Math.PI / 2;
  group.add(artwork);

  const rug = addMesh(new THREE.PlaneGeometry(2.42, 1.62), materials.rug, [-0.02, 0.055, 0.25], { rotation: [-Math.PI / 2, 0, 0], castShadow: false });
  rug.receiveShadow = true;

  const couchX = -0.05;
  const couchZ = -0.69;
  const leg = new THREE.MeshStandardMaterial({ color: 0x72583f, roughness: 0.4 });
  for (const x of [couchX - 0.68, couchX + 0.68]) {
    for (const z of [couchZ - 0.2, couchZ + 0.2]) {
      const taperedLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.048, 0.25, 16), leg);
      taperedLeg.position.set(x, 0.17, z);
      taperedLeg.castShadow = true;
      group.add(taperedLeg);
      const foot = cylinder(0.049, 0.049, 0.027, materials.metal, [x, 0.045, z], 16);
      foot.castShadow = false;
    }
  }
  box([1.72, 0.3, 0.63], materials.sofa, [couchX, 0.39, couchZ], 0.13, 5);
  box([1.7, 0.23, 0.63], materials.seat, [couchX, 0.61, couchZ + 0.015], 0.095, 5);
  box([1.6, 0.68, 0.22], materials.sofa, [couchX, 0.89, couchZ - 0.22], 0.095, 5);
  for (const x of [couchX - 0.82, couchX + 0.82]) {
    box([0.2, 0.57, 0.66], materials.sofa, [x, 0.66, couchZ + 0.02], 0.09, 5);
  }
  for (const x of [couchX - 0.48, couchX, couchX + 0.48]) {
    box([0.49, 0.12, 0.48], materials.seat, [x, 0.74, couchZ + 0.015], 0.055, 5);
    const seam = addMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.43, 8), leg, [x, 0.749, couchZ + 0.015], { castShadow: false });
    seam.rotation.z = Math.PI / 2;
  }
  for (const [x, color, rotation] of [
    [couchX - 0.58, materials.pillow, -0.12],
    [couchX + 0.55, materials.seat, 0.14]
  ]) {
    box([0.38, 0.36, 0.16], color, [x, 0.91, couchZ + 0.12], 0.075, 6).rotation.z = rotation;
  }

  const tableX = 0.28;
  const tableZ = 0.47;
  const tabletop = cylinder(0.45, 0.45, 0.105, materials.wood, [tableX, 0.48, tableZ], 48);
  tabletop.scale.z = 0.72;
  tabletop.material.roughness = 0.33;
  for (const [x, z] of [[-0.25, -0.12], [0.25, -0.12], [-0.25, 0.12], [0.25, 0.12]]) {
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.038, 0.43, 14), leg);
    tableLeg.position.set(tableX + x, 0.25, tableZ + z);
    tableLeg.rotation.z = x * 0.18;
    group.add(tableLeg);
  }
  cylinder(0.115, 0.13, 0.18, materials.trim, [tableX - 0.06, 0.62, tableZ - 0.04], 24);
  cylinder(0.108, 0.108, 0.015, materials.wood, [tableX - 0.06, 0.718, tableZ - 0.04], 24);
  const vase = new THREE.MeshStandardMaterial({ color: 0xa97759, roughness: 0.3 });
  const vaseMesh = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.07, 0.01), new THREE.Vector2(0.1, 0.09),
    new THREE.Vector2(0.12, 0.2), new THREE.Vector2(0.08, 0.27), new THREE.Vector2(0.045, 0.3),
    new THREE.Vector2(0.045, 0.37), new THREE.Vector2(0.055, 0.38)
  ], 32), vase);
  vaseMesh.position.set(tableX + 0.15, 0.54, tableZ - 0.02);
  vaseMesh.castShadow = true;
  group.add(vaseMesh);

  const plantX = 1.23;
  const plantZ = -0.91;
  const potMat = new THREE.MeshStandardMaterial({ color: 0xb7805f, roughness: 0.68 });
  cylinder(0.19, 0.13, 0.37, potMat, [plantX, 0.24, plantZ], 32);
  cylinder(0.19, 0.19, 0.045, new THREE.MeshStandardMaterial({ color: 0x3b3429, roughness: 1 }), [plantX, 0.44, plantZ], 32).castShadow = false;
  cylinder(0.018, 0.025, 0.88, new THREE.MeshStandardMaterial({ color: 0x68513c, roughness: 0.9 }), [plantX, 0.88, plantZ], 10);
  for (let i = 0; i < 13; i += 1) {
    const angle = i * 2.4;
    const height = 0.67 + (i % 4) * 0.13;
    const leafGeometry = new THREE.SphereGeometry(0.16, 20, 12);
    const leaf = addMesh(leafGeometry, materials.leaf, [
      plantX + Math.sin(angle) * (0.17 + (i % 3) * 0.025),
      0.82 + (i % 5) * 0.13,
      plantZ + Math.cos(angle) * (0.17 + (i % 3) * 0.025)
    ], { scale: [0.55, 1.55, 0.14] });
    leaf.rotation.set(Math.cos(angle) * 0.45, angle, Math.sin(angle) * 0.4);
    leaf.scale.y = height;
  }

  const lampX = -1.13;
  const lampZ = 0.15;
  cylinder(0.19, 0.22, 0.06, materials.metal, [lampX, 0.07, lampZ], 32);
  cylinder(0.012, 0.018, 1.62, materials.metal, [lampX, 0.9, lampZ], 16);
  const lampShade = addMesh(new THREE.CylinderGeometry(0.34, 0.19, 0.34, 36, 1, true), materials.shade, [lampX, 1.7, lampZ]);
  lampShade.material.side = THREE.DoubleSide;
  addMesh(new THREE.SphereGeometry(0.085, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffe6ae, emissive: 0xffd48a, emissiveIntensity: 1.5 }), [lampX, 1.58, lampZ], { castShadow: false });
  const lampLight = new THREE.PointLight(0xffdfaa, 6, 3, 2);
  lampLight.position.set(lampX, 1.55, lampZ);
  lampLight.castShadow = true;
  group.add(lampLight);

  if (furniturePreference.includes("Stauraum")) {
    box([0.7, 0.68, 0.35], materials.wood, [1.2, 0.39, 0.48], 0.035);
    for (const y of [0.23, 0.55]) {
      box([0.64, 0.018, 0.018], materials.trim, [1.2, y, 0.29], 0.006);
    }
  }
  return group;
}

export function createRoomScene(canvas, colors, furniturePreference) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdcded9);
  scene.fog = new THREE.Fog(0xdcded9, 8, 18);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(5.1, 3.7, 5.2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.02, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 4.2;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xfaf4e9, 0x6a655b, 1.7));
  const daylight = new THREE.DirectionalLight(0xffe3c2, 3.2);
  daylight.position.set(-3.8, 6, 3.8);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1536, 1536);
  daylight.shadow.camera.left = -4;
  daylight.shadow.camera.right = 4;
  daylight.shadow.camera.top = 5;
  daylight.shadow.camera.bottom = -2;
  daylight.shadow.bias = -0.00015;
  daylight.shadow.normalBias = 0.035;
  scene.add(daylight);
  const fill = new THREE.DirectionalLight(0xe4edff, 1.0);
  fill.position.set(3, 3, -3);
  scene.add(fill);

  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xc9c9c1, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);
  const room = createRoomGroup(colors, furniturePreference);
  room.position.y = 0.025;
  scene.add(room);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  let hitTestSource = null;
  let viewerSpace = null;
  let reticle = null;
  let hitMatrix = null;
  let placed = false;
  let disposed = false;

  const onSessionStart = async () => {
    const session = renderer.xr.getSession();
    if (!session) return;
    try {
      viewerSpace = await session.requestReferenceSpace("viewer");
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.16, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x435b48, side: THREE.DoubleSide })
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);
      hitMatrix = new THREE.Matrix4();
      session.addEventListener("select", onSelect);
      session.addEventListener("end", onSessionEnd, { once: true });
      canvas.dispatchEvent(new CustomEvent("raumwerk-ar-started"));
    } catch (error) {
      await session.end();
      throw new Error("Die AR-Flächenerkennung ist auf diesem Gerät nicht verfügbar.");
    }
  };

  const onSelect = () => {
    if (!reticle?.visible || placed) return;
    room.position.setFromMatrixPosition(reticle.matrix);
    room.quaternion.setFromRotationMatrix(reticle.matrix);
    room.scale.setScalar(0.32);
    placed = true;
    reticle.visible = false;
  };

  const onSessionEnd = () => {
    hitTestSource?.cancel();
    hitTestSource = null;
    if (reticle) scene.remove(reticle);
    reticle = null;
    viewerSpace = null;
    placed = false;
    canvas.dispatchEvent(new CustomEvent("raumwerk-ar-ended"));
  };

  const render = (_time, frame) => {
    if (disposed) return;
    if (frame && hitTestSource && !placed) {
      const hits = frame.getHitTestResults(hitTestSource);
      if (hits.length && reticle) {
        const pose = hits[0].getPose(renderer.xr.getReferenceSpace());
        if (pose) {
          hitMatrix.fromArray(pose.transform.matrix);
          reticle.matrix.copy(hitMatrix);
          reticle.visible = true;
        }
      } else if (reticle) reticle.visible = false;
    }
    if (!renderer.xr.isPresenting) controls.update();
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(render);

  return {
    async startAR() {
      if (!navigator.xr) throw new Error("WebXR wird in diesem Browser nicht unterstützt. Nutze ein aktuelles Android-Gerät mit Chrome.");
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      if (!supported) throw new Error("Dieses Gerät unterstützt keinen WebXR-AR-Modus.");
      placed = false;
      room.position.set(0, 0.025, 0);
      room.quaternion.identity();
      room.scale.setScalar(1);
      try {
        const session = await navigator.xr.requestSession("immersive-ar", {
          requiredFeatures: ["hit-test"],
          optionalFeatures: ["dom-overlay"],
          domOverlay: { root: document.body }
        });
        renderer.xr.enabled = true;
        renderer.xr.setReferenceSpaceType("local");
        await renderer.xr.setSession(session);
        await onSessionStart();
      } catch (error) {
        if (error instanceof Error && error.message.includes("AR-")) throw error;
        throw new Error(error.name === "NotAllowedError"
          ? "Die AR-Berechtigung wurde nicht erteilt."
          : "AR ließ sich nicht starten. Prüfe HTTPS, Browser-Kompatibilität und Kamera-Berechtigung.");
      }
    },
    endAR() {
      renderer.xr.getSession()?.end();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.xr.getSession()?.end();
      observer.disconnect();
      renderer.setAnimationLoop(null);
      scene.traverse(object => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => disposeMaterial(material));
        else if (object.material) disposeMaterial(object.material);
      });
      renderer.dispose();
    }
  };
}

function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value?.isTexture) value.dispose();
  }
  material.dispose();
}
