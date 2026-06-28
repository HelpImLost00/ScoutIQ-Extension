// Plain IIFE — const declarations are function-scoped so re-injection is safe.
// window.__sq_nav_observer is disconnected before re-registering.
(() => { try {
console.log("[ScoutIQ] content.js initializing");

const SCOUTIQ_URL = "https://scoutiq10.lovable.app";
const SCRAPER_URL = "https://scoutiq-scraper.onrender.com";
const EXT_KEY = "sq_ext_Kp7mN3xQ9vR2wL5j";
const SUPABASE_URL = "https://qxsegnzpjbxmunfnvavh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4c2VnbnpwamJ4bXVuZm52YXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTU0OTcsImV4cCI6MjA5NjI5MTQ5N30.obX93Mxx_pZ3csXAVLW1j4fYT5wC0QM4um-8--nDryA";

// ─── Product detection ─────────────────────────────────────────────────────────
function getMetaContent(property) {
  const el =
    document.querySelector(`meta[property="${property}"]`) ||
    document.querySelector(`meta[name="${property}"]`);
  return el ? el.getAttribute("content") : null;
}

function getSchemaOrg() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "Product") return item;
        // Nested graph
        if (item["@graph"]) {
          const p = item["@graph"].find((n) => n["@type"] === "Product");
          if (p) return p;
        }
      }
    } catch {}
  }
  return null;
}

function isProductPage() {
  const path = location.pathname.toLowerCase();
  const search = location.search.toLowerCase();
  const host = location.hostname.replace("www.", "");

  // ── Hard exclusions (listing / search / category pages) ──────────────────
  // Search query params — almost always a results page
  if (/[?&](k|q|query|search|keyword|s)=/.test(search)) return false;
  // Common listing path segments
  if (/\/(search|results|browse|category|categories|collection|collections|department|shop\/all|sitesearch|find)/.test(path)) return false;
  // Amazon-specific: /s (search), /b (browse/category)
  if (host.includes("amazon") && /^\/(s|b)(\/|$|\?)/.test(location.pathname)) return false;
  // eBay search
  if (host.includes("ebay") && path.startsWith("/sch/")) return false;
  // Walmart search
  if (host.includes("walmart") && path.startsWith("/search")) return false;
  // Best Buy search
  if (host.includes("bestbuy") && path.includes("/searchpage.jsp")) return false;
  // Multiple product cards on page (grid of products = listing page)
  const productCards = document.querySelectorAll(
    '[data-component-type="s-search-result"], [data-testid="product-tile"], .product-item, [class*="ProductGrid"], [class*="product-grid"]'
  );
  if (productCards.length > 2) return false;

  // ── Positive signals ──────────────────────────────────────────────────────
  // og:type = product (very reliable — set per-item by every major retailer)
  if ((getMetaContent("og:type") || "").toLowerCase().includes("product")) return true;

  // schema.org @type: Product
  if (getSchemaOrg()) return true;

  // Product-specific URL identifier segment
  if (/\/(dp|ip|itm|product|item|pd|sku|goods|detail|listing)\/[a-zA-Z0-9]/.test(path)) return true;

  // Single h1 + price + add-to-cart = very strong product page signal
  const h1Count = document.querySelectorAll("h1").length;
  const hasPrice = !!(
    document.querySelector('[itemprop="price"]') ||
    document.querySelector('[data-testid*="price" i]') ||
    document.querySelector('[class*="current-price" i]') ||
    document.querySelector('[class*="ProductPrice" i]')
  );
  const atcText = ["add to cart", "add to bag", "buy now", "add to basket"];
  const hasAtc = [...document.querySelectorAll("button, [role=button]")]
    .some(btn => atcText.some(t => (btn.textContent || "").toLowerCase().includes(t)));
  if (h1Count === 1 && hasPrice && hasAtc) return true;

  return false;
}

function extractName() {
  const host = location.hostname.replace("www.", "");

  // Retailer-specific (most accurate)
  if (host.includes("amazon")) {
    const el = document.getElementById("productTitle");
    if (el) return el.textContent.trim();
  }
  if (host.includes("walmart")) {
    const el = document.querySelector('[itemprop="name"], h1[class*="ProductTitle" i]');
    if (el) return el.textContent.trim();
  }
  if (host.includes("bestbuy")) {
    const el = document.querySelector("h1.sku-title");
    if (el) return el.textContent.trim();
  }
  if (host.includes("target")) {
    const el = document.querySelector('[data-test="product-title"]');
    if (el) return el.textContent.trim();
  }
  if (host.includes("ebay")) {
    const el = document.querySelector("h1.x-item-title__mainTitle, #itemTitle");
    if (el) return el.textContent.replace("Details about", "").trim();
  }
  if (host.includes("newegg")) {
    const el = document.querySelector(".product-title");
    if (el) return el.textContent.trim();
  }

  // Universal fallbacks

  // schema.org Product name
  const schema = getSchemaOrg();
  if (schema?.name) return schema.name;

  // og:title (most reliable universal fallback)
  const og = getMetaContent("og:title");
  if (og && og.length > 5) return og;

  // h1 text
  const h1 = document.querySelector("h1");
  if (h1?.textContent?.trim().length > 5) return h1.textContent.trim();

  // Page title, strip store name suffix
  return document.title.split(/\s*[\|â€"\-]\s*/)[0].trim();
}

function extractPrice() {
  const host = location.hostname.replace("www.", "");

  if (host.includes("amazon")) {
    return document.querySelector(".a-price .a-offscreen")?.textContent?.trim()
        || document.querySelector("#priceblock_ourprice, #priceblock_dealprice")?.textContent?.trim();
  }
  if (host.includes("walmart")) {
    return document.querySelector('[itemprop="price"]')?.getAttribute("content");
  }
  if (host.includes("bestbuy")) {
    return document.querySelector(".priceView-hero-price span")?.textContent?.trim();
  }
  if (host.includes("target")) {
    return document.querySelector("[data-test='product-price']")?.textContent?.trim();
  }
  if (host.includes("ebay")) {
    return document.querySelector(".x-price-primary .ux-textspans")?.textContent?.trim();
  }

  // Universal: schema.org
  const schema = getSchemaOrg();
  if (schema?.offers?.price) return `$${schema.offers.price}`;

  // og price
  const ogPrice = getMetaContent("product:price:amount");
  if (ogPrice) return `$${ogPrice}`;

  // Common CSS patterns
  const priceSelectors = [
    '[itemprop="price"]',
    '[data-testid*="price" i]',
    '[class*="current-price" i]',
    '[class*="sale-price" i]',
    '[class*="offer-price" i]',
    '[class*="product-price" i]',
    '[class*="ProductPrice" i]',
    '[class*="PriceBlock" i]',
    '[id*="price" i]',
    '[data-price]',
  ];
  for (const sel of priceSelectors) {
    const el = document.querySelector(sel);
    const txt = el?.getAttribute("content") || el?.getAttribute("data-price") || el?.textContent?.trim();
    if (txt && /\$|£|€|\d/.test(txt)) return txt.slice(0, 20);
  }
  return null;
}

function extractImage() {
  const host = location.hostname.replace("www.", "");
  if (host.includes("amazon")) return document.getElementById("landingImage")?.getAttribute("src");
  if (host.includes("walmart")) return document.querySelector('[data-testid="hero-image"] img')?.getAttribute("src");
  if (host.includes("bestbuy")) return document.querySelector(".primary-image")?.getAttribute("src");
  if (host.includes("target")) return document.querySelector("[data-test='product-image']")?.getAttribute("src");
  if (host.includes("ebay")) return document.querySelector("#icImg")?.getAttribute("src");

  // Universal: og:image or schema
  return getMetaContent("og:image")
      || getSchemaOrg()?.image?.url
      || getSchemaOrg()?.image
      || null;
}

function cleanName(name) {
  if (!name) return null;
  return name
    .replace(/\s*[\|â€"\-]\s*(Amazon|Walmart|Best Buy|Target|eBay|Newegg|Etsy|Costco|Shop|Store|Buy|Online).*$/i, "")
    .replace(/\s*:\s*Amazon\.com.*$/i, "")
    .trim()
    .slice(0, 200);
}

function buildProductInfo() {
  const name = cleanName(extractName());
  if (!name || name.length < 4) return null;
  return {
    name,
    price: extractPrice(),
    image: extractImage(),
    url: location.href,
    host: location.hostname.replace("www.", ""),
  };
}

// ─── Shadow DOM Panel ──────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  #sq-wrap {
    position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px; line-height: 1.4;
  }
  #sq-pill {
    display: flex; align-items: center;
    background: #7c3aed; border-radius: 999px; cursor: grab;
    box-shadow: 0 4px 20px rgba(124,58,237,0.45);
    transition: transform 0.1s; overflow: hidden;
  }
  #sq-pill.sq-dragging { cursor: grabbing; }
  #sq-pill-main {
    display: flex; align-items: center; gap: 7px;
    background: none; border: none; color: #fff;
    padding: 9px 13px 9px 10px; cursor: pointer;
    font-size: 13px; font-weight: 600; white-space: nowrap; font-family: inherit;
    transition: background 0.12s;
  }
  #sq-pill-main:hover { background: rgba(255,255,255,0.1); }
  #sq-pill-gear {
    background: none; border: none; border-left: 1px solid rgba(255,255,255,0.18);
    color: rgba(255,255,255,0.75); padding: 9px 10px; cursor: pointer;
    font-size: 13px; line-height: 1; transition: background 0.12s, color 0.12s;
  }
  #sq-pill-gear:hover { background: rgba(255,255,255,0.15); color: #fff; }
  #sq-panel {
    display: none; width: 340px; background: #0f0f0f;
    border: 1px solid #2a2a2a; border-radius: 12px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.6); overflow: hidden;
  }
  .sq-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 13px; background: #0a0a0a; border-bottom: 1px solid #1e1e1e;
  }
  .sq-logo { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; color: #f0f0f0; text-decoration: none; cursor: pointer; }
  .sq-logo:hover { opacity: 0.8; }
  .sq-logo-icon { width: 22px; height: 22px; background: #7c3aed; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
  .sq-version { font-size: 9px; color: #444; letter-spacing: 0.03em; margin-right: auto; padding-left: 4px; }
  .sq-header { cursor: grab; user-select: none; }
  .sq-header.sq-dragging { cursor: grabbing; }
  .sq-close { background: none; border: none; color: #666; font-size: 18px; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
  .sq-close:hover { color: #f0f0f0; background: #1e1e1e; }
  .sq-back { background: none; border: none; color: #7c3aed; font-size: 11px; font-weight: 600; cursor: pointer; padding: 2px 6px; border-radius: 4px; margin-right: 4px; font-family: inherit; }
  .sq-back:hover { background: #1a1220; }
  .sq-body { padding: 11px 13px; max-height: 480px; overflow-y: auto; }
  .sq-product { display: flex; gap: 9px; align-items: flex-start; margin-bottom: 10px; }
  .sq-product img { width: 44px; height: 44px; border-radius: 6px; border: 1px solid #222; object-fit: contain; background: #1a1a1a; flex-shrink: 0; }
  .sq-product-name { font-size: 12px; font-weight: 600; color: #e0e0e0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .sq-product-price { font-size: 11px; color: #777; margin-top: 2px; }
  .sq-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #555; margin-bottom: 6px; }
  .sq-spinner { width: 20px; height: 20px; border: 2px solid #2a2a2a; border-top-color: #7c3aed; border-radius: 50%; animation: sq-spin 0.7s linear infinite; margin: 12px auto; }
  @keyframes sq-spin { to { transform: rotate(360deg); } }
  .sq-results { display: flex; flex-direction: column; gap: 3px; }
  .sq-result { display: flex; align-items: center; gap: 7px; padding: 7px 9px; border-radius: 7px; border: 1px solid #1e1e1e; background: #141414; text-decoration: none; color: inherit; transition: border-color 0.12s, background 0.12s; cursor: pointer; }
  .sq-result:hover { border-color: #7c3aed44; background: #1a1220; }
  .sq-result.sq-best { border-color: #059669; background: #052e1a; }
  .sq-badge { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 4px; flex-shrink: 0; }
  .sq-badge-amazon { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .sq-badge-walmart { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .sq-badge-bestbuy { background: rgba(234,179,8,0.15); color: #fde68a; }
  .sq-badge-target  { background: rgba(239,68,68,0.15); color: #fca5a5; }
  .sq-badge-ebay    { background: rgba(16,185,129,0.15); color: #6ee7b7; }
  .sq-badge-newegg  { background: rgba(124,58,237,0.15); color: #c4b5fd; }
  .sq-badge-other   { background: #1c1c1c; color: #888; }
  .sq-result-name { flex: 1; font-size: 11px; color: #bbb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sq-result-price { font-size: 13px; font-weight: 700; color: #f0f0f0; flex-shrink: 0; }
  .sq-best .sq-result-price { color: #34d399; }
  .sq-best-label { font-size: 8px; font-weight: 700; color: #34d399; border: 1px solid rgba(5,40,22,0.4); padding: 1px 4px; border-radius: 3px; flex-shrink: 0; }
  .sq-track-section { margin-top: 9px; padding-top: 9px; border-top: 1px solid #1e1e1e; }
  .sq-btn-track { width: 100%; padding: 8px; border-radius: 7px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: #7c3aed; color: #fff; transition: background 0.15s; }
  .sq-btn-track:hover { background: #6d28d9; }
  .sq-btn-track:disabled { cursor: default; }
  .sq-btn-track.sq-tracked { background: #052e1a; color: #34d399; border: 1px solid #059669; }
  .sq-hint { margin-top: 5px; text-align: center; font-size: 10px; color: #555; }
  .sq-hint a { color: #7c3aed; text-decoration: none; }
  .sq-auth { margin-top: 9px; padding-top: 9px; border-top: 1px solid #1e1e1e; }
  .sq-auth-title { font-size: 12px; font-weight: 600; color: #ddd; margin-bottom: 8px; }
  .sq-field { margin-bottom: 6px; }
  .sq-field label { display: block; font-size: 10px; color: #777; margin-bottom: 3px; }
  .sq-field input { width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 5px; padding: 6px 9px; color: #f0f0f0; font-size: 12px; outline: none; }
  .sq-field input:focus { border-color: #7c3aed; }
  .sq-auth-error { font-size: 10px; color: #f87171; margin-bottom: 6px; min-height: 14px; }
  .sq-btn-login { width: 100%; padding: 7px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: #7c3aed; color: #fff; }
  .sq-auth-footer { margin-top: 6px; text-align: center; font-size: 10px; color: #555; }
  .sq-auth-footer a { color: #7c3aed; text-decoration: none; }
  .sq-error { text-align: center; font-size: 11px; color: #888; padding: 12px 0; }
  .sq-settings { padding: 11px 13px; }
  .sq-settings-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1e1e1e; }
  .sq-settings-row:last-child { border-bottom: none; }
  .sq-settings-label { font-size: 12px; color: #e0e0e0; font-weight: 500; }
  .sq-settings-desc { font-size: 10px; color: #555; margin-top: 2px; }
  .sq-toggle { position: relative; width: 34px; height: 19px; flex-shrink: 0; }
  .sq-toggle input { opacity: 0; width: 0; height: 0; }
  .sq-toggle-slider { position: absolute; inset: 0; background: #2a2a2a; border-radius: 19px; cursor: pointer; transition: background 0.2s; }
  .sq-toggle-slider:before { content: ""; position: absolute; width: 13px; height: 13px; left: 3px; top: 3px; background: #666; border-radius: 50%; transition: transform 0.2s, background 0.2s; }
  .sq-toggle input:checked + .sq-toggle-slider { background: #7c3aed; }
  .sq-toggle input:checked + .sq-toggle-slider:before { transform: translateX(15px); background: #fff; }
`;

const HTML = `
  <div id="sq-wrap">
    <div id="sq-pill">
      <button id="sq-pill-main"><span>⚡</span><span>Compare prices</span></button>
      <button id="sq-pill-gear" title="Settings">⚙</button>
    </div>
    <div id="sq-panel">
      <div class="sq-header" id="sq-header">
        <button class="sq-back" id="sq-back" style="display:none">← Back</button>
        <a class="sq-logo" id="sq-logo-link" href="${SCOUTIQ_URL}/dashboard" target="_blank" rel="noopener"><div class="sq-logo-icon">⚡</div>ScoutIQ</a>
        <span class="sq-version">v1.4 · June 27</span>
        <button class="sq-close" id="sq-close">✕</button>
      </div>
      <div class="sq-body" id="sq-main-body">
        <div class="sq-product" id="sq-product" style="display:none">
          <img id="sq-img" style="display:none" />
          <div>
            <div class="sq-product-name" id="sq-product-name"></div>
            <div class="sq-product-price" id="sq-product-price"></div>
          </div>
        </div>
        <div class="sq-section-label" id="sq-section-lbl">PRICES ACROSS THE WEB</div>
        <div class="sq-spinner" id="sq-spinner"></div>
        <div class="sq-results" id="sq-results" style="display:none"></div>
        <div class="sq-error" id="sq-error" style="display:none"></div>
        <div class="sq-track-section" id="sq-track-section" style="display:none">
          <button class="sq-btn-track" id="sq-btn-track">♡ Track this product</button>
          <div class="sq-hint" id="sq-hint"></div>
        </div>
        <div class="sq-auth" id="sq-auth" style="display:none">
          <div class="sq-auth-title">Sign in to track prices</div>
          <div class="sq-field"><label>Email</label><input type="email" id="sq-email" placeholder="you@email.com" /></div>
          <div class="sq-field"><label>Password</label><input type="password" id="sq-password" placeholder="••••••••" /></div>
          <div class="sq-auth-error" id="sq-auth-error"></div>
          <button class="sq-btn-login" id="sq-btn-login">Sign in</button>
          <div class="sq-auth-footer">No account? <a href="${SCOUTIQ_URL}/signup" target="_blank">Sign up free ↗</a></div>
        </div>
      </div>
      <div class="sq-settings" id="sq-settings-body" style="display:none">
        <div class="sq-settings-row">
          <div>
            <div class="sq-settings-label">Auto-open on product pages</div>
            <div class="sq-settings-desc">Detect and open automatically when visiting a product</div>
          </div>
          <label class="sq-toggle">
            <input type="checkbox" id="sq-auto-open" />
            <span class="sq-toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  </div>
`;

// ─── State ────────────────────────────────────────────────────────────────────
let shadow = null;
let productInfo = null;
let compareResults = [];
let session = null;
let injected = false;

function $(id) { return shadow ? shadow.querySelector("#" + id) : null; }

// ─── Session ──────────────────────────────────────────────────────────────────
async function loadSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["sb_session"], async (r) => {
      const s = r.sb_session;
      if (!s) return resolve(null);
      // Token still valid (with 60s buffer)
      if (!s.expires_at || Date.now() / 1000 < s.expires_at - 60) return resolve(s);
      // Try refreshing with refresh_token
      if (s.refresh_token) {
        try {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: s.refresh_token }),
          });
          const json = await res.json();
          if (res.ok && json.access_token) {
            const fresh = { access_token: json.access_token, refresh_token: json.refresh_token || s.refresh_token, user: json.user || s.user, expires_at: json.expires_at };
            chrome.storage.local.set({ sb_session: fresh });
            return resolve(fresh);
          }
        } catch {}
      }
      chrome.storage.local.remove("sb_session");
      resolve(null);
    });
  });
}
function saveSession(s) { chrome.storage.local.set({ sb_session: s }); session = s; }

// ─── Pill enabled state ───────────────────────────────────────────────────────
function isPillEnabled() {
  return new Promise(r => chrome.storage.local.get(["sq_pill_on"], d => r(!!d.sq_pill_on)));
}
function setPillEnabled(val) {
  return new Promise(r => chrome.storage.local.set({ sq_pill_on: val }, r));
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function openSettings() {
  $("sq-panel").style.display = "block";
  $("sq-pill").style.display = "none";
  $("sq-main-body").style.display = "none";
  $("sq-settings-body").style.display = "";
  $("sq-back").style.display = "";
  $("sq-logo-link").style.display = "none";
}
function closeSettings() {
  $("sq-settings-body").style.display = "none";
  $("sq-main-body").style.display = "";
  $("sq-back").style.display = "none";
  $("sq-logo-link").style.display = "";
}
function openPanel() {
  $("sq-panel").style.display = "block";
  $("sq-pill").style.display = "none";
  closeSettings();
  if (!productInfo) {
    // Non-product page — show placeholder message
    $("sq-product").style.display = "none";
    $("sq-section-lbl").style.display = "none";
    $("sq-spinner").style.display = "none";
    $("sq-results").style.display = "none";
    $("sq-track-section").style.display = "none";
    $("sq-error").textContent = "Navigate to a product page to compare prices.";
    $("sq-error").style.display = "";
    return;
  }
  if (compareResults.length === 0) fetchPrices();
}
function closePanel() {
  $("sq-panel").style.display = "none";
  $("sq-pill").style.display = "flex";
  closeSettings();
}

function renderProduct(info) {
  $("sq-product").style.display = "flex";
  $("sq-section-lbl").style.display = "";
  $("sq-product-name").textContent = info.name;
  if (info.price) $("sq-product-price").textContent = `Listed at ${info.price}`;
  if (info.image) {
    const img = $("sq-img");
    img.src = info.image;
    img.style.display = "";
    img.onerror = () => { img.style.display = "none"; };
  }
  // Show Track button immediately — don't wait for compare results
  $("sq-track-section").style.display = "";
  updateTrackBtn();
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

  // Show "waking up" hint after 4s — Render free tier cold starts take up to 45s
  const wakeHint = setTimeout(() => {
    const err = $("sq-error");
    if (err) { err.textContent = "Waking up price server… this takes ~30s on first use."; err.style.display = ""; }
  }, 4000);

  const controller = new AbortController();
  const hardTimeout = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetch(
      `${SCRAPER_URL}/ext/compare?q=${encodeURIComponent(productInfo.name)}`,
      { headers: { "x-ext-key": EXT_KEY }, signal: controller.signal },
    );
    clearTimeout(wakeHint);
    clearTimeout(hardTimeout);
    const json = await res.json();
    $("sq-spinner").style.display = "none";
    $("sq-error").style.display = "none";

    if (!json.success || !Array.isArray(json.results) || !json.results.length) {
      $("sq-error").textContent = "No prices found for this product.";
      $("sq-error").style.display = "";
      return;
    }

    compareResults = json.results.filter((r) => r.price > 0 && r.url).sort((a, b) => a.price - b.price);
    renderResults();
  } catch (e) {
    clearTimeout(wakeHint);
    clearTimeout(hardTimeout);
    $("sq-spinner").style.display = "none";
    const msg = e.name === "AbortError"
      ? "Price server timed out. Try again in a moment."
      : "Couldn't reach the price server. Check your connection.";
    $("sq-error").textContent = msg;
    $("sq-error").style.display = "";
  }
}

function renderResults() {
  const list = $("sq-results");
  list.innerHTML = "";
  compareResults.slice(0, 5).forEach((r, i) => {
    const isBest = i === 0;
    const a = document.createElement("a");
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = `sq-result${isBest ? " sq-best" : ""}`;
    a.innerHTML = `
      <span class="sq-badge sq-badge-${BADGES[r.retailer] || "other"}">${r.retailer}</span>
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
  if (!btn) return;
  if (!session) {
    btn.textContent = "♡ Track this product";
    btn.disabled = false;
    btn.className = "sq-btn-track";
    $("sq-hint").innerHTML = `<a href="${SCOUTIQ_URL}/signup" target="_blank">Sign in or create a free account</a>`;
  }
}

async function handleTrack() {
  if (!productInfo) return;
  if (!session) { $("sq-auth").style.display = ""; $("sq-email").focus(); return; }
  const btn = $("sq-btn-track");
  btn.disabled = true; btn.textContent = "Adding…";
  // Use best compare result if available, otherwise fall back to current page data
  const best = compareResults[0];
  const retailer = best?.retailer || productInfo.host || "Unknown";
  const price = best?.price ?? parseFloat((productInfo.price || "").replace(/[^0-9.]/g, "")) || null;
  const trackUrl = best?.url || productInfo.url;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tracked_products`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: session.user.id, product_name: productInfo.name, url: trackUrl, retailer, current_price: price, currency: "USD", drop_threshold_pct: 5, scrape_status: "pending" }),
    });
    if (res.status === 401) { session = null; chrome.storage.local.remove("sb_session"); $("sq-auth").style.display = ""; btn.disabled = false; btn.textContent = "♡ Track this product"; return; }
    btn.className = "sq-btn-track sq-tracked"; btn.textContent = "✓ Tracked"; btn.disabled = true;
    $("sq-hint").innerHTML = `<a href="${SCOUTIQ_URL}/dashboard" target="_blank">View in watchlist ↗</a>`;
    $("sq-auth").style.display = "none";
  } catch {
    btn.disabled = false; btn.textContent = "♡ Track this product";
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
    if (!res.ok || json.error) { errEl.textContent = json.error_description || "Sign in failed."; return; }
    saveSession({ access_token: json.access_token, refresh_token: json.refresh_token, user: json.user, expires_at: json.expires_at });
    $("sq-auth").style.display = "none";
    handleTrack();
  } catch { errEl.textContent = "Network error."; }
}

// ─── Drag & position persistence ─────────────────────────────────────────────
async function loadStoredPos() {
  return new Promise(r => chrome.storage.local.get(["sq_pos"], d => r(d.sq_pos || null)));
}

function saveStoredPos(left, top) {
  chrome.storage.local.set({ sq_pos: { left, top } });
}

function applyPos(wrap, pos) {
  if (!pos) return;
  const maxL = window.innerWidth - wrap.offsetWidth - 4;
  const maxT = window.innerHeight - wrap.offsetHeight - 4;
  wrap.style.left = Math.max(4, Math.min(maxL, pos.left)) + "px";
  wrap.style.top = Math.max(4, Math.min(maxT, pos.top)) + "px";
  wrap.style.right = "auto";
  wrap.style.bottom = "auto";
}

function makeDraggable(handle, wrap, onDrop) {
  handle.addEventListener("mousedown", (e) => {
    if (e.target.id === "sq-close" || e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    const rect = wrap.getBoundingClientRect();
    const offX = e.clientX - rect.left, offY = e.clientY - rect.top;
    let moved = false;
    let hlImg = null; // currently highlighted drop-target image

    const onMove = (ev) => {
      if (!moved && Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
      if (!moved) {
        moved = true;
        handle.classList.add("sq-dragging");
        document.body.style.userSelect = "none";
      }
      const left = Math.max(4, Math.min(window.innerWidth - wrap.offsetWidth - 4, ev.clientX - offX));
      const top = Math.max(4, Math.min(window.innerHeight - wrap.offsetHeight - 4, ev.clientY - offY));
      wrap.style.left = left + "px";
      wrap.style.top = top + "px";
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";

      // Highlight product image under cursor as a drop hint
      if (onDrop) {
        const under = document.elementsFromPoint(ev.clientX, ev.clientY);
        const imgEl = under.find(el => el.tagName === "IMG" && !el.closest("#__scoutiq__") && el.naturalWidth > 60);
        if (imgEl !== hlImg) {
          if (hlImg) { hlImg.style.outline = ""; hlImg.style.borderRadius = ""; }
          hlImg = imgEl || null;
          if (hlImg) { hlImg.style.outline = "3px solid #7c3aed"; hlImg.style.borderRadius = "6px"; }
        }
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      handle.classList.remove("sq-dragging");
      document.body.style.userSelect = "";
      if (hlImg) { hlImg.style.outline = ""; hlImg.style.borderRadius = ""; }
      if (moved) {
        const r = wrap.getBoundingClientRect();
        saveStoredPos(r.left, r.top);
        handle.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true });
        if (onDrop && hlImg) onDrop(hlImg);
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function handleImageDrop(imgEl) {
  if (!imgEl) return;
  const container = imgEl.closest(
    "[data-asin], [data-item-id], [class*='product' i], article, li[class*='item' i]"
  ) || imgEl.parentElement?.parentElement || imgEl.parentElement;
  const nameEl = container?.querySelector(
    "h2, h3, h4, [class*='title' i]:not(meta), [class*='ProductName' i], [class*='product-name' i], a[title]"
  );
  const priceEl = container?.querySelector("[class*='price' i]:not(del), [itemprop='price']");
  const linkEl = imgEl.closest("a") || container?.querySelector("a");

  const rawName = nameEl?.textContent?.trim() || imgEl.alt?.trim() || "";
  const name = cleanName(rawName);
  if (!name || name.length < 4) return;

  const product = {
    name,
    price: priceEl?.textContent?.trim() || null,
    image: imgEl.src,
    url: linkEl?.href || location.href,
    host: location.hostname.replace("www.", ""),
  };
  productInfo = product;
  compareResults = [];
  saveStoredProduct(product); // persist so it survives tab switches and navigation
  renderProduct(product);
  $("sq-panel").style.display = "block";
  $("sq-pill").style.display = "none";
  $("sq-spinner").style.display = "";
  $("sq-results").style.display = "none";
  $("sq-error").style.display = "none";
  fetchPrices();
}

// ─── Inject panel ─────────────────────────────────────────────────────────────
function inject(info) {
  // Remove existing panel before re-injecting
  const existing = document.getElementById("__scoutiq__");
  if (existing) existing.remove();

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

  $("sq-pill-main").addEventListener("click", openPanel);
  $("sq-pill-gear").addEventListener("click", openSettings);
  $("sq-close").addEventListener("click", closePanel);
  $("sq-back").addEventListener("click", closeSettings);
  $("sq-btn-track").addEventListener("click", handleTrack);
  $("sq-btn-login").addEventListener("click", handleSignIn);
  $("sq-password").addEventListener("keydown", (e) => { if (e.key === "Enter") handleSignIn(); });
  $("sq-logo-link").addEventListener("mousedown", (e) => e.stopPropagation());

  // Header click (not on buttons) minimizes
  $("sq-header").addEventListener("click", (e) => {
    const t = e.target;
    if (t.id === "sq-close" || t.id === "sq-back" || (t.closest && t.closest("#sq-logo-link"))) return;
    closePanel();
  });

  // Auto-open toggle
  chrome.storage.local.get(["sq_auto_open"], (d) => {
    $("sq-auto-open").checked = !!d.sq_auto_open;
  });
  $("sq-auto-open").addEventListener("change", (e) => {
    chrome.storage.local.set({ sq_auto_open: e.target.checked });
  });

  const sqWrap = $("sq-wrap");
  makeDraggable($("sq-pill"), sqWrap, handleImageDrop);
  makeDraggable($("sq-header"), sqWrap, handleImageDrop);

  // Always start at bottom-right on toggle-on — no saved position restored
  if (info) renderProduct(info);
  injected = true;
}

// ─── Stored product ───────────────────────────────────────────────────────────
function loadStoredProduct() {
  return new Promise(r => chrome.storage.local.get(["sq_last_product"], d => r(d.sq_last_product || null)));
}
function saveStoredProduct(product) {
  if (product) chrome.storage.local.set({ sq_last_product: product });
  else chrome.storage.local.remove("sq_last_product");
}

// ─── Boot & SPA navigation ────────────────────────────────────────────────────
async function boot() {
  if (injected) return; // __sq_toggle already ran, skip
  const { sq_pill_on, sq_auto_open } = await chrome.storage.local.get(["sq_pill_on", "sq_auto_open"]);
  console.log("[ScoutIQ] boot() — sq_pill_on:", sq_pill_on);
  if (!sq_pill_on) return;

  let stored = await loadStoredProduct();

  // Auto-open: detect product from page and open panel immediately
  if (sq_auto_open && isProductPage()) {
    const detected = buildProductInfo();
    if (detected) {
      stored = detected;
      saveStoredProduct(detected);
    }
  }

  productInfo = stored;
  compareResults = [];
  session = await loadSession();
  inject(stored);

  if (sq_auto_open && isProductPage() && stored) {
    setTimeout(openPanel, 100);
  }
}

function _applyPillOn(stored) {
  console.log("[ScoutIQ] _applyPillOn() — product:", stored?.name || "none");
  productInfo = stored;
  compareResults = [];
  try {
    inject(stored);
    console.log("[ScoutIQ] inject() completed OK");
  } catch(e) {
    console.error("[ScoutIQ] inject() threw:", e);
  }
}

function _applyPillOff() {
  saveStoredProduct(null);
  chrome.storage.local.remove("sq_pos");
  productInfo = null;
  compareResults = [];
  const host = document.getElementById("__scoutiq__");
  if (host) host.remove();
  shadow = null;
  injected = false;
}

// Toggle is driven by window.__sq_toggle called directly from background.js.
// No storage listener needed — it caused double-inject races.

// Watch for SPA navigation — disconnect any previous observer first (re-injection safe)
if (window.__sq_nav_observer) { window.__sq_nav_observer.disconnect(); }
let lastUrl = location.href;
const navObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(async () => {
      const { sq_pill_on } = await chrome.storage.local.get("sq_pill_on");
      if (!sq_pill_on) return;
      if (document.getElementById("__scoutiq__")) return; // still alive, leave it
      injected = false;
      const stored = await loadStoredProduct();
      productInfo = stored;
      compareResults = [];
      inject(stored);
    }, 800);
  }
});
window.__sq_nav_observer = navObserver;
navObserver.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
});

// Exposed globally so background.js can call it directly via executeScript func:
window.__sq_toggle = async (on) => {
  if (on) {
    session = await loadSession();
    const stored = await loadStoredProduct();
    _applyPillOn(stored);
  } else {
    _applyPillOff();
  }
};

// Initial load — skip if __sq_toggle already fired first (prevents double-inject)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 800));
} else {
  setTimeout(boot, 800);
}

} catch(e) {
  console.error("[ScoutIQ] INIT FAILED:", e);
  // Show a visible error pill so we can read the message
  window.__sq_toggle = (on) => {
    const old = document.getElementById("__scoutiq__");
    if (old) old.remove();
    if (!on) return;
    const d = document.createElement("div");
    d.id = "__scoutiq__";
    d.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#c00;color:#fff;padding:10px 14px;border-radius:12px;font:13px/1.4 sans-serif;max-width:320px;word-break:break-word;";
    d.textContent = "⚡ ScoutIQ init error: " + e.message;
    document.body.appendChild(d);
  };
}
})();
