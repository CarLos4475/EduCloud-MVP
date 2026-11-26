import "@fontsource/alfa-slab-one/latin-400.css";
import "@fontsource/archivo-narrow/latin-400.css";
import "@fontsource/archivo-narrow/latin-700.css";
import "@fontsource/dm-mono/latin-400.css";
import "./deck.css";

const stage = document.querySelector("#deck-stage");
const slides = Array.from(stage.querySelectorAll(".slide"));
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const fullscreen = document.querySelector("#fullscreen");
const status = document.querySelector("#deck-status");
const copy = Array.from(stage.querySelectorAll("[data-copy]"));
const toolbar = document.querySelector("#edit-toolbar");
const storageKey = "educloud-pitch-copy-v1";
let index = 0;
let editing = false;

/* === Fixed stage and slide navigation === */
function fitStage() {
  const { innerWidth: width, innerHeight: height } = window;
  const scale = Math.min(width / 1920, height / 1080);
  const x = (width - 1920 * scale) / 2;
  const y = (height - 1080 * scale) / 2;
  stage.style.transform =
    "translate(" + x + "px, " + y + "px) scale(" + scale + ")";
}

function showSlide(position, updateAddress = true) {
  index = Math.max(0, Math.min(slides.length - 1, position));
  for (const [i, slide] of slides.entries()) {
    const active = i === index;
    if (!active && slide.contains(document.activeElement))
      document.activeElement.blur();
    slide.classList.toggle("active", active);
    slide.inert = !active;
    slide.setAttribute("aria-hidden", String(!active));
  }
  previous.disabled = index === 0;
  next.disabled = index === slides.length - 1;
  const title = slides[index]
    .querySelector("h1, h2")
    .innerText.replaceAll("\n", " ");
  status.textContent = index + 1 + " de " + slides.length + ". " + title;
  if (updateAddress)
    history.replaceState(null, "", "#" + slides[index].dataset.slide);
}

function fromAddress() {
  const position = slides.findIndex(
    (slide) => "#" + slide.dataset.slide === location.hash,
  );
  showSlide(Math.max(0, position), false);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    status.textContent = "El navegador no pudo activar la pantalla completa.";
  }
}

/* === Optional, browser-only text edits === */
function setEditing(active) {
  editing = active;
  toolbar.hidden = !active;
  for (const element of copy) {
    if (active) element.setAttribute("contenteditable", "plaintext-only");
    else element.removeAttribute("contenteditable");
  }
}

function loadEdits() {
  try {
    const texts = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!Array.isArray(texts) || texts.length !== copy.length) return;
    for (const [i, element] of copy.entries()) {
      const text = texts[i];
      if (typeof text === "string" && text.trim().length <= 145)
        element.textContent = text.trim();
    }
  } catch {
    // The deck is also usable when browser storage is blocked.
  }
}

function saveEdits() {
  for (const element of copy)
    element.textContent = element.innerText.trim().slice(0, 145);
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(copy.map((element) => element.textContent)),
    );
    status.textContent = "Cambios guardados en este navegador.";
  } catch {
    status.textContent =
      "Los cambios se conservan mientras esta pestaña siga abierta.";
  }
  setEditing(false);
}

/* === Keyboard, buttons and touch === */
window.addEventListener("resize", fitStage);
window.addEventListener("hashchange", fromAddress);
previous.addEventListener("click", () => showSlide(index - 1));
next.addEventListener("click", () => showSlide(index + 1));
fullscreen.addEventListener("click", () => void toggleFullscreen());
document.querySelector("#save-edits").addEventListener("click", saveEdits);
document
  .querySelector("#close-edits")
  .addEventListener("click", () => setEditing(false));

document.addEventListener("keydown", (event) => {
  if (editing) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveEdits();
      return;
    }
    if (event.key === "Escape") {
      setEditing(false);
      return;
    }
    if (
      event.target.closest("[contenteditable]") &&
      !["PageDown", "PageUp"].includes(event.key)
    )
      return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  switch (event.key) {
    case " ":
      if (event.target.closest("button, a")) return;
    case "ArrowRight":
    case "PageDown":
      event.preventDefault();
      showSlide(index + 1);
      break;
    case "ArrowLeft":
    case "PageUp":
      event.preventDefault();
      showSlide(index - 1);
      break;
    case "Home":
      event.preventDefault();
      showSlide(0);
      break;
    case "End":
      event.preventDefault();
      showSlide(slides.length - 1);
      break;
    case "f":
    case "F":
      void toggleFullscreen();
      break;
    case "e":
    case "E":
      setEditing(!editing);
      break;
  }
});

let tap;
stage.addEventListener(
  "touchstart",
  (event) => {
    if (editing || event.touches.length !== 1) return;
    const finger = event.touches[0];
    tap = { x: finger.clientX, y: finger.clientY };
  },
  { passive: true },
);
stage.addEventListener("touchcancel", () => {
  tap = undefined;
});
stage.addEventListener(
  "touchend",
  (event) => {
    const start = tap;
    tap = undefined;
    if (!start || editing || event.changedTouches.length !== 1) return;
    const finger = event.changedTouches[0];
    const dx = finger.clientX - start.x;
    const dy = finger.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3)
      showSlide(index + (dx < 0 ? 1 : -1));
  },
  { passive: true },
);

loadEdits();
fitStage();
fromAddress();
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.body.classList.add("deck-ready"));
});
