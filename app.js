const state = {
  voiceOn: true,
  items: []
};

const catalogues = {
  Woolworths: {
    "salmon fillets": 15.50,
    "vegetable stock": 2.70,
    "spinach": 3.20,
    "milk": 4.50,
    "weet-bix": 5.50,
    "bananas": 4.20,
    "burger buns": 4.00,
    "beef patties": 10.00,
    "lettuce": 3.50,
    "tomatoes": 5.00,
    "chicken breast": 12.00,
    "tortillas": 4.50,
    "capsicum": 2.50,
    "onion": 1.20,
    "broccoli": 3.00,
    "rice": 3.50
  },
  Coles: {
    "salmon fillets": 14.90,
    "vegetable stock": 2.50,
    "spinach": 3.50,
    "milk": 4.40,
    "weet-bix": 5.50,
    "bananas": 4.00,
    "burger buns": 3.80,
    "beef patties": 9.50,
    "lettuce": 3.30,
    "tomatoes": 4.80,
    "chicken breast": 11.50,
    "tortillas": 4.20,
    "capsicum": 2.40,
    "onion": 1.10,
    "broccoli": 3.20,
    "rice": 3.20
  },
  Aldi: {
    "salmon fillets": 13.50,
    "vegetable stock": 2.20,
    "spinach": 2.80,
    "milk": 4.10,
    "weet-bix": null,
    "bananas": 3.60,
    "burger buns": 3.20,
    "beef patties": 8.50,
    "lettuce": 2.90,
    "tomatoes": 4.20,
    "chicken breast": 10.50,
    "tortillas": 3.80,
    "capsicum": 2.10,
    "onion": 0.95,
    "broccoli": 2.70,
    "rice": 2.80
  }
};

const recipeMap = {
  salmon: [
    { name: "salmon fillets", qty: 6, unit: "fillets", source: "Salmon + greens" },
    { name: "broccoli", qty: 1, unit: "head", source: "Salmon + greens" },
    { name: "spinach", qty: 1, unit: "bag", source: "Salmon + greens" },
    { name: "rice", qty: 1, unit: "pack", source: "Salmon + greens" }
  ],
  burgers: [
    { name: "burger buns", qty: 1, unit: "pack", source: "Burgers" },
    { name: "beef patties", qty: 1, unit: "pack", source: "Burgers" },
    { name: "lettuce", qty: 1, unit: "head", source: "Burgers" },
    { name: "tomatoes", qty: 4, unit: "items", source: "Burgers" }
  ],
  fajitas: [
    { name: "chicken breast", qty: 1, unit: "kg", source: "Chicken fajitas" },
    { name: "tortillas", qty: 1, unit: "pack", source: "Chicken fajitas" },
    { name: "capsicum", qty: 3, unit: "items", source: "Chicken fajitas" },
    { name: "onion", qty: 2, unit: "items", source: "Chicken fajitas" }
  ]
};

const aliases = [
  ["salmon", "salmon fillets"],
  ["stock", "vegetable stock"],
  ["spinach", "spinach"],
  ["milk", "milk"],
  ["weet-bix", "weet-bix"],
  ["weetbix", "weet-bix"],
  ["banana", "bananas"],
  ["bananas", "bananas"],
  ["garlic", "garlic"]
];

const numberWords = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

function normaliseName(name) {
  const lower = name.toLowerCase().trim();
  const match = aliases.find(([alias]) => lower.includes(alias));
  return match ? match[1] : lower.replace(/\b(some|a|an|large|small|packet of|pack of|cartons? of|bag of)\b/g, "").trim();
}

function parseChunk(chunk) {
  let text = chunk.trim().toLowerCase();
  if (!text) return null;
  if (/still have|plenty of|don't need|do not need|already have/.test(text)) return { exclude: true, raw: text };

  let qty = 1;
  const digit = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (digit) qty = Number(digit[1]);
  else {
    const word = Object.keys(numberWords).find(w => new RegExp(`\\b${w}\\b`).test(text));
    if (word) qty = numberWords[word];
  }

  const name = normaliseName(text);
  if (!name) return null;
  return { name, qty, unit: "", source: "Voice / typed" };
}

function parseInput(text) {
  return text
    .replace(/\band\b/gi, ",")
    .split(/[,.\n]+/)
    .map(parseChunk)
    .filter(Boolean);
}

function addOrMerge(item) {
  if (item.exclude) {
    const possible = aliases.find(([alias]) => item.raw.includes(alias));
    if (possible) state.items = state.items.filter(x => x.name !== possible[1]);
    return;
  }

  const existing = state.items.find(x => x.name === item.name);
  if (existing) {
    existing.qty = Math.max(existing.qty, item.qty);
    if (item.source && !existing.source.includes(item.source)) existing.source += ` + ${item.source}`;
  } else {
    state.items.push({ ...item, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()) });
  }
}

function addText() {
  const input = document.getElementById("groceryInput");
  const parsed = parseInput(input.value);
  parsed.forEach(addOrMerge);
  input.value = "";
  render();
  say("I've updated the shop.");
  document.getElementById("shop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function addMeal(key) {
  recipeMap[key].forEach(addOrMerge);
  render();
  say("Done. I've added the meal and removed duplicate requirements.");
}

function render() {
  const list = document.getElementById("itemsList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";
  empty.style.display = state.items.length ? "none" : "flex";

  state.items.forEach(item => {
    const tpl = document.getElementById("itemTemplate").content.cloneNode(true);
    const name = tpl.querySelector(".item-name");
    const qty = tpl.querySelector(".item-qty");
    const meta = tpl.querySelector(".item-meta");
    name.value = item.name;
    qty.value = item.qty;
    meta.textContent = item.source;

    name.addEventListener("change", e => {
      item.name = normaliseName(e.target.value);
      renderBasket();
    });
    qty.addEventListener("change", e => {
      item.qty = Math.max(0.1, Number(e.target.value) || 1);
      renderBasket();
    });
    tpl.querySelector(".remove-btn").addEventListener("click", () => {
      state.items = state.items.filter(x => x.id !== item.id);
      render();
    });
    list.appendChild(tpl);
  });

  renderBasket();
}

function retailerBasket(retailer) {
  const catalogue = catalogues[retailer];
  let total = 0;
  let matched = 0;
  const missing = [];
  for (const item of state.items) {
    const price = catalogue[item.name];
    if (typeof price === "number") {
      total += price * item.qty;
      matched++;
    } else {
      missing.push(item.name);
    }
  }
  return { retailer, total, matched, missing };
}

function renderBasket() {
  const out = document.getElementById("basketResults");
  out.innerHTML = "";
  if (!state.items.length) {
    out.innerHTML = '<div class="empty-state"><strong>No basket yet.</strong><span>Add groceries and David will compare the demo retailers.</span></div>';
    return;
  }

  const results = Object.keys(catalogues).map(retailerBasket);
  const complete = results.filter(r => r.missing.length === 0);
  const bestComplete = complete.length ? complete.reduce((a, b) => a.total < b.total ? a : b) : null;

  results.forEach(r => {
    const card = document.createElement("div");
    card.className = "basket-card" + (bestComplete && r.retailer === bestComplete.retailer ? " best" : "");
    const priceText = r.matched ? `$${r.total.toFixed(2)}` : "—";
    card.innerHTML = `
      <div class="basket-top">
        <div class="basket-name">${r.retailer}${bestComplete && r.retailer === bestComplete.retailer ? " · Best complete basket" : ""}</div>
        <div class="basket-price">${priceText}</div>
      </div>
      <div class="basket-detail">${r.matched}/${state.items.length} items matched${r.missing.length ? ` · Missing: ${r.missing.join(", ")}` : ""}</div>
    `;
    out.appendChild(card);
  });

  const split = calculateSplitBasket();
  const splitCard = document.createElement("div");
  splitCard.className = "basket-card";
  splitCard.innerHTML = `
    <div class="basket-top">
      <div class="basket-name">Cheapest item-by-item</div>
      <div class="basket-price">${split.missing.length ? "Partial" : `$${split.total.toFixed(2)}`}</div>
    </div>
    <div class="basket-detail">${split.detail}${split.missing.length ? ` · Unmatched: ${split.missing.join(", ")}` : ""}</div>
  `;
  out.appendChild(splitCard);
}

function calculateSplitBasket() {
  let total = 0;
  const byRetailer = {};
  const missing = [];

  for (const item of state.items) {
    const choices = Object.entries(catalogues)
      .map(([retailer, catalogue]) => ({ retailer, price: catalogue[item.name] }))
      .filter(x => typeof x.price === "number")
      .sort((a, b) => a.price - b.price);

    if (!choices.length) {
      missing.push(item.name);
      continue;
    }
    const best = choices[0];
    total += best.price * item.qty;
    byRetailer[best.retailer] = (byRetailer[best.retailer] || 0) + 1;
  }

  return {
    total,
    missing,
    detail: Object.entries(byRetailer).map(([r, count]) => `${count} from ${r}`).join(" · ") || "No matches"
  };
}

function say(text) {
  if (!state.voiceOn || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const maleHint = voices.find(v => /Daniel|Alex|David|Male|UK English Male/i.test(v.name)) || voices.find(v => /en-AU|en-GB|en-US/i.test(v.lang));
  if (maleHint) utter.voice = maleHint;
  window.speechSynthesis.speak(utter);
}

function setMicListening(isListening) {
  const micBtn = document.getElementById("micBtn");
  micBtn.classList.toggle("is-listening", isListening);
  micBtn.setAttribute("aria-label", isListening ? "David is listening" : "Speak to David");
}

function setupVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById("micBtn");
  const status = document.getElementById("speechStatus");

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    status.textContent = "Voice isn’t available in this browser. Type instead.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-AU";
  recognition.interimResults = false;
  recognition.continuous = false;

  micBtn.addEventListener("click", () => recognition.start());
  recognition.onstart = () => {
    status.textContent = "Listening…";
    setMicListening(true);
  };
  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("groceryInput").value = transcript;
    status.textContent = `Heard: “${transcript}”`;
  };
  recognition.onerror = () => {
    status.textContent = "Didn’t catch that. Try again or type it.";
    setMicListening(false);
  };
  recognition.onend = () => setMicListening(false);
}

document.getElementById("addBtn").addEventListener("click", addText);
document.getElementById("groceryInput").addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") addText();
});
document.getElementById("clearBtn").addEventListener("click", () => { state.items = []; render(); });
document.querySelectorAll("[data-meal]").forEach(btn => btn.addEventListener("click", () => addMeal(btn.dataset.meal)));
document.getElementById("voiceToggle").addEventListener("click", e => {
  state.voiceOn = !state.voiceOn;
  e.currentTarget.setAttribute("aria-pressed", String(state.voiceOn));
  const label = e.currentTarget.querySelector(".voice-label");
  if (label) label.textContent = state.voiceOn ? "David voice on" : "David voice off";
  if (state.voiceOn) say("David voice is on.");
});

setupVoiceInput();
render();
