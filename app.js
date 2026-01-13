const STORAGE_KEY = "dokkan_checklist_v1";

const grid = document.getElementById("grid");
const progressEl = document.getElementById("progress");
const searchEl = document.getElementById("search");
const categorySelect = document.getElementById("categorySelect");

const modeOwnedBtn = document.getElementById("modeOwned");
const modeEzaBtn = document.getElementById("modeEza");
const modePotBtn = document.getElementById("modePot");

const selectAllBtn = document.getElementById("selectAll");
const selectNoneBtn = document.getElementById("selectNone");
const hideOwnedBtn = document.getElementById("hideOwned");
const showMissingBtn = document.getElementById("showMissing");
const showAllBtn = document.getElementById("showAll");

const exportBtn = document.getElementById("export");
const importBtn = document.getElementById("import");

let units = [];
let viewFilter = "all"; // all | hideOwned | missingOnly
let mode = "owned";     // owned | eza | pot

// State per unit:
// owned: boolean
// eza: 0 none, 1 EZA, 2 Super EZA
// pot: 0..4 (0 none, 4 rainbow)
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); // persists across sessions :contentReference[oaicite:3]{index=3}
}
function ensureState(id) {
  if (!state[id]) state[id] = { owned:false, eza:0, pot:0 };
  return state[id];
}

function setMode(next) {
  mode = next;
  modeOwnedBtn.classList.toggle("active", mode==="owned");
  modeEzaBtn.classList.toggle("active", mode==="eza");
  modePotBtn.classList.toggle("active", mode==="pot");
}

function cycleEza(cur) { return (cur + 1) % 3; } // 0->1->2->0
function cyclePot(cur) { return (cur + 1) % 5; } // 0..4

function buildCategoryOptions() {
  const cats = Array.from(new Set(units.map(u => u.category))).sort();
  cats.unshift("All Categories");
  categorySelect.innerHTML = "";
  for (const c of cats) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  }
}

function matchesFilters(u) {
  const q = (searchEl.value || "").trim().toLowerCase();
  const cat = categorySelect.value;

  if (cat && cat !== "All Categories" && u.category !== cat) return false;
  if (q && !(u.name.toLowerCase().includes(q) || u.category.toLowerCase().includes(q))) return false;

  const st = ensureState(u.id);

  if (viewFilter === "hideOwned" && st.owned) return false;
  if (viewFilter === "missingOnly" && st.owned) return false;

  return true;
}

function render() {
  const total = units.length;
  const ownedCount = units.reduce((acc, u) => acc + (ensureState(u.id).owned ? 1 : 0), 0);
  progressEl.textContent = `${ownedCount} / ${total}`;

  grid.innerHTML = "";
  for (const u of units.filter(matchesFilters)) {
    const st = ensureState(u.id);

    const card = document.createElement("div");
    card.className = "card " + (st.owned ? "owned" : "not-owned");

    const iconWrap = document.createElement("div");
    iconWrap.className = "iconwrap";
    const img = document.createElement("img");
    img.alt = u.name;
    img.loading = "lazy";
    img.src = u.icon || "";
    iconWrap.appendChild(img);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = u.name;

    const badges = document.createElement("div");
    badges.className = "badges";

    // EZA badges
    if (st.eza === 1) {
      const b = document.createElement("div");
      b.className = "badge zbadge z-eza";
      b.textContent = "Z";
      badges.appendChild(b);
    } else if (st.eza === 2) {
      const b = document.createElement("div");
      b.className = "badge zbadge z-seza";
      b.textContent = "Z★";
      badges.appendChild(b);
    }

    // Potential badge
    if (st.pot > 0) {
      const b = document.createElement("div");
      b.className = "badge pot";
      b.textContent = `${st.pot}/4`;
      badges.appendChild(b);
    }

    card.appendChild(badges);
    card.appendChild(iconWrap);
    card.appendChild(name);

    card.addEventListener("click", () => {
      const s = ensureState(u.id);
      if (mode === "owned") s.owned = !s.owned;
      if (mode === "eza") s.eza = cycleEza(s.eza);
      if (mode === "pot") s.pot = cyclePot(s.pot);
      saveState();
      render();
    });

    grid.appendChild(card);
  }
}

async function init() {
  const resp = await fetch("./units.json", { cache: "no-store" });
  units = await resp.json();

  // Basic validation: unique IDs
  const seen = new Set();
  for (const u of units) {
    if (!u.id) throw new Error("A unit is missing an id in units.json");
    if (seen.has(u.id)) throw new Error(`Duplicate unit id in units.json: ${u.id}`);
    seen.add(u.id);
    ensureState(u.id);
  }
  saveState();

  buildCategoryOptions();
  render();
}

searchEl.addEventListener("input", render);
categorySelect.addEventListener("change", render);

modeOwnedBtn.addEventListener("click", () => setMode("owned"));
modeEzaBtn.addEventListener("click", () => setMode("eza"));
modePotBtn.addEventListener("click", () => setMode("pot"));

selectAllBtn.addEventListener("click", () => {
  for (const u of units) ensureState(u.id).owned = true;
  saveState(); render();
});
selectNoneBtn.addEventListener("click", () => {
  for (const u of units) ensureState(u.id).owned = false;
  saveState(); render();
});

hideOwnedBtn.addEventListener("click", () => { viewFilter = "hideOwned"; render(); });
showMissingBtn.addEventListener("click", () => { viewFilter = "missingOnly"; render(); });
showAllBtn.addEventListener("click", () => { viewFilter = "all"; render(); });

exportBtn.addEventListener("click", async () => {
  const payload = { v:1, state };
  const text = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  await navigator.clipboard.writeText(text);
  alert("Export copied to clipboard.");
});
importBtn.addEventListener("click", () => {
  const text = prompt("Paste your export code:");
  if (!text) return;
  try {
    const json = decodeURIComponent(escape(atob(text.trim())));
    const payload = JSON.parse(json);
    if (!payload || payload.v !== 1 || typeof payload.state !== "object") throw new Error();
    state = payload.state;
    saveState();
    render();
    alert("Imported.");
  } catch {
    alert("Invalid import code.");
  }
});

init().catch(err => {
  console.error(err);
  progressEl.textContent = `Error: ${err.message}`;
});
