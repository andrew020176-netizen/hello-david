const STORAGE_KEY = "helloDavid.household.v1";

const defaultState = {
  voiceOn: true,
  items: [],
  memory: {}
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...defaultState,
      ...(saved && typeof saved === "object" ? saved : {}),
      items: Array.isArray(saved?.items) ? saved.items : [],
      memory: saved?.memory && typeof saved.memory === "object" ? saved.memory : {}
    };
  } catch {
    return { ...defaultState };
  }
}

const state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The prototype should keep working even if browser storage is blocked.
  }
}

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

const productAliases = {
  "salmon fillets": ["salmon fillets", "salmon fillet", "salmon"],
  "vegetable stock": ["vegetable stock", "veggie stock", "veg stock", "stock"],
  spinach: ["spinach"],
  milk: ["full cream milk", "full-cream milk", "whole milk", "milk"],
  "weet-bix": ["weet-bix", "weetbix", "weet bix"],
  bananas: ["bananas", "banana"],
  "burger buns": ["burger buns", "hamburger buns", "brioche buns", "buns"],
  "beef patties": ["beef patties", "burger patties", "hamburger patties", "patties"],
  lettuce: ["lettuce"],
  tomatoes: ["tomatoes", "tomato"],
  "chicken breast": ["chicken breast", "chicken breasts", "chicken"],
  tortillas: ["large tortillas", "tortillas", "tortilla wraps", "wraps"],
  capsicum: ["capsicums", "capsicum", "bell peppers", "bell pepper"],
  onion: ["brown onions", "red onions", "onions", "onion"],
  broccoli: ["broccoli"],
  rice: ["rice"],
  garlic: ["garlic"],
  avocado: ["avocados", "avocado"],
  eggs: ["eggs", "egg"],
  yoghurt: ["yoghurt", "yogurt"],
  bread: ["bread"],
  butter: ["butter"],
  cheese: ["cheese"],
  carrots: ["carrots", "carrot"],
  mushrooms: ["mushrooms", "mushroom"],
  apples: ["apples", "apple"],
  oranges: ["oranges", "orange"]
};

const mealAliases = {
  salmon: ["salmon and greens", "salmon + greens", "salmon dinner"],
  burgers: ["burgers", "burger night", "hamburgers"],
  fajitas: ["chicken fajitas", "fajitas", "fajita night"]
};

const numberWords = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  couple: 2,
  dozen: 12
};

const unitWords = [
  "kg", "g", "grams", "litres", "liters", "litre", "liter", "l", "ml",
  "packs", "pack", "packets", "packet", "cartons", "carton", "bags", "bag",
  "bottles", "bottle", "tins", "tin", "cans", "can", "boxes", "box",
  "fillets", "fillet", "heads", "head", "bunches", "bunch"
];

const exclusionPhrases = [
  "still have", "we have", "we've got", "weve got", "already have", "plenty of",
  "don't need", "dont need", "do not need", "no need for", "skip", "remove",
  "take off", "leave off", "not the", "don't get", "dont get"
];

function cleanSpeech(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseIndex(text, phrases) {
  let best = -1;
  let phrase = "";
  for (const candidate of phrases) {
    const idx = text.indexOf(candidate);
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx;
      phrase = candidate;
    }
  }
  return { index: best, phrase };
}

function mentionedProducts(text) {
  const found = [];
  for (const [canonical, aliases] of Object.entries(productAliases)) {
    for (const alias of aliases.sort((a, b) => b.length - a.length)) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = text.match(new RegExp(`\\b${escaped}\\b`, "i"));
      if (match) {
        found.push({ canonical, alias, index: match.index ?? 0, raw: match[0] });
        break;
      }
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

function quantityNear(text, matchIndex, alias) {
  const before = text.slice(Math.max(0, matchIndex - 55), matchIndex).trim();
  const aliasEscaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const direct = text.slice(Math.max(0, matchIndex - 45), matchIndex + alias.length + 4);

  const digitPatterns = [
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${unitWords.join("|")})?\\s*(?:of\\s+)?${aliasEscaped}`, "i"),
    /(?:^|\s)(\d+(?:\.\d+)?)\s*$/i
  ];

  for (const pattern of digitPatterns) {
    const m = direct.match(pattern) || before.match(pattern);
    if (m) return Number(m[1]);
  }

  const tokens = before.split(/\s+/).slice(-6);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i].replace(/[^a-z]/g, "");
    if (Object.prototype.hasOwnProperty.call(numberWords, token)) return numberWords[token];
  }

  return 1;
}

function unitNear(text, matchIndex) {
  const before = text.slice(Math.max(0, matchIndex - 45), matchIndex).toLowerCase();
  for (const unit of unitWords) {
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(before)) return unit;
  }
  return "";
}

function isExcludedMention(text, mention) {
  const clauseStart = Math.max(
    text.lastIndexOf(",", mention.index),
    text.lastIndexOf(".", mention.index),
    text.lastIndexOf(";", mention.index),
    text.lastIndexOf(" but ", mention.index),
    text.lastIndexOf(" and ", mention.index)
  );
  const local = text.slice(Math.max(0, clauseStart), mention.index + mention.alias.length + 8);
  return exclusionPhrases.some(phrase => local.includes(phrase));
}

function extractMealIntents(text) {
  const meals = [];
  for (const [key, aliases] of Object.entries(mealAliases)) {
    if (aliases.some(alias => text.includes(alias))) meals.push(key);
  }
  return meals;
}

function stripConversationalNoise(text) {
  return text
    .replace(/\b(?:we need|we also need|need|please get|get|grab|pick up|buy|add|put down|can you add|we're out of|we are out of|i need|i also need)\b/gi, "")
    .replace(/\b(?:for monday|for tuesday|for wednesday|for thursday|for friday|for saturday|for sunday|this week|next week|tonight|tomorrow)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseFallbackName(name) {
  return stripConversationalNoise(name)
    .replace(/^[-:]+|[-:]+$/g, "")
    .replace(/\b(?:some|a|an|large|small|packet of|pack of|cartons? of|bags? of|bottles? of|tins? of|cans? of)\b/gi, "")
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|dozen|\d+(?:\.\d+)?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFallbackItems(text, occupiedRanges) {
  const masked = text.split("");
  occupiedRanges.forEach(([start, end]) => {
    for (let i = start; i < end && i < masked.length; i++) masked[i] = " ";
  });

  return masked.join("")
    .split(/[,.;]|\band\b/gi)
    .map(stripConversationalNoise)
    .map(part => part.trim())
    .filter(part => part.length >= 2)
    .filter(part => !exclusionPhrases.some(phrase => part.includes(phrase)))
    .map(part => {
      let qty = 1;
      const digit = part.match(/\b(\d+(?:\.\d+)?)\b/);
      if (digit) qty = Number(digit[1]);
      else {
        const word = Object.keys(numberWords).find(w => new RegExp(`\\b${w}\\b`).test(part));
        if (word) qty = numberWords[word];
      }
      const name = normaliseFallbackName(part);
      return name ? { name, qty, unit: "", source: "Voice / typed" } : null;
    })
    .filter(Boolean);
}

function parseInput(rawText) {
  const text = cleanSpeech(rawText);
  const mentions = mentionedProducts(text);
  const items = [];
  const exclusions = [];
  const occupied = [];

  for (const mention of mentions) {
    occupied.push([Math.max(0, mention.index - 28), mention.index + mention.alias.length + 8]);
    const record = {
      name: mention.canonical,
      qty: quantityNear(text, mention.index, mention.alias),
      unit: unitNear(text, mention.index),
      source: "Voice / typed"
    };
    if (isExcludedMention(text, mention)) exclusions.push(record.name);
    else items.push(record);
  }

  const fallback = extractFallbackItems(text, occupied);
  return {
    items: [...items, ...fallback],
    exclusions,
    meals: extractMealIntents(text)
  };
}

function rememberItem(item) {
  const now = Date.now();
  const entry = state.memory[item.name] || { count: 0, lastAdded: null, quantities: [] };
  entry.count += 1;
  entry.lastAdded = now;
  entry.quantities = [...(entry.quantities || []), item.qty].slice(-12);
  state.memory[item.name] = entry;
}

function addOrMerge(item, shouldRemember = true) {
  const canonical = item.name.toLowerCase().trim();
  const existing = state.items.find(x => x.name === canonical);
  if (existing) {
    existing.qty = Math.max(Number(existing.qty) || 1, Number(item.qty) || 1);
    if (item.unit && !existing.unit) existing.unit = item.unit;
    if (item.source && !existing.source.includes(item.source)) existing.source += ` + ${item.source}`;
  } else {
    state.items.push({
      ...item,
      name: canonical,
      qty: Number(item.qty) || 1,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
    });
  }
  if (shouldRemember) rememberItem({ ...item, name: canonical });
}

function removeByName(name) {
  const canonical = name.toLowerCase().trim();
  const before = state.items.length;
  state.items = state.items.filter(x => x.name !== canonical);
  return before !== state.items.length;
}

function addMeal(key, options = {}) {
  const meal = recipeMap[key];
  if (!meal) return 0;
  meal.forEach(item => addOrMerge(item, options.remember !== false));
  if (!options.silent) {
    render();
    say("Done. I've added the meal without duplicating what's already in the shop.");
    setStatus("Dinner sorted. I added what you need and kept duplicates out.");
  }
  return meal.length;
}

function setStatus(message) {
  const el = document.getElementById("speechStatus");
  if (el) el.textContent = message;
}

function addText(textOverride = null) {
  const input = document.getElementById("groceryInput");
  const text = textOverride ?? input.value;
  if (!String(text).trim()) {
    setStatus("Tell me what you need first.");
    return;
  }

  const parsed = parseInput(text);
  let added = 0;
  let removed = 0;
  let mealCount = 0;

  parsed.exclusions.forEach(name => {
    if (removeByName(name)) removed += 1;
  });

  parsed.items.forEach(item => {
    addOrMerge(item);
    added += 1;
  });

  parsed.meals.forEach(key => {
    addMeal(key, { silent: true });
    mealCount += 1;
  });

  input.value = "";
  saveState();
  render();

  const bits = [];
  if (added) bits.push(`${added} ${added === 1 ? "item" : "items"} added`);
  if (mealCount) bits.push(`${mealCount} ${mealCount === 1 ? "dinner" : "dinners"} sorted`);
  if (removed) bits.push(`${removed} thing you already have removed`);
  const summary = bits.length ? bits.join(" · ") : "I didn't find anything to add yet";
  setStatus(summary + ". Saved on this device.");
  say(bits.length ? "Done. I've updated the shop." : "I didn't catch a grocery item there.");
}

function render() {
  const list = document.getElementById("itemsList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";
  empty.style.display = state.items.length ? "none" : "block";

  state.items.forEach(item => {
    const tpl = document.getElementById("itemTemplate").content.cloneNode(true);
    const name = tpl.querySelector(".item-name");
    const qty = tpl.querySelector(".item-qty");
    const meta = tpl.querySelector(".item-meta");
    name.value = item.name;
    qty.value = item.qty;
    meta.textContent = [item.unit, item.source].filter(Boolean).join(" · ");

    name.addEventListener("change", e => {
      item.name = e.target.value.toLowerCase().trim();
      saveState();
      renderBasket();
    });
    qty.addEventListener("change", e => {
      item.qty = Math.max(0.1, Number(e.target.value) || 1);
      saveState();
      renderBasket();
    });
    tpl.querySelector(".remove-btn").addEventListener("click", () => {
      state.items = state.items.filter(x => x.id !== item.id);
      saveState();
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
    out.innerHTML = '<div class="empty-state">Add some groceries to compare baskets.</div>';
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

function setupVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById("micBtn");

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    setStatus("Voice dictation isn't available in this browser. Type your list instead. Your shop will still be saved.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-AU";
  recognition.interimResults = false;
  recognition.continuous = false;

  micBtn.addEventListener("click", () => {
    try {
      recognition.start();
    } catch {
      // Ignore duplicate-start errors from rapid clicks.
    }
  });

  recognition.onstart = () => {
    setStatus("Listening… just talk normally.");
    micBtn.textContent = "Listening…";
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("groceryInput").value = transcript;
    setStatus(`Heard: “${transcript}”`);
    micBtn.textContent = "🎙 Speak";
    setTimeout(() => addText(transcript), 250);
  };

  recognition.onerror = () => {
    setStatus("I couldn't catch that. Try again or type it.");
    micBtn.textContent = "🎙 Speak";
  };

  recognition.onend = () => {
    if (micBtn.textContent === "Listening…") micBtn.textContent = "🎙 Speak";
  };
}

document.getElementById("addBtn").addEventListener("click", () => addText());
document.getElementById("groceryInput").addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") addText();
});
document.getElementById("clearBtn").addEventListener("click", () => {
  state.items = [];
  saveState();
  render();
  setStatus("This week's shop is clear. I kept your household memory.");
});
document.querySelectorAll("[data-meal]").forEach(btn => btn.addEventListener("click", () => addMeal(btn.dataset.meal)));
document.getElementById("voiceToggle").addEventListener("click", e => {
  state.voiceOn = !state.voiceOn;
  saveState();
  e.currentTarget.setAttribute("aria-pressed", String(state.voiceOn));
  e.currentTarget.textContent = state.voiceOn ? "🔊 David voice on" : "🔇 David voice off";
  if (state.voiceOn) say("David voice is on.");
});

const voiceToggle = document.getElementById("voiceToggle");
voiceToggle.setAttribute("aria-pressed", String(state.voiceOn));
voiceToggle.textContent = state.voiceOn ? "🔊 David voice on" : "🔇 David voice off";
setupVoiceInput();
render();
if (state.items.length) setStatus(`Welcome back. ${state.items.length} ${state.items.length === 1 ? "item is" : "items are"} still on this week's shop.`);
