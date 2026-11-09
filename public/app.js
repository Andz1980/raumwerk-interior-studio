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

function createDefaultData() {
  const profile = { id: createId(), name: "Mein Profil", projects: [] };
  return { profiles: [profile], activeProfileId: profile.id };
}

function readData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.profiles) && saved.profiles.length) {
      saved.profiles = saved.profiles.filter(profile => profile && typeof profile.name === "string" && Array.isArray(profile.projects));
      if (saved.profiles.length) {
        if (!saved.profiles.some(profile => profile.id === saved.activeProfileId)) saved.activeProfileId = saved.profiles[0].id;
        return saved;
      }
    }
  } catch (error) {
    console.warn("Gespeicherte Raumwerk-Daten konnten nicht gelesen werden.", error);
  }
  return createDefaultData();
}

let data = readData();
let walls = [null, null, null, null];
let currentProjectId = null;
let cameraStream = null;
let scene = null;
let toastTimer;

function activeProfile() {
  return data.profiles.find(profile => profile.id === data.activeProfileId) || data.profiles[0];
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Speichern in localStorage fehlgeschlagen.", error);
    showToast("Der Browser-Speicher ist voll. Entferne ein älteres Projekt oder verwende kleinere Fotos.");
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
  data.profiles.forEach(profile => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = profile.id === data.activeProfileId;
    elements.profileSelect.append(option);
  });
  elements.profileAvatar.textContent = (activeProfile().name.trim()[0] || "P").toLocaleUpperCase("de");
}

function renderProjects() {
  const projects = activeProfile().projects.slice().sort((a, b) => b.updatedAt - a.updatedAt);
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

function saveProject() {
  const project = snapshot();
  const projects = activeProfile().projects;
  const existingIndex = projects.findIndex(item => item.id === project.id);
  if (existingIndex >= 0) projects[existingIndex] = project;
  else projects.unshift(project);
  if (!persist()) return;
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

function deleteProject(projectId) {
  const profile = activeProfile();
  profile.projects = profile.projects.filter(project => project.id !== projectId);
  if (!persist()) return;
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
  elements.addProfileButton.addEventListener("click", () => {
    const name = window.prompt("Wie soll dein Profil heißen?");
    if (!name?.trim()) return;
    const profile = { id: createId(), name: name.trim().slice(0, 40), projects: [] };
    data.profiles.push(profile);
    data.activeProfileId = profile.id;
    if (!persist()) {
      data.profiles.pop();
      data.activeProfileId = data.profiles[0].id;
      return;
    }
    renderProfiles();
    renderProjects();
    showToast(`Profil „${profile.name}“ wurde erstellt.`);
  });
  elements.profileSelect.addEventListener("change", () => {
    data.activeProfileId = elements.profileSelect.value;
    persist();
    renderProfiles();
    renderProjects();
    currentProjectId = null;
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
  if (!navigator.xr) elements.arSupport.textContent = "WebXR ist in diesem Browser nicht verfügbar. Verwende ein AR-fähiges Smartphone mit aktuellem Chrome und HTTPS.";
}

initialize();
