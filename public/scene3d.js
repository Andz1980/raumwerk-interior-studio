import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function createRoomGroup(colors, furniturePreference) {
  const group = new THREE.Group();
  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: colors.wall, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ color: colors.floor, roughness: 0.82 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.8 }),
    light: new THREE.MeshStandardMaterial({ color: 0xe6d7bd, roughness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x574a3d, roughness: 0.85 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x72866e, roughness: 0.8 })
  };
  const addBox = (width, height, depth, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  addBox(3.2, 0.08, 3.2, materials.floor, 0, 0, 0);
  addBox(3.2, 2.5, 0.08, materials.wall, 0, 1.25, -1.6);
  addBox(0.08, 2.5, 3.2, materials.wall, -1.6, 1.25, 0);
  addBox(0.08, 2.5, 3.2, materials.wall, 1.6, 1.25, 0);
  addBox(1.15, 0.36, 0.67, materials.accent, 0, 0.42, -0.5);
  addBox(1.15, 0.17, 0.68, materials.light, 0, 0.68, -0.5);
  addBox(0.18, 0.67, 0.68, materials.accent, -0.5, 0.34, -0.5);
  addBox(0.18, 0.67, 0.68, materials.accent, 0.5, 0.34, -0.5);
  addBox(0.83, 0.09, 0.48, materials.dark, 0.35, 0.5, 0.45);
  const legGeometry = new THREE.CylinderGeometry(0.025, 0.03, 0.48, 8);
  for (const [x, z] of [[0, 0.27], [0.7, 0.27], [0, 0.64], [0.7, 0.64]]) {
    const leg = new THREE.Mesh(legGeometry, materials.dark);
    leg.position.set(x, 0.25, z);
    group.add(leg);
  }
  addBox(0.34, 0.4, 0.34, materials.light, -1.05, 0.22, -0.92);
  addBox(0.13, 1.0, 0.13, materials.dark, -1.05, 0.78, -0.92);
  addBox(0.5, 0.045, 0.22, materials.light, -1.05, 1.2, -0.92);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.28, 12), materials.dark);
  pot.position.set(1.08, 0.18, -0.9);
  group.add(pot);
  const plant = new THREE.Group();
  plant.position.set(1.08, 0.32, -0.9);
  for (let i = 0; i < 5; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.58 + (i % 2) * 0.16, 7), materials.leaf);
    leaf.position.set(Math.sin(i * 1.3) * 0.11, 0.37 + (i % 2) * 0.04, Math.cos(i * 1.1) * 0.1);
    leaf.rotation.z = Math.sin(i * 1.3) * 0.35;
    plant.add(leaf);
  }
  group.add(plant);
  if (furniturePreference.includes("Stauraum")) {
    addBox(0.78, 0.72, 0.32, materials.accent, 1.12, 0.36, 0.48);
  }
  return group;
}

export function createRoomScene(canvas, colors, furniturePreference) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe5e8e0);
  scene.fog = new THREE.Fog(0xe5e8e0, 7, 15);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(5.2, 4.2, 6);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.85, 0);
  controls.enableDamping = true;
  controls.minDistance = 3.7;
  controls.maxDistance = 10;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.update();
  scene.add(new THREE.HemisphereLight(0xfff8e9, 0x737768, 2.0));
  const sun = new THREE.DirectionalLight(0xffeed8, 3.0);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0xe1e2db, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);
  const room = createRoomGroup(colors, furniturePreference);
  room.position.y = 0.02;
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
  let animationFrame;

  const onSessionStart = async () => {
    const session = renderer.xr.getSession();
    if (!session) return;
    try {
      viewerSpace = await session.requestReferenceSpace("viewer");
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.16, 32).rotateX(-Math.PI / 2),
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
      room.position.set(0, 0.02, 0);
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
      cancelAnimationFrame(animationFrame);
      scene.traverse(object => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material?.dispose();
      });
      renderer.dispose();
    }
  };
}
