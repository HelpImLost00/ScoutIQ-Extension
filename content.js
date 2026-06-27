const SCOUTIQ_URL = "https://scoutiq-waitlist-launch.lovable.app";
const SUPABASE_URL = "https://nhrpopzpizapjsyifjuu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocnBvcHpwaXphcGpzeWlmanV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTk1MTEsImV4cCI6MjA5NjI5NTUxMX0.p-SJv8ywAdo5h9YFQ3szQPuFILsqWuR0_jBLZFe4FqQ";

// ─── Product extraction ────────────────────────────────────────────────────────
function getMetaContent(property) {
  const el =
    document.querySelector(`meta[property="${property}"]`) ||
    document.querySelector(`meta[name="${property}"]`);
  return el ? el.getAttribute("content") : null;
}

function extractProductInfo() {
  const host = location.hostname.replace("www.", "");
  let name = null, price = null, image = null;

  if (host.includes("amazon")) {
    name = document.getElementById("productTitle")?.textContent?.trim();
    price = document.querySelector(".a-price .a-offscreen")?.textContent?.trim();
    image = document.getElementById("landingImage")?.getAttribute("src");
  } else if (host.includes("walmart")) {
    name = document.querySelector('[itemprop="name"]')?.textContent?.trim()
        || document.querySelector("h1[class*='ProductTitle']")?.textContent?.trim();
    price = document.querySelector('[itemprop="price"]')?.getAttribute("content");
    image = document.querySelector('[data-testid="hero-image"] img')?.getAttribute("src");
  } else if (host.includes("bestbuy")) {
    name = document.querySelector("h1.sku-title")?.textContent?.trim();
    price = document.querySelector(".priceView-hero-price span")?.textContent?.trim();
    image = document.querySelector(".primary-image")?.getAttribute("src");
  } else if (host.includes("target")) {
    name = document.querySelector('[data-test="product-title"]')?.textContent?.trim();
    price = document.querySelector("[data-test='product-price']")?.textContent?.trim();
    image = document.querySelector("[data-test='product-image']")?.getAttribute("src");
  } else if (host.includes("ebay")) {
    name = document.querySelector("h1.x-item-title__mainTitle")?.textContent?.trim()
        || document.querySelector("#itemTitle")?.textContent?.replace("Details about", "").trim();
    price = document.querySelector(".x-price-primary .ux-textspans")?.textContent?.trim();
    image = document.querySelector("#icImg")?.getAttribute("src");
  } else if (host.includes("newegg")) {
    name = document.querySelector(".product-title")?.textContent?.trim();
    price = document.querySelector(".price-current strong")?.textContent?.trim();
    image = document.querySelector(".product-view-img-original img")?.getAttribute("src");
  }

  name = name || getMetaContent("og:title") || document.title;
  image = image || getMetaContent("og:image");

  if (name) {
    name = name
      .replace(/\s*[\|–\-]\s*(Amazon|Walmart|Best Buy|Target|eBay|Newegg).*$/i, "")
      .replace(/\s*:\s*Amazon\.com.*$/i, "")
      .trim()
      .slice(0, 200);
  }

  return { name, price, image, url: location.href, host };
}

// ─── Floating panel ────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  #sq-wrap {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
  }

  #sq-pill {
    display: flex;
    align-items: center;
    gap: 7px;
    background: #7c3aed;
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 9px 15px 9px 10px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(124,58,237,0.45);
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  #sq-pill:hover { background: #6d28d9; transform: scale(1.03); }
  #sq-pill .sq-icon { font-size: 15px; }

  #sq-panel {
    display: none;
    width: 340px;
    background: #0f0f0f;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    overflow: hidden;
  }

  .sq-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 13px;
    background: #0a0a0a;
    border-bottom: 1px solid #1e1e1e;
  }
  .sq-logo {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 14px;
    color: #f0f0f0;
  }
  .sq-logo-icon {
    width: 22px; height: 22px;
    background: #7c3aed;
    border-radius: 5px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px;
  }
  .sq-close {
    background: none; border: none; color: #666;
    font-size: 18px; cursor: pointer; line-height: 1;
    padding: 2px 4px; border-radius: 4px;
  }
  .sq-close:hover { color: #f0f0f0; background: #1e1e1e; }

  .sq-body { padding: 11px 13px; }

  .sq-product {
    display: flex; gap: 9px; align-items: flex-start;
    margin-bottom: 10px;
  }
  .sq-product img {
    width: 44px; height: 44px;
    border-radius: 6px; border: 1px solid #222;
    object-fit: contain; background: #1a1a1a; flex-shrink: 0;
  }
  .sq-product-name {
    font-size: 12px; font-weight: 600; color: #e0e0e0;
    display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .sq-product-price { font-size: 11px; color: #777; margin-top: 2px; }

  .sq-section-label {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: #555; margin-bottom: 6px;
  }

  .sq-spinner {
    width: 20px; height: 20px;
    border: 2px solid #2a2a2a; border-top-color: #7c3aed;
    border-radius: 50%;
    animation: sq-spin 0.7s linear infinite;
    margin: 12px auto;
  }
  @keyframes sq-spin { to { transform: rotate(360deg); } }

  .sq-results { display: flex; flex-direction: column; gap: 3px; }
  .sq-result {
    display: flex; align-items: center; gap: 7px;
    padding: 7px 9px; border-radius: 7px;
    border: 1px solid #1e1e1e; background: #141414;
    text-decoration: none; color: inherit;
    transition: border-color 0.12s, background 0.12s;
    cursor: pointer;
  }
  .sq-result:hover { border-color: #7c3aed44; background: #1a1220; }
  .sq-result.sq-best { border-color: #059669; background: #052e1a; }

  .sq-badge {
    font-size: 9px; font-weight: 700; padding: 2px 5px;
    border-radius: 4px; flex-shrink: 0;
  }
  .sq-badge-amazon { background: #7b3f0020; color: #f59e0b; }
  .sq-badge-walmart { background: #1d4ed820; color: #60a5fa; }
  .sq-badge-bestbuy { background: #78350f20; color: #fde68a; }
  .sq-badge-target  { background: #7f1d1d20; color: #fca5a5; }
  .sq-badge-ebay    { background: #06402920; color: #6ee7b7; }
  .sq-badge-newegg  { background: #4c1d9520; color: #c4b5fd; }
  .sq-badge-other   { background: #1c1c1c; color: #888; }

  .sq-result-name {
    flex: 1; font-size: 11px; color: #bbb;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sq-result-price { font-size: 13px; font-weight: 700; color: #f0f0f0; flex-shrink: 0; }
  .sq-best .sq-result-price { color: #34d399; }
  .sq-best-label {
    font-size: 8px; font-weight: 700; color: #34d399;
    border: 1px solid #05281640; padding: 1px 4px; border-radius: 3px; flex-shrink: 0;
  }

  .sq-track-section { margin-top: 9px; padding-top: 9px; border-top: 1px solid #1e1e1e; }
  .sq-btn-track {
    width: 100%; padding: 8px; border-radius: 7px; border: none;
    font-size: 12px; font-weight: 600; cursor: pointer;
    background: #7c3aed; color: #fff; transition: background 0.15s;
  }
  .sq-btn-track:hover { background: #6d28d9; }
  .sq-btn-track:disabled { background: #3b2b6b; color: #888; cursor: default; }
  .sq-btn-track.sq-tracked { background: #052e1a; color: #34d399; border: 1px solid #059669; }

  .sq-hint { margin-top: 5px; text-align: center; font-size: 10px; color: #555; }
  .sq-hint a { color: #7c3aed; text-decoration: none; }

  .sq-auth { margin-top: 9px; padding-top: 9px; border-top: 1px solid #1e1e1e; }
  .sq-auth-title { font-size: 12px; font-weight: 600; color: #ddd; margin-bottom: 8px; }
  .sq-field { margin-bottom: 6px; }
  .sq-field label { display: block; font-size: 10px; color: #777; margin-bottom: 3px; }
  .sq-field input {
    width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a;
    border-radius: 5px; padding: 6px 9px; color: #f0f0f0;
    font-size: 12px; outline: none;
  }
  .sq-field input:focus { border-color: #7c3aed; }
  .sq-auth-error { font-size: 10px; color: #f87171; margin-bottom: 6px; min-height: 14px; }
  .sq-btn-login {
    width: 100%; padding: 7px; border-radius: 6px; border: none;
    font-size: 12px; font-weight: 600; cursor: pointer;
    background: #7c3aed; color: #fff;
  }
  .sq-auth-footer { margin-top: 6px; text-align: center; font-size: 10px; color: #555; }
  .sq-auth-footer a { color: #7c3aed; text-decoration: none; }

  .sq-error { text-align: center; font-size: 11px; color: #888; padding: 12px 0; }
`;

const HTML = `
  <div id="sq-wrap">
    <button id="sq-pill">
      <span class="sq-icon">⚡</span>
      <span id="sq-pill-label">Compare prices</span>
    </button>
    <div id="sq-panel">
      <div class="sq-header">
        <div class="sq-logo">
          <div class="sq-logo-icon">⚡</div>
          ScoutIQ
        </div>
        <button class="sq-close" id="sq-close">✕</button>
      </div>
      <div class="sq-body">
        <div class="sq-product" id="sq-product" style="display:none">
          <img id="sq-img" style="display:none" />
          <div>
            <div class="sq-product-name" id="sq-product-name"></div>
            <div class="sq-product-price" id="sq-product-price"></div>
          </div>
        </div>
        <div class="sq-section-label">PRICES ACROSS THE WEB</div>
        <div class="sq-spinner" id="sq-spinner"></div>
        <div class="sq-results" id="sq-results" style="display:none"></div>
        <div class="sq-error" id="sq-error" style="display:none"></div>
        <div class="sq-track-section" id="sq-track-section" style="display:none">
          <button class="sq-btn-track" id="sq-btn-track">♡ Track this product</button>
          <div class="sq-hint" id="sq-hint"></div>
        </div>
        <div class="sq-auth" id="sq-auth" style="display:none">
          <div class="sq-auth-title">Sign in to track prices</div>
          <div class="sq-field">
            <label>Email</label>
            <input type="email" id="sq-email" placeholder="you@email.com" />
          </div>
          <div class="sq-field">
            <label>Password</label>
            <input type="password" id="sq-password" placeholder="••••••••" />
          </div>
          <div class="sq-auth-error" id="sq-auth-error"></div>
          <button class="sq-btn-login" id="sq-btn-login">Sign in</button>
          <div class="sq-auth-footer">
            No account? <a href="${SCOUTIQ_URL}/signup" target="_blank">Sign up free ↗</a>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// ─── State ────────────────────────────────────────────────────────────────────
let panelOpen = false;
let productInfo = null;
let compareResults = [];
let session = null;
let shadow = null;

function $(id) { return shadow.getElementById(id); }

// ─── Session ──────────────────────────────────────────────────────────────────
async function loadSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["sb_session"], (r) => {
      const s = r.sb_session;
      if (!s || (s.expires_at && Date.now() / 1000 > s.expires_at)) {
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

// ─── Panel toggle ─────────────────────────────────────────────────────────────
function openPanel() {
  $("sq-panel").style.display = "block";
  $("sq-pill").style.display = "none";
  panelOpen = true;
  if (compareResults.length === 0) fetchPrices();
}

function closePanel() {
  $("sq-panel").style.display = "none";
  $("sq-pill").style.display = "flex";
  panelOpen = false;
}

// ─── Render product ───────────────────────────────────────────────────────────
function renderProduct(info) {
  $("sq-product").style.display = "flex";
  $("sq-product-name").textContent = info.name;
  if (info.price) $("sq-product-price").textContent = `Listed at ${info.price}`;
  if (info.image) {
    const img = $("sq-img");
    img.src = info.image;
    img.style.display = "";
    img.onerror = () => { img.style.display = "none"; };
  }
}

// ─── Compare ──────────────────────────────────────────────────────────────────
function fmtPrice(p) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p);
}

const BADGES = { Amazon: "amazon", Walmart: "walmart", "Best Buy": "bestbuy", Target: "target", eBay: "ebay", Newegg: "newegg" };

async function fetchPrices() {
  $("sq-spinner").style.display = "";
  $("sq-results").style.display = "none";
  $("sq-error").style.display = "none";
  $("sq-track-section").style.display = "none";

  try {
    const res = await fetch(
      `${SCOUTIQ_URL}/api/public/extension/compare?q=${encodeURIComponent(productInfo.name)}`,
    );
    const json = await res.json();
    $("sq-spinner").style.display = "none";

    if (!json.success || !Array.isArray(json.results) || !json.results.length) {
      $("sq-error").textContent = "No prices found for this product.";
      $("sq-error").style.display = "";
      return;
    }

    compareResults = json.results
      .filter((r) => r.price > 0 && r.url)
      .sort((a, b) => a.price - b.price);

    renderResults();
  } catch {
    $("sq-spinner").style.display = "none";
    $("sq-error").textContent = "Couldn't reach ScoutIQ — check your connection or try again.";
    $("sq-error").style.display = "";
  }
}

function renderResults() {
  const list = $("sq-results");
  list.innerHTML = "";

  compareResults.slice(0, 5).forEach((r, i) => {
    const isBest = i === 0;
    const badgeClass = `sq-badge-${BADGES[r.retailer] || "other"}`;
    const a = document.createElement("a");
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = `sq-result${isBest ? " sq-best" : ""}`;
    a.innerHTML = `
      <span class="sq-badge ${badgeClass}">${r.retailer}</span>
      <span class="sq-result-name">${r.name.slice(0, 45)}</span>
      ${isBest ? '<span class="sq-best-label">BEST</span>' : ""}
      <span class="sq-result-price">${fmtPrice(r.price)}</span>
    `;
    list.appendChild(a);
  });

  list.style.display = "flex";
  $("sq-track-section").style.display = "";
  updateTrackBtn();
}

// ─── Track ────────────────────────────────────────────────────────────────────
function updateTrackBtn() {
  const btn = $("sq-btn-track");
  if (!session) {
    btn.textContent = "♡ Track this product";
    btn.disabled = false;
    btn.className = "sq-btn-track";
    $("sq-hint").innerHTML = `<a href="${SCOUTIQ_URL}/signup" target="_blank">Sign in or create a free account</a>`;
  }
}

async function handleTrack() {
  if (!compareResults.length) return;
  if (!session) {
    $("sq-auth").style.display = "";
    $("sq-email").focus();
    return;
  }

  const btn = $("sq-btn-track");
  btn.disabled = true;
  btn.textContent = "Adding…";

  const best = compareResults[0];
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
        product_name: productInfo.name,
        url: productInfo.url,
        retailer: best.retailer,
        current_price: best.price,
        currency: "USD",
        drop_threshold_pct: 5,
        scrape_status: "pending",
      }),
    });

    if (res.status === 401) {
      session = null;
      chrome.storage.local.remove("sb_session");
      $("sq-auth").style.display = "";
      btn.disabled = false;
      btn.textContent = "♡ Track this product";
      return;
    }

    btn.className = "sq-btn-track sq-tracked";
    btn.textContent = "✓ Tracked";
    btn.disabled = true;
    $("sq-hint").innerHTML = `<a href="${SCOUTIQ_URL}/dashboard" target="_blank">View in watchlist ↗</a>`;
    $("sq-auth").style.display = "none";
  } catch {
    btn.disabled = false;
    btn.textContent = "♡ Track this product";
    $("sq-hint").textContent = "Error — try again.";
  }
}

async function handleSignIn() {
  const email = $("sq-email").value.trim();
  const password = $("sq-password").value;
  const errEl = $("sq-auth-error");
  errEl.textContent = "";
  if (!email || !password) { errEl.textContent = "Enter email and password."; return; }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      errEl.textContent = json.error_description || "Sign in failed.";
      return;
    }
    saveSession({ access_token: json.access_token, user: json.user, expires_at: json.expires_at });
    $("sq-auth").style.display = "none";
    handleTrack();
  } catch {
    errEl.textContent = "Network error.";
  }
}

// ─── Inject panel ─────────────────────────────────────────────────────────────
function inject(info) {
  if (document.getElementById("__scoutiq__")) return;
  const host = document.createElement("div");
  host.id = "__scoutiq__";
  document.body.appendChild(host);
  shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = CSS;
  shadow.appendChild(styleEl);

  const wrap = document.createElement("div");
  wrap.innerHTML = HTML;
  shadow.appendChild(wrap);

  // Wire events
  $("sq-pill").addEventListener("click", openPanel);
  $("sq-close").addEventListener("click", closePanel);
  $("sq-btn-track").addEventListener("click", handleTrack);
  $("sq-btn-login").addEventListener("click", handleSignIn);
  $("sq-password").addEventListener("keydown", (e) => { if (e.key === "Enter") handleSignIn(); });

  renderProduct(info);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  const info = extractProductInfo();
  if (!info.name || info.name.length < 5) return;

  productInfo = info;
  session = await loadSession();
  inject(info);
}

// Wait for page to settle then detect
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  setTimeout(boot, 800);
}

// Also respond to popup messages
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_PRODUCT_INFO") {
    sendResponse(productInfo || extractProductInfo());
  }
  return true;
});
