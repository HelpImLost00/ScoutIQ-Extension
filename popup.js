const SCOUTIQ_URL = "https://scoutiq-waitlist-launch.lovable.app";
const SCRAPER_URL = "https://scoutiq-scraper.onrender.com";
const EXT_KEY = "REPLACE_WITH_YOUR_EXT_API_KEY";
const SUPABASE_URL = "https://nhrpopzpizapjsyifjuu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocnBvcHpwaXphcGpzeWlmanV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTk1MTEsImV4cCI6MjA5NjI5NTUxMX0.p-SJv8ywAdo5h9YFQ3szQPuFILsqWuR0_jBLZFe4FqQ";

const RETAILER_BADGES = {
  Amazon: "badge-amazon",
  Walmart: "badge-walmart",
  "Best Buy": "badge-bestbuy",
  Target: "badge-target",
  eBay: "badge-ebay",
  Newegg: "badge-newegg",
};

let currentProduct = null;
let currentResults = [];
let session = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  session = await loadSession();
  updateAuthUI();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return showNotProduct();

  const url = tab.url || "";
  if (!url.startsWith("http")) return showNotProduct();

  // Ask content script for product info
  let productInfo = null;
  try {
    productInfo = await chrome.tabs.sendMessage(tab.id, { type: "GET_PRODUCT_INFO" });
  } catch {
    // Content script not injected yet (navigation just happened) — try injecting manually
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      productInfo = await chrome.tabs.sendMessage(tab.id, { type: "GET_PRODUCT_INFO" });
    } catch {
      return showNotProduct();
    }
  }

  if (!productInfo?.name || productInfo.name.length < 3) return showNotProduct();

  currentProduct = productInfo;
  showProduct(productInfo);
  fetchPrices(productInfo.name);
}

// ─── UI states ────────────────────────────────────────────────────────────────
function show(id) {
  ["stateLoading", "stateNotProduct", "stateProduct"].forEach((s) => {
    document.getElementById(s).style.display = s === id ? "" : "none";
  });
}

function showNotProduct() {
  show("stateNotProduct");
}

function showProduct(info) {
  show("stateProduct");

  document.getElementById("productName").textContent = info.name || "Unknown product";
  document.getElementById("productSource").textContent = info.host || "";
  if (info.price) {
    document.getElementById("productCurrentPrice").textContent = `Listed at ${info.price}`;
  }

  if (info.image) {
    const img = document.getElementById("productImage");
    img.src = info.image;
    img.style.display = "";
    img.onerror = () => { img.style.display = "none"; };
    document.getElementById("productImagePlaceholder").style.display = "none";
  }
}

// ─── Compare API ──────────────────────────────────────────────────────────────
async function fetchPrices(productName) {
  document.getElementById("resultsLoading").style.display = "";
  document.getElementById("resultsList").style.display = "none";
  document.getElementById("resultsError").style.display = "none";
  document.getElementById("trackSection").style.display = "none";

  try {
    const res = await fetch(
      `${SCRAPER_URL}/ext/compare?q=${encodeURIComponent(productName)}`,
      { headers: { "x-ext-key": EXT_KEY } },
    );
    const json = await res.json();

    document.getElementById("resultsLoading").style.display = "none";

    if (!json.success || !Array.isArray(json.results) || json.results.length === 0) {
      showResultsError("No prices found. Try searching on the ScoutIQ app.");
      return;
    }

    // Filter and sort by price
    currentResults = json.results
      .filter((r) => r.price > 0 && r.url)
      .sort((a, b) => a.price - b.price);

    renderResults(currentResults);
  } catch {
    document.getElementById("resultsLoading").style.display = "none";
    showResultsError("Couldn't reach ScoutIQ. Check your connection.");
  }
}

function showResultsError(msg) {
  const el = document.getElementById("resultsError");
  el.textContent = msg;
  el.style.display = "";
}

function fmtPrice(price) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
}

function renderResults(results) {
  const list = document.getElementById("resultsList");
  list.innerHTML = "";

  results.slice(0, 6).forEach((r, i) => {
    const isBest = i === 0;
    const badgeClass = RETAILER_BADGES[r.retailer] || "badge-other";

    const a = document.createElement("a");
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = `result-row${isBest ? " best" : ""}`;

    a.innerHTML = `
      <span class="retailer-badge ${badgeClass}">${r.retailer}</span>
      <span class="result-name">${r.name.slice(0, 60)}</span>
      ${isBest ? '<span class="best-label">BEST</span>' : ""}
      <span class="result-price">${fmtPrice(r.price)}</span>
      <span class="external-icon">↗</span>
    `;

    list.appendChild(a);
  });

  list.style.display = "flex";
  document.getElementById("trackSection").style.display = "";

  updateTrackButton();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function loadSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["sb_session"], (result) => {
      const s = result.sb_session;
      if (!s) return resolve(null);
      // Check expiry
      if (s.expires_at && Date.now() / 1000 > s.expires_at) {
        chrome.storage.local.remove("sb_session");
        return resolve(null);
      }
      resolve(s);
    });
  });
}

function saveSession(s) {
  chrome.storage.local.set({ sb_session: s });
  session = s;
}

function clearSession() {
  chrome.storage.local.remove("sb_session");
  session = null;
}

function updateAuthUI() {
  const signedInAs = document.getElementById("signedInAs");
  const btnSignOut = document.getElementById("btnSignOut");
  if (session?.user?.email) {
    signedInAs.textContent = session.user.email;
    signedInAs.style.display = "";
    btnSignOut.style.display = "";
  } else {
    signedInAs.style.display = "none";
    btnSignOut.style.display = "none";
  }
}

async function signIn() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const errorEl = document.getElementById("authError");
  errorEl.textContent = "";

  if (!email || !password) {
    errorEl.textContent = "Enter your email and password.";
    return;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      },
    );
    const json = await res.json();

    if (!res.ok || json.error) {
      errorEl.textContent = json.error_description || json.message || "Sign in failed.";
      return;
    }

    saveSession({ access_token: json.access_token, user: json.user, expires_at: json.expires_at });
    updateAuthUI();
    document.getElementById("authSection").style.display = "none";
    updateTrackButton();
    // Auto-track after sign in
    handleTrack();
  } catch {
    errorEl.textContent = "Network error. Try again.";
  }
}

function signOut() {
  clearSession();
  updateAuthUI();
  updateTrackButton();
}

// ─── Track ────────────────────────────────────────────────────────────────────
async function handleTrack() {
  if (!currentProduct || currentResults.length === 0) return;

  if (!session) {
    document.getElementById("authSection").style.display = "";
    document.getElementById("authEmail").focus();
    return;
  }

  const best = currentResults[0];
  const btn = document.getElementById("btnTrack");
  btn.disabled = true;
  btn.textContent = "Adding…";

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tracked_products`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: session.user.id,
        product_name: currentProduct.name,
        url: currentProduct.url,
        retailer: best.retailer,
        current_price: best.price,
        currency: "USD",
        drop_threshold_pct: 5,
        scrape_status: "pending",
      }),
    });

    if (res.status === 401) {
      clearSession();
      session = null;
      updateAuthUI();
      document.getElementById("authSection").style.display = "";
      btn.disabled = false;
      btn.textContent = "♡ Track this product";
      return;
    }

    if (!res.ok && res.status !== 201) {
      btn.disabled = false;
      btn.textContent = "♡ Track this product";
      document.getElementById("trackHint").textContent = "Couldn't add — try again.";
      return;
    }

    btn.className = "btn-track tracked";
    btn.textContent = "✓ Tracked";
    btn.disabled = true;
    document.getElementById("trackHint").innerHTML =
      `<a href="${SCOUTIQ_URL}/dashboard" target="_blank">View in watchlist ↗</a>`;
    document.getElementById("authSection").style.display = "none";
  } catch {
    btn.disabled = false;
    btn.textContent = "♡ Track this product";
    document.getElementById("trackHint").textContent = "Network error. Try again.";
  }
}

function updateTrackButton() {
  const btn = document.getElementById("btnTrack");
  const hint = document.getElementById("trackHint");
  if (!btn) return;

  if (!session) {
    btn.className = "btn-track";
    btn.disabled = false;
    btn.textContent = "♡ Track this product";
    hint.innerHTML = `<a href="${SCOUTIQ_URL}/signup" target="_blank">Sign in or create a free account</a>`;
  } else {
    btn.className = "btn-track";
    btn.disabled = false;
    btn.textContent = "♡ Track this product";
    hint.textContent = "";
  }
}

function openApp() {
  chrome.tabs.create({ url: `${SCOUTIQ_URL}/dashboard` });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
