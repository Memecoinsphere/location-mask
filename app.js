/* Location Mask — static PWA (web conversion of a SwiftUI app).
 *
 * IMPORTANT: Everything here is COSMETIC / LOCAL ONLY.
 * The coordinate is a FAKE value typed by the user and logged locally. This page
 * never reads real GPS (no Geolocation API) and cannot change the device location.
 * The checklist toggles are a manual reminder only; they change no system setting.
 * Data persists in localStorage only. No network calls (CSP connect-src 'none'),
 * no analytics, no tracking, no third-party code.
 */

// ===== PASSCODE (change here) =====
const PASSCODE = "6767";
// ==================================

const decoyEl = document.getElementById("decoy");
const lockEl = document.getElementById("lock");
const panelEl = document.getElementById("panel");
const dotsEl = document.getElementById("dots");
const errorEl = document.getElementById("lockError");
const keypadEl = document.getElementById("keypad");
const lockPanelBtn = document.getElementById("lockPanelBtn");
const decoyTimeEl = document.getElementById("decoyTime");
const decoyDateEl = document.getElementById("decoyDate");

let entered = "";
let view = "decoy"; // decoy | lock | panel

/* ---------- localStorage helpers (UserDefaults -> localStorage) ---------- */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}
function saveJSON(key, value) {
  // Local only — never sent anywhere.
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota/private */ }
}
function isoNow() { return new Date().toISOString(); }

function renderLog(listEl, lines, emptyText) {
  listEl.textContent = "";
  if (!lines.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = emptyText || "No entries yet";
    listEl.appendChild(li);
    return;
  }
  for (const line of lines) {
    const li = document.createElement("li");
    li.textContent = line; // textContent: never interpreted as HTML
    listEl.appendChild(li);
  }
}

/* ---------- Views ---------- */
function show(name) {
  view = name;
  decoyEl.hidden = name !== "decoy";
  lockEl.hidden = name !== "lock";
  panelEl.hidden = name !== "panel";
  decoyEl.setAttribute("aria-hidden", name === "decoy" ? "false" : "true");
  if (name === "lock") { entered = ""; updateDots(); errorEl.hidden = true; }
  if (name === "panel") { App.onUnlock(); } else { App.onLock(); }
}

function updateDots() {
  const dots = dotsEl.querySelectorAll(".dot");
  dots.forEach((d, i) => { d.classList.toggle("filled", i < entered.length); });
}

function onDigit(d) {
  if (view !== "lock" || entered.length >= 4) return;
  errorEl.hidden = true;
  entered += d;
  updateDots();
  if (entered.length === 4) {
    if (entered === PASSCODE) { show("panel"); }
    else { errorEl.hidden = false; entered = ""; setTimeout(updateDots, 180); }
  }
}
function onDelete() {
  if (view !== "lock" || !entered.length) return;
  entered = entered.slice(0, -1);
  errorEl.hidden = true;
  updateDots();
}

keypadEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-k]");
  if (!btn) return;
  const k = btn.getAttribute("data-k");
  if (k === "del") onDelete(); else onDigit(k);
});
lockPanelBtn.addEventListener("click", () => { show("decoy"); });

/* ---------- Hidden gesture: double-tap in top ~15% strip ---------- */
const TOP_STRIP_RATIO = 0.15;
const DOUBLE_TAP_MS = 350;
let lastTopTapAt = 0;

function isTopStrip(clientY) {
  const h = window.innerHeight || document.documentElement.clientHeight;
  return clientY <= h * TOP_STRIP_RATIO;
}
function onPointerDown(e) {
  if (view !== "decoy") return;
  if (typeof e.button === "number" && e.button !== 0) return;
  const y = e.clientY;
  if (!isTopStrip(y)) { lastTopTapAt = 0; return; }
  const now = performance.now();
  if (lastTopTapAt && now - lastTopTapAt <= DOUBLE_TAP_MS) { lastTopTapAt = 0; show("lock"); }
  else { lastTopTapAt = now; }
}
decoyEl.addEventListener("pointerdown", onPointerDown, { passive: true });

/* ---------- Decoy clock ---------- */
const FR_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const FR_MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function pad2(n) { return String(n).padStart(2, "0"); }
function tickClock() {
  const now = new Date();
  decoyTimeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
  decoyDateEl.textContent = FR_DAYS[now.getDay()] + " " + now.getDate() + " " + FR_MONTHS[now.getMonth()];
}
tickClock();
setInterval(tickClock, 15000);

/* ================= App-specific logic ================= */
const K_COORD = "location_mask.coord.v1";
const K_CHECK = "location_mask.checklist.v1";
const K_LOG = "location_mask.log.v1";
const LOG_MAX = 10;
const TOGGLE_IDS = ["t0", "t1", "t2", "t3", "t4"];

const App = {
  init() {
    this.latEl = document.getElementById("lat");
    this.lonEl = document.getElementById("lon");
    this.logEl = document.getElementById("log");

    // Restore coordinate fields (local only).
    const coord = loadJSON(K_COORD, { lat: "48.8566", lon: "2.3522" });
    this.latEl.value = coord.lat;
    this.lonEl.value = coord.lon;
    const persistCoord = () => saveJSON(K_COORD, { lat: this.latEl.value, lon: this.lonEl.value });
    this.latEl.addEventListener("change", persistCoord);
    this.lonEl.addEventListener("change", persistCoord);

    // Restore + bind checklist toggles.
    const checks = loadJSON(K_CHECK, {});
    for (const id of TOGGLE_IDS) {
      const el = document.getElementById(id);
      el.checked = !!checks[id];
      el.addEventListener("change", () => {
        const c = loadJSON(K_CHECK, {});
        c[id] = el.checked;
        saveJSON(K_CHECK, c);
      });
    }

    document.getElementById("logPosBtn").addEventListener("click", () => {
      persistCoord();
      const line = isoNow() + ": " + this.latEl.value + ", " + this.lonEl.value;
      const log = [line, ...loadJSON(K_LOG, [])].slice(0, LOG_MAX);
      saveJSON(K_LOG, log);
      this.render();
    });
  },
  render() { renderLog(this.logEl, loadJSON(K_LOG, []), "No entries yet"); },
  onUnlock() { this.render(); },
  onLock() {},
};

/* ================= Boot ================= */
App.init();
show("decoy");

/* PWA service worker (app-shell only, same-origin) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
