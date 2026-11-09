import { createRoomScene } from "./scene3d.js";

const STORAGE_KEY = "raumwerk-studio-v1";
const MAX_IMAGE_EDGE = 1400;
const IMAGE_QUALITY = 0.78;
const styleLabels = {
  warm: "Warm & natürlich",
  scandinavian: "Skandinavisch",
  minimal: "Modern & minimal",
  mediterranean: "Mediterran",
  industrial: "Industrial"
};
const styleFilters = {
  warm: "saturate(.88) sepia(.19) brightness(1.03)",
  scandinavian: "saturate(.72) brightness(1.09)",
  minimal: "saturate(.7) contrast(.96) brightness(1.06)",
  mediterranean: "saturate(1.15) sepia(.1) brightness(1.02)",
  industrial: "saturate(.65) contrast(1.1)"
};
const styleColors = {
  warm: { wall: 0xe7d9c7, floor: 0x99795b, accent: 0x8d674e },
  scandinavian: { wall: 0xe8e8de, floor: 0xc3aa84, accent: 0x8c9b82 },
  minimal: { wall: 0xe4e5e0, floor: 0x9c9b91, accent: 0x728078 },
  mediterranean: { wall: 0xf0dfc7, floor: 0xb99168, accent: 0x77917e },
  industrial: { wall: 0xbfc0b9, floor: 0x777269, accent: 0x846248 }
};

const elements = {
  profileSelect: document.querySelector("#profileSelect"),
  profileAvatar: document.querySelector("#profileAvatar"),
  addProfileButton: document.querySelector("#addProfileButton"),
  lockProfileButton: document.querySelector("#lockProfileButton"),
  authGate: document.querySelector("#authGate"),
  authForm: document.querySelector("#authForm"),
  authTitle: document.querySelector("#authTitle"),
  authDescription: document.querySelector("#authDescription"),
  authProfileGroup: document.querySelector("#authProfileGroup"),
  authProfileSelect: document.querySelector("#authProfileSelect"),
  authNameGroup: document.querySelector("#authNameGroup"),
  authName: document.querySelector("#authName"),
  authPassword: document.querySelector("#authPassword"),
  authConfirmGroup: document.querySelector("#authConfirmGroup"),
  authPasswordConfirm: document.querySelector("#authPasswordConfirm"),
  authError: document.querySelector("#authError"),
  authSubmit: document.querySelector("#authSubmit"),
  authToggle: document.querySelector("#authToggle"),
  projectGallery: document.querySelector("#projectGallery"),
  projectCount: document.querySelector("#projectCount"),
  roomName: document.querySelector("#roomName"),
  roomStyle: document.querySelector("#roomStyle"),
  furniturePreference: document.querySelector("#furniturePreference"),
  budget: document.querySelector("#budget"),
  budgetValue: document.querySelector("#budgetValue"),
  analyzeButton: document.querySelector("#analyzeButton"),
  analysisMessage: document.querySelector("#analysisMessage"),
  results: document.querySelector("#results"),
  comparisonGrid: document.querySelector("#comparisonGrid"),
  insightTitle: document.querySelector("#insightTitle"),
  insightText: document.querySelector("#insightText"),
  saveProjectButton: document.querySelector("#saveProjectButton"),
  exportPdfButton: document.querySelector("#exportPdfButton"),
  toast: document.querySelector("#toast"),
  cameraButton: document.querySelector("#cameraButton"),
  cameraPanel: document.querySelector("#cameraPanel"),
  cameraVideo: document.querySelector("#cameraVideo"),
  cameraWall: document.querySelector("#cameraWall"),
  takePhotoButton: document.querySelector("#takePhotoButton"),
  closeCameraButton: document.querySelector("#closeCameraButton"),
  arButton: document.querySelector("#arButton"),
  arSupport: document.querySelector("#arSupport"),
  exitArButton: document.querySelector("#exitArButton")
};

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.profiles)) {
      const profiles = saved.profiles
        .filter(profile => profile && typeof profile.name === "string")
        .map(profile => ({
          id: profile.id || createId(),
          name: profile.name,
          salt: profile.salt || null,
          iv: profile.iv || null,
          ciphertext: profile.ciphertext || null,
          legacyProjects: Array.isArray(profile.projects) ? profile.projects : null
        }));
      const activeProfileId = profiles.some(profile => profile.id === saved.activeProfileId)
        ? saved.activeProfileId
        : profiles[0]?.id || null;
      return { version: 2, profiles, activeProfileId };
    }
  } catch (error) {
    console.warn("Gespeicherte Raumwerk-Daten konnten nicht gelesen werden.", error);
  }
  return { version: 2, profiles: [], activeProfileId: null };
}

let data = readData();
const unlockedKeys = new Map();
let authMode = "unlock";
let walls = [null, null, null, null];
let currentProjectId = null;
let cameraStream = null;
let scene = null;
let toastTimer;

function activeProfile() {
  return data.profiles.find(profile => profile.id === data.activeProfileId) || null;
}

function encodeBase64(bytes) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function deriveProfileKey(password, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptProjects(profile, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({ projects: profile.projects || [] }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  profile.iv = encodeBase64(iv);
  profile.ciphertext = encodeBase64(new Uint8Array(ciphertext));
}

function persistMetadata() {
  try {
    const stored = {
      version: 2,
      activeProfileId: data.activeProfileId,
      profiles: data.profiles.map(profile => ({
        id: profile.id,
        name: profile.name,
        salt: profile.salt,
        iv: profile.iv,
        ciphertext: profile.ciphertext,
        projects: profile.salt ? undefined : profile.legacyProjects
      }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch (error) {
    console.error("Speichern in localStorage fehlgeschlagen.", error);
    showToast("Speichern fehlgeschlagen. Entferne ein älteres Projekt oder verwende kleinere Fotos.");
    return false;
  }
}

async function persistProfile(profile = activeProfile()) {
  const key = profile && unlockedKeys.get(profile.id);
  if (!profile || !key) {
    showToast("Das Profil ist gesperrt. Entsperre es erneut, um Änderungen zu speichern.");
    return false;
  }
  const previous = { iv: profile.iv, ciphertext: profile.ciphertext };
  try {
    await encryptProjects(profile, key);
    if (persistMetadata()) {
      delete profile.legacyProjects;
      return true;
    }
    profile.iv = previous.iv;
    profile.ciphertext = previous.ciphertext;
    return false;
  } catch (error) {
    profile.iv = previous.iv;
    profile.ciphertext = previous.ciphertext;
    console.error("Verschlüsseln des Profils fehlgeschlagen.", error);
    showToast("Deine Änderungen konnten nicht verschlüsselt gespeichert werden.");
    return false;
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 3300);
}

function setWallPreview(index, dataUrl) {
  const preview = document.querySelector(`#wallPreview${index}`);
  preview.classList.remove("empty");
  preview.querySelector("img")?.remove();
  const image = document.createElement("img");
  image.src = dataUrl;
  image.alt = `Aufnahme von Wand ${index + 1}`;
  preview.prepend(image);
  const hint = preview.querySelector(".preview-hint");
  if (hint) hint.remove();
  const addButton = document.querySelector(`[data-wall-action="${index}"]`);
  addButton.textContent = "Ändern";
}

function makeCompressedImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Bitte wähle eine gültige Bilddatei aus."));
      return;
    }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Das Bild konnte nicht geladen werden."));
    };
    image.src = objectUrl;
  });
}

async function setWall(index, dataUrl) {
  walls[index] = dataUrl;
  setWallPreview(index, dataUrl);
  elements.analysisMessage.textContent = `${walls.filter(Boolean).length} von 4 Wandansichten erfasst.`;
}

function renderProfiles() {
  elements.profileSelect.replaceChildren();
  elements.authProfileSelect.replaceChildren();
  data.profiles.forEach(profile => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = profile.id === data.activeProfileId;
    const authOption = option.cloneNode(true);
    elements.profileSelect.append(option);
    elements.authProfileSelect.append(authOption);
  });
  const profile = activeProfile();
  if (profile) elements.profileAvatar.textContent = (profile.name.trim()[0] || "P").toLocaleUpperCase("de");
}

function setAuthMode(mode) {
  authMode = mode;
  const profile = data.profiles.find(item => item.id === elements.authProfileSelect.value) || activeProfile();
  const isCreate = mode === "create";
  const isSetup = mode === "setup";
  elements.authProfileGroup.hidden = isCreate || data.profiles.length === 0;
  elements.authNameGroup.hidden = !isCreate;
  elements.authConfirmGroup.hidden = mode === "unlock";
  elements.authPassword.value = "";
  elements.authPasswordConfirm.value = "";
  elements.authError.textContent = "";
  elements.authTitle.textContent = isCreate ? "Neues Profil anlegen" : isSetup ? "Passwort festlegen" : "Profil entsperren";
  elements.authDescription.textContent = isCreate
    ? "Lege ein persönliches Profil und ein starkes Passwort an. Deine Projekte werden damit verschlüsselt."
    : isSetup
      ? "Dieses Profil enthält noch unverschlüsselte Bestandsdaten. Lege jetzt ein Passwort fest, um sie auf diesem Gerät zu verschlüsseln."
      : `Melde dich für ${profile?.name || "dein Profil"} mit dem Profilpasswort an.`;
  elements.authSubmit.textContent = isCreate ? "Profil erstellen" : isSetup ? "Passwort festlegen & entsperren" : "Profil entsperren";
  elements.authToggle.hidden = data.profiles.length === 0;
  elements.authToggle.textContent = isCreate ? "Zurück zur Anmeldung" : "Neues Profil anlegen";
  elements.authPassword.autocomplete = mode === "unlock" ? "current-password" : "new-password";
  if (isCreate) elements.authName.focus();
  else elements.authPassword.focus();
}

function showAuthGate(mode) {
  closeCamera();
  elements.authGate.hidden = false;
  document.querySelector(".app-shell").inert = true;
  setAuthMode(mode);
}

function lockActiveProfile() {
  const profile = activeProfile();
  if (profile) {
    unlockedKeys.delete(profile.id);
    delete profile.projects;
  }
  scene?.endAR();
  scene?.dispose();
  scene = null;
  walls = [null, null, null, null];
  currentProjectId = null;
  elements.results.hidden = true;
  elements.comparisonGrid.replaceChildren();
  renderProjects();
  renderProfiles();
  showAuthGate("unlock");
}

async function unlockProfile(profile, password) {
  if (!crypto?.subtle) throw new Error("Dieser Browser unterstützt keine sichere Profilverschlüsselung.");
  if (!profile.salt) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveProfileKey(password, salt);
    profile.projects = Array.isArray(profile.legacyProjects) ? profile.legacyProjects : [];
    profile.salt = encodeBase64(salt);
    await encryptProjects(profile, key);
    if (!persistMetadata()) {
      profile.salt = null;
      profile.iv = null;
      profile.ciphertext = null;
      profile.projects = undefined;
      throw new Error("Das Profil konnte nicht verschlüsselt gespeichert werden. Prüfe den freien Gerätespeicher.");
    }
    delete profile.legacyProjects;
    unlockedKeys.set(profile.id, key);
    return;
  }

  if (!profile.iv || !profile.ciphertext) throw new Error("Die verschlüsselten Profildaten sind unvollständig.");
  const key = await deriveProfileKey(password, decodeBase64(profile.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(profile.iv) },
    key,
    decodeBase64(profile.ciphertext)
  );
  const payload = JSON.parse(new TextDecoder().decode(plaintext));
  if (!payload || !Array.isArray(payload.projects)) throw new Error("Die Profildaten haben ein ungültiges Format.");
  profile.projects = payload.projects;
  unlockedKeys.set(profile.id, key);
}

async function createProfile(name, password) {
  if (!crypto?.subtle) throw new Error("Dieser Browser unterstützt keine sichere Profilverschlüsselung.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveProfileKey(password, salt);
  const profile = {
    id: createId(),
    name: name.trim().slice(0, 40),
    salt: encodeBase64(salt),
    iv: null,
    ciphertext: null,
    projects: []
  };
  data.profiles.push(profile);
  data.activeProfileId = profile.id;
  unlockedKeys.set(profile.id, key);
  if (!await persistProfile(profile)) {
    data.profiles = data.profiles.filter(item => item.id !== profile.id);
    data.activeProfileId = data.profiles[0]?.id || null;
    unlockedKeys.delete(profile.id);
    throw new Error("Profil konnte nicht gespeichert werden. Prüfe den freien Gerätespeicher.");
  }
  finishUnlock(profile);
  showToast(`Profil „${profile.name}“ wurde erstellt und verschlüsselt.`);
}

function finishUnlock(profile) {
  data.activeProfileId = profile.id;
  persistMetadata();
  renderProfiles();
  renderProjects();
  document.querySelector(".app-shell").inert = false;
  elements.authGate.hidden = true;
}

async function submitAuth(event) {
  event.preventDefault();
  const password = elements.authPassword.value;
  if (password.length < 12) {
    elements.authError.textContent = "Bitte verwende mindestens 12 Zeichen für dein Passwort.";
    return;
  }
  if (authMode !== "unlock" && password !== elements.authPasswordConfirm.value) {
    elements.authError.textContent = "Die Passwörter stimmen nicht überein.";
    return;
  }
  elements.authSubmit.disabled = true;
  elements.authError.textContent = "";
  try {
    if (authMode === "create") {
      const name = elements.authName.value.trim();
      if (!name) throw new Error("Bitte gib einen Profilnamen ein.");
      await createProfile(name, password);
      return;
    }
    const profile = data.profiles.find(item => item.id === elements.authProfileSelect.value);
    if (!profile) throw new Error("Bitte wähle ein Profil aus.");
    await unlockProfile(profile, password);
    finishUnlock(profile);
    elements.authPassword.value = "";
    elements.authPasswordConfirm.value = "";
  } catch (error) {
    if (error.name === "OperationError" || error.name === "DataError") {
      elements.authError.textContent = "Das Passwort ist falsch.";
    } else {
      console.error("Profil konnte nicht entsperrt werden.", error);
      elements.authError.textContent = error.message || "Das Profil konnte nicht entsperrt werden.";
    }
  } finally {
    elements.authSubmit.disabled = false;
  }
}

function renderProjects() {
  const profile = activeProfile();
  const projects = (profile?.projects || []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  elements.projectCount.textContent = `${projects.length} ${projects.length === 1 ? "Projekt" : "Projekte"}`;
  elements.projectGallery.replaceChildren();
  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "empty-projects";
    empty.innerHTML = "<span>✦</span><strong>Noch ist hier Platz für Ideen.</strong><p>Speichere deinen ersten Entwurf, um ihn jederzeit wiederzufinden.</p>";
    elements.projectGallery.append(empty);
    return;
  }
  projects.forEach(project => {
    const card = document.createElement("article");
    card.className = "project-card";
    const image = document.createElement("img");
    image.src = project.walls.find(Boolean) || placeholderImage(0);
    image.alt = `Vorschau: ${project.name}`;
    const info = document.createElement("div");
    info.className = "project-card-info";
    const title = document.createElement("strong");
    title.textContent = project.name;
    const meta = document.createElement("p");
    meta.textContent = `${styleLabels[project.style] || project.style} · ${formatCurrency(project.budget)}`;
    const actions = document.createElement("div");
    actions.className = "project-card-actions";
    const load = document.createElement("button");
    load.type = "button";
    load.textContent = "Öffnen →";
    load.addEventListener("click", () => loadProject(project.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-project";
    remove.textContent = "Löschen";
    remove.addEventListener("click", () => deleteProject(project.id));
    actions.append(load, remove);
    info.append(title, meta, actions);
    card.append(image, info);
    elements.projectGallery.append(card);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function placeholderImage(index) {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  const colors = ["#e6e3d9", "#dce3db", "#e7ded2", "#dbded7"];
  context.fillStyle = colors[index % colors.length];
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#b8bbae";
  context.fillRect(55, 55, 370, 210);
  context.fillStyle = "#d9d4c7";
  context.fillRect(75, 75, 330, 170);
  context.fillStyle = "#9ca694";
  context.fillRect(86, 190, 82, 55);
  context.fillStyle = "#a87f60";
  context.fillRect(196, 203, 105, 11);
  context.fillStyle = "#737a6f";
  context.font = "16px sans-serif";
  context.fillText(`WAND ${index + 1} · NOCH OFFEN`, 130, 295);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function canvasImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Eine gespeicherte Bildansicht konnte nicht verarbeitet werden."));
    image.src = dataUrl;
  });
}

async function renderedAfterImage(dataUrl, style, index) {
  const image = await canvasImage(dataUrl || placeholderImage(index));
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 480;
  canvas.height = image.naturalHeight || 320;
  const context = canvas.getContext("2d");
  context.filter = style === "industrial" ? "saturate(.65) contrast(1.08)" : style === "mediterranean" ? "saturate(1.12) sepia(.08)" : "saturate(.82) brightness(1.04)";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.filter = "none";
  const overlays = {
    warm: "rgba(197,154,112,.15)",
    scandinavian: "rgba(225,229,214,.16)",
    minimal: "rgba(220,224,220,.15)",
    mediterranean: "rgba(218,161,99,.13)",
    industrial: "rgba(100,111,105,.15)"
  };
  context.fillStyle = overlays[style] || overlays.warm;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

async function analyze() {
  const present = walls.filter(Boolean);
  if (!present.length) {
    elements.analysisMessage.textContent = "Bitte lade mindestens ein Foto einer Wand hoch.";
    showToast("Für deinen Entwurf wird mindestens ein Wandfoto benötigt.");
    return;
  }
  elements.analyzeButton.disabled = true;
  elements.analyzeButton.textContent = "Entwurf wird erstellt …";
  try {
    const style = elements.roomStyle.value;
    const image = await canvasImage(present[0]);
    const sample = document.createElement("canvas");
    sample.width = 24;
    sample.height = 24;
    const context = sample.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 24, 24);
    const pixels = context.getImageData(0, 0, 24, 24).data;
    let brightness = 0;
    for (let i = 0; i < pixels.length; i += 4) brightness += (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
    brightness /= pixels.length / 4;
    const lightTip = brightness < 115
      ? "Die Aufnahme wirkt eher dunkel. Helle Wandtöne und mehrere Lichtquellen können den Raum optisch öffnen."
      : "Die Aufnahme ist gut belichtet. Natürliche Materialien und eine gezielte Akzentfarbe geben dem Raum mehr Tiefe.";
    const budget = Number(elements.budget.value);
    const budgetTip = budget < 2500
      ? "Setze das Budget mit Textilien, Licht und einzelnen Secondhand-Fundstücken gezielt ein."
      : "Plane einen Teil des Budgets für Beleuchtung und langlebige Kernmöbel ein.";
    elements.insightTitle.textContent = `${styleLabels[style]} — dein erster Entwurf`;
    elements.insightText.textContent = `${lightTip} ${budgetTip} Die Bildauswertung läuft lokal im Browser und nutzt Helligkeits- und Farbinformationen; sie ist keine generative KI.`;
    await renderComparison();
    elements.results.hidden = false;
    elements.analysisMessage.textContent = `Entwurf für „${elements.roomName.value.trim() || "Mein Wohnprojekt"}“ bereit.`;
    if (scene) scene.dispose();
    scene = createRoomScene(document.querySelector("#roomCanvas"), styleColors[style] || styleColors.warm, elements.furniturePreference.value);
    document.querySelector("#sceneLoading").hidden = true;
    elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Der Entwurf konnte nicht erstellt werden.", error);
    showToast(error.message || "Beim Erstellen des Entwurfs ist ein Fehler aufgetreten.");
  } finally {
    elements.analyzeButton.disabled = false;
    elements.analyzeButton.innerHTML = 'Ideen entdecken <span aria-hidden="true">→</span>';
  }
}

async function renderComparison() {
  elements.comparisonGrid.replaceChildren();
  for (let index = 0; index < 4; index += 1) {
    const source = walls[index] || placeholderImage(index);
    const after = await renderedAfterImage(walls[index], elements.roomStyle.value, index);
    const card = document.createElement("article");
    card.className = "comparison-card";
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = `Wand ${index + 1}`;
    const number = document.createElement("span");
    number.textContent = `0${index + 1}`;
    header.append(title, number);
    const images = document.createElement("div");
    images.className = "comparison-images";
    [[source, "Vorher"], [after, "Idee"]].forEach(([url, label]) => {
      const figure = document.createElement("figure");
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${label} – Wand ${index + 1}`;
      const caption = document.createElement("figcaption");
      caption.textContent = label;
      figure.append(img, caption);
      images.append(figure);
    });
    const note = document.createElement("p");
    note.className = "comparison-note";
    note.textContent = walls[index] ? styleLabels[elements.roomStyle.value] : "Platzhalter — noch kein Foto";
    card.append(header, images, note);
    elements.comparisonGrid.append(card);
  }
}

function snapshot() {
  return {
    id: currentProjectId || createId(),
    name: elements.roomName.value.trim() || "Mein Wohnprojekt",
    style: elements.roomStyle.value,
    furniture: elements.furniturePreference.value,
    budget: Number(elements.budget.value),
    walls: [...walls],
    updatedAt: Date.now()
  };
}

async function saveProject() {
  const project = snapshot();
  const projects = activeProfile()?.projects;
  if (!projects) return;
  const existingIndex = projects.findIndex(item => item.id === project.id);
  if (existingIndex >= 0) projects[existingIndex] = project;
  else projects.unshift(project);
  if (!await persistProfile()) return;
  currentProjectId = project.id;
  renderProjects();
  showToast("Dein Projekt wurde in diesem Browser-Profil gespeichert.");
}

function loadProject(projectId) {
  const project = activeProfile().projects.find(item => item.id === projectId);
  if (!project) return;
  currentProjectId = project.id;
  walls = Array.isArray(project.walls) ? [...project.walls.slice(0, 4), null, null, null, null].slice(0, 4) : [null, null, null, null];
  elements.roomName.value = project.name || "Mein Wohnprojekt";
  elements.roomStyle.value = project.style || "warm";
  elements.furniturePreference.value = project.furniture || "Gemütliche Sitzmöbel";
  elements.budget.value = project.budget || 5000;
  updateBudget();
  walls.forEach((url, index) => {
    if (url) setWallPreview(index, url);
    else resetWallPreview(index);
  });
  elements.analysisMessage.textContent = "Projekt geladen. Starte die Ideen-Ansicht, um den Entwurf anzuzeigen.";
  document.querySelector("#studio").scrollIntoView({ behavior: "smooth" });
  showToast(`„${project.name}“ wurde geladen.`);
}

function resetWallPreview(index) {
  const preview = document.querySelector(`#wallPreview${index}`);
  preview.replaceChildren();
  preview.classList.add("empty");
  const number = document.createElement("span");
  number.className = "wall-number";
  number.textContent = `0${index + 1}`;
  const icon = document.createElement("span");
  icon.className = "empty-icon";
  icon.textContent = "＋";
  const hint = document.createElement("span");
  hint.className = "preview-hint";
  hint.textContent = "Foto hinzufügen";
  preview.append(number, icon, hint);
  document.querySelector(`[data-wall-action="${index}"]`).textContent = "Foto wählen";
}

async function deleteProject(projectId) {
  const profile = activeProfile();
  if (!profile?.projects) return;
  const previousProjects = profile.projects;
  profile.projects = profile.projects.filter(project => project.id !== projectId);
  if (!await persistProfile(profile)) {
    profile.projects = previousProjects;
    return;
  }
  if (currentProjectId === projectId) currentProjectId = null;
  renderProjects();
  showToast("Projekt wurde gelöscht.");
}

function updateBudget() {
  elements.budgetValue.textContent = formatCurrency(elements.budget.value);
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Dein Browser unterstützt keine Kameraaufnahme. Bitte lade ein Foto hoch.");
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    elements.cameraVideo.srcObject = cameraStream;
    elements.cameraPanel.hidden = false;
    elements.cameraPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error("Kamerazugriff fehlgeschlagen.", error);
    showToast(error.name === "NotAllowedError" ? "Der Kamerazugriff wurde nicht erlaubt." : "Die Kamera konnte nicht geöffnet werden. Prüfe die Browser-Berechtigung.");
  }
}

function closeCamera() {
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream = null;
  elements.cameraVideo.srcObject = null;
  elements.cameraPanel.hidden = true;
}

async function takePhoto() {
  if (!cameraStream || !elements.cameraVideo.videoWidth) {
    showToast("Die Kamera ist noch nicht bereit. Versuche es gleich noch einmal.");
    return;
  }
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(elements.cameraVideo.videoWidth, elements.cameraVideo.videoHeight));
  canvas.width = Math.round(elements.cameraVideo.videoWidth * ratio);
  canvas.height = Math.round(elements.cameraVideo.videoHeight * ratio);
  canvas.getContext("2d").drawImage(elements.cameraVideo, 0, 0, canvas.width, canvas.height);
  await setWall(Number(elements.cameraWall.value), canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
  closeCamera();
  showToast("Raumfoto aufgenommen.");
}

async function exportPdf() {
  if (!window.jspdf?.jsPDF) {
    showToast("Der PDF-Export konnte nicht geladen werden. Prüfe deine Internetverbindung.");
    return;
  }
  const project = snapshot();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFillColor(247, 245, 239);
  pdf.rect(0, 0, 297, 210, "F");
  pdf.setTextColor(43, 48, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text(project.name, 14, 17);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 104);
  pdf.text(`${styleLabels[project.style]}  ·  ${project.furniture}  ·  Budget ${formatCurrency(project.budget)}`, 14, 24);
  pdf.text("RAUMWERK  /  MOODBOARD", 283, 17, { align: "right" });
  const startX = 14;
  const gap = 4;
  const cardWidth = (269 - gap * 3) / 4;
  for (let index = 0; index < 4; index += 1) {
    const x = startX + index * (cardWidth + gap);
    const y = 33;
    const before = walls[index] || placeholderImage(index);
    const after = await renderedAfterImage(walls[index], project.style, index);
    pdf.setFillColor(255, 254, 250);
    pdf.roundedRect(x, y, cardWidth, 73, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(54, 60, 53);
    pdf.setFontSize(9);
    pdf.text(`WAND ${index + 1}`, x + 3, y + 6);
    pdf.addImage(before, "JPEG", x + 3, y + 10, (cardWidth - 8) / 2, 45, undefined, "FAST");
    pdf.addImage(after, "JPEG", x + 5 + (cardWidth - 8) / 2, y + 10, (cardWidth - 8) / 2, 45, undefined, "FAST");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(115, 120, 111);
    pdf.text(walls[index] ? "VORHER" : "FOTO OFFEN", x + 3, y + 61);
    pdf.text("DESIGN-IDEE", x + cardWidth - 3, y + 61, { align: "right" });
    if (!walls[index]) pdf.text("Platzhalter", x + cardWidth / 2, y + 68, { align: "center" });
  }
  const planX = 21;
  const planY = 126;
  const planW = 89;
  const planH = 59;
  pdf.setTextColor(43, 48, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("GRUNDRISS · SCHEMATISCH", 14, 119);
  pdf.setDrawColor(127, 143, 119);
  pdf.setLineWidth(1.3);
  pdf.rect(planX, planY, planW, planH);
  pdf.setDrawColor(195, 199, 188);
  pdf.setLineWidth(.3);
  pdf.line(planX, planY + planH / 2, planX + planW, planY + planH / 2);
  pdf.line(planX + planW / 2, planY, planX + planW / 2, planY + planH);
  pdf.setFillColor(204, 187, 163);
  pdf.roundedRect(planX + 27, planY + 19, 34, 17, 2, 2, "F");
  pdf.setFillColor(165, 139, 107);
  pdf.circle(planX + 45, planY + 28, 5, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(116, 121, 112);
  pdf.text("Wand 1", planX + 4, planY + 7);
  pdf.text("Wand 2", planX + planW - 4, planY + 7, { align: "right" });
  pdf.text("Wand 3", planX + 4, planY + planH - 4);
  pdf.text("Wand 4", planX + planW - 4, planY + planH - 4, { align: "right" });
  const infoX = 132;
  pdf.setFillColor(229, 234, 224);
  pdf.roundedRect(infoX, 119, 151, 66, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(51, 65, 50);
  pdf.text("DEIN DESIGN-RAHMEN", infoX + 9, 132);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(79, 87, 77);
  pdf.text(`Stil: ${styleLabels[project.style]}`, infoX + 9, 143);
  pdf.text(`Möbel-Fokus: ${project.furniture}`, infoX + 9, 152);
  pdf.text(`Geplantes Budget: ${formatCurrency(project.budget)}`, infoX + 9, 161);
  pdf.setFontSize(7);
  pdf.setTextColor(116, 122, 113);
  pdf.text("Die Bildansichten zeigen eine stilistische Vorschau, keine fotorealistische KI-Generierung.", infoX + 9, 175);
  pdf.setFontSize(7);
  pdf.text("Erstellt und entwickelt von Andreas Kitzel · Raumwerk", 283, 198, { align: "right" });
  pdf.save(`${project.name.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") || "raumwerk-moodboard"}.pdf`);
}

function setupEvents() {
  document.querySelectorAll(".wall-card").forEach(card => {
    const index = Number(card.dataset.wall);
    const input = card.querySelector(".wall-input");
    card.querySelector(".wall-add").addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      try {
        await setWall(index, await makeCompressedImage(file));
      } catch (error) {
        showToast(error.message);
      }
    });
  });
  elements.addProfileButton.addEventListener("click", () => showAuthGate("create"));
  elements.lockProfileButton.addEventListener("click", lockActiveProfile);
  elements.authForm.addEventListener("submit", submitAuth);
  elements.authProfileSelect.addEventListener("change", () => {
    const profile = data.profiles.find(item => item.id === elements.authProfileSelect.value);
    setAuthMode(profile && !profile.salt ? "setup" : "unlock");
  });
  elements.authToggle.addEventListener("click", () => {
    setAuthMode(authMode === "create"
      ? (activeProfile()?.salt ? "unlock" : "setup")
      : "create");
  });
  elements.profileSelect.addEventListener("change", () => {
    const profile = data.profiles.find(item => item.id === elements.profileSelect.value);
    if (!profile || profile.id === data.activeProfileId) return;
    const previous = activeProfile();
    if (previous) {
      unlockedKeys.delete(previous.id);
      delete previous.projects;
    }
    scene?.endAR();
    scene?.dispose();
    scene = null;
    data.activeProfileId = profile.id;
    persistMetadata();
    renderProfiles();
    renderProjects();
    currentProjectId = null;
    showAuthGate(profile.salt ? "unlock" : "setup");
  });
  elements.budget.addEventListener("input", updateBudget);
  elements.analyzeButton.addEventListener("click", analyze);
  elements.saveProjectButton.addEventListener("click", saveProject);
  elements.exportPdfButton.addEventListener("click", exportPdf);
  elements.cameraButton.addEventListener("click", openCamera);
  elements.closeCameraButton.addEventListener("click", closeCamera);
  elements.takePhotoButton.addEventListener("click", takePhoto);
  elements.arButton.addEventListener("click", async () => {
    if (!scene) {
      showToast("Erstelle zuerst deinen Entwurf.");
      return;
    }
    try {
      await scene.startAR();
      elements.exitArButton.hidden = false;
      elements.arSupport.textContent = "Tippe auf die Fläche, um den Raumentwurf zu platzieren.";
    } catch (error) {
      console.error("AR konnte nicht gestartet werden.", error);
      showToast(error.message || "AR konnte auf diesem Gerät nicht gestartet werden.");
    }
  });
  elements.exitArButton.addEventListener("click", () => scene?.endAR());
  document.querySelector("#roomCanvas").addEventListener("raumwerk-ar-ended", () => {
    elements.exitArButton.hidden = true;
    elements.arSupport.textContent = "Benötigt ein AR-fähiges Smartphone und eine sichere HTTPS-Verbindung.";
  });
  window.addEventListener("pagehide", closeCamera);
}

function initialize() {
  renderProfiles();
  renderProjects();
  updateBudget();
  setupEvents();
  setupMotion();
  const profile = activeProfile();
  elements.authGate.hidden = false;
  document.querySelector(".app-shell").inert = true;
  setAuthMode(!profile ? "create" : profile.salt ? "unlock" : "setup");
  if (!navigator.xr) elements.arSupport.textContent = "WebXR ist in diesem Browser nicht verfügbar. Verwende ein AR-fähiges Smartphone mit aktuellem Chrome und HTTPS.";
}

function setupMotion() {
  const targets = document.querySelectorAll(".workspace-section, .results-heading, .insight-card, .comparison-card, .visual-card, .floorplan-card, .projects-section");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("reveal-ready");
  targets.forEach((element, index) => {
    element.classList.add("reveal-on-scroll");
    if (element.matches(".comparison-card, .visual-card")) element.style.transitionDelay = `${(index % 4) * 55}ms`;
  });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  targets.forEach(element => observer.observe(element));
}

initialize();
