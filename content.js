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

  /* ── Micro interaction: spring entrance ── */
  @keyframes sq-pop-in {
    0%   { transform: scale(0.4); opacity: 0; }
    65%  { transform: scale(1.12); opacity: 1; }
    82%  { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
  /* ── Micro interaction: attention glow pulse (plays once after entrance) ── */
  @keyframes sq-glow-pulse {
    0%, 100% { box-shadow: 0 4px 20px rgba(124,58,237,0.45); }
    50%       { box-shadow: 0 4px 32px rgba(124,58,237,0.9), 0 0 0 6px rgba(124,58,237,0.15); }
  }
  /* ── Micro interaction: subtle breathe (continuous, low-key) ── */
  @keyframes sq-breathe {
    0%, 100% { box-shadow: 0 4px 20px rgba(124,58,237,0.45); }
    50%       { box-shadow: 0 4px 26px rgba(124,58,237,0.65); }
  }
  #sq-pill.sq-anim-pop     { animation: sq-pop-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
  #sq-pill.sq-anim-glow    { animation: sq-glow-pulse 0.7s ease-in-out 2; }
  #sq-pill.sq-anim-breathe { animation: sq-breathe 2.8s ease-in-out infinite; }

  #sq-pill-main {
    display: flex; align-items: center; gap: 7px;
    background: none; border: none; color: #fff;
    padding: 9px 13px 9px 10px; cursor: pointer;
    font-size: 13px; font-weight: 600; white-space: nowrap; font-family: inherit;
    transition: background 0.12s;
  }
  #sq-pill-main:hover { background: rgba(255,255,255,0.1); }
  #sq-panel {
    display: none; width: 340px; background: #0f0f0f;
    border: 1px solid #2a2a2a; border-radius: 12px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.6); overflow: hidden; position: relative;
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
  .sq-gear-btn { background: none; border: none; color: #555; font-size: 14px; cursor: pointer; padding: 2px 5px; border-radius: 4px; line-height: 1; margin-right: 2px; transition: color 0.12s, background 0.12s; }
  .sq-gear-btn:hover { color: #f0f0f0; background: #1e1e1e; }
  .sq-gear-btn.sq-active { color: #7c3aed; }
  .sq-body { padding: 11px 13px; }
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
  .sq-settings { background: #0f0f0f; border-bottom: 1px solid #1e1e1e; padding: 11px 13px; }
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
    </div>
    <div id="sq-panel">
      <div class="sq-header" id="sq-header" draggable="false">
        <a class="sq-logo" id="sq-logo-link" href="${SCOUTIQ_URL}/dashboard" target="_blank" rel="noopener"><div class="sq-logo-icon">⚡</div>ScoutIQ</a>
        <span class="sq-version">v1.4</span>
        <button class="sq-gear-btn" id="sq-gear-btn" title="Settings">⚙</button>
        <button class="sq-close" id="sq-close">✕</button>
      </div>
      <div class="sq-settings" id="sq-settings-body" style="display:none">
        <div class="sq-settings-row">
          <div>
            <div class="sq-settings-label">Auto-show on product pages</div>
            <div class="sq-settings-desc">Pill appears automatically on product pages (not search results)</div>
          </div>
          <label class="sq-toggle">
            <input type="checkbox" id="sq-auto-open" />
            <span class="sq-toggle-slider"></span>
          </label>
        </div>
        <div class="sq-settings-row">
          <div>
            <div class="sq-settings-label">Pill entrance</div>
            <div class="sq-settings-desc">Animation when the pill first appears</div>
          </div>
          <select id="sq-anim-select" style="background:#1a1a1a;color:#e0e0e0;border:1px solid #333;border-radius:6px;padding:3px 6px;font-size:11px;cursor:pointer;outline:none;">
            <option value="pop">Spring pop</option>
            <option value="breathe">Breathe</option>
            <option value="none">None</option>
          </select>
        </div>
        <div class="sq-settings-row">
          <div>
            <div class="sq-settings-label">Reading product</div>
            <div class="sq-settings-desc">Effect on the image while extracting details</div>
          </div>
          <select id="sq-read-anim-select" style="background:#1a1a1a;color:#e0e0e0;border:1px solid #333;border-radius:6px;padding:3px 6px;font-size:11px;cursor:pointer;outline:none;">
            <option value="chomp">Chomp 👾</option>
            <option value="absorb">Absorb ✨</option>
            <option value="focus">Focus brackets</option>
            <option value="scanline">Scan line</option>
            <option value="glow">Glow border</option>
            <option value="none">None</option>
          </select>
        </div>
        <div class="sq-settings-row">
          <div>
            <div class="sq-settings-label">Movement trail</div>
            <div class="sq-settings-desc">Effect left behind while dragging the pill</div>
          </div>
          <select id="sq-trail-select" style="background:#1a1a1a;color:#e0e0e0;border:1px solid #333;border-radius:6px;padding:3px 6px;font-size:11px;cursor:pointer;outline:none;">
            <option value="dots">Pac-Man dots</option>
            <option value="sparkle">Sparkles</option>
            <option value="comet">Comet tail</option>
            <option value="burst">Burst</option>
            <option value="none">None</option>
          </select>
        </div>
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
  $("sq-settings-body").style.display = "block";
  $("sq-gear-btn").classList.add("sq-active");
}
function closeSettings() {
  $("sq-settings-body").style.display = "none";
  $("sq-gear-btn").classList.remove("sq-active");
}
function toggleSettings() {
  const isOpen = $("sq-settings-body").style.display !== "none";
  if (isOpen) closeSettings(); else openSettings();
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
  stopReadingAnim();
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
  const price = (best?.price ?? parseFloat((productInfo.price || "").replace(/[^0-9.]/g, ""))) || null;
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
      emitTrail(ev.clientX, ev.clientY);
      wrap.style.bottom = "auto";

      // Highlight product image under cursor as a drop hint
      if (onDrop) {
        const under = document.elementsFromPoint(ev.clientX, ev.clientY);
        const imgEl = under.find(el => el.tagName === "IMG" && !el.closest("#__scoutiq__") && (el.naturalWidth > 30 || el.width > 30));
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
  saveStoredProduct(product);
  playImageReadAnim(imgEl, () => {
    renderProduct(product);
    $("sq-panel").style.display = "block";
    $("sq-pill").style.display = "none";
    $("sq-spinner").style.display = "";
    $("sq-results").style.display = "none";
    $("sq-error").style.display = "none";
    fetchPrices();
  });
}

// ─── Image reading animation (injected into page DOM over the image) ──────────
let _readImgStyle = "chomp";
let _trailStyle = "dots";

// ─── Elaborate chomp: pill splits, grows, flies at image, snaps shut ──────────
function playChompElaborate(imgEl, onReady) {
  const imgRect = imgEl.getBoundingClientRect();
  if (imgRect.width < 20 || imgRect.height < 20) { onReady(); return; }

  const host = document.getElementById("__scoutiq__");
  const wrapEl = host?.shadowRoot?.querySelector("#sq-wrap");
  const pillRect = wrapEl?.getBoundingClientRect();

  const imgCX = imgRect.left + imgRect.width / 2;
  const imgCY = imgRect.top + imgRect.height / 2;
  const startCX = pillRect ? pillRect.left + pillRect.width / 2 : imgCX;
  const startCY = pillRect ? pillRect.top + pillRect.height / 2 : imgRect.top - 70;
  const startW  = pillRect ? pillRect.width  : 150;
  const startHH = Math.max(16, pillRect ? pillRect.height / 2 : 22);

  const bigW  = Math.min(Math.max(imgRect.width * 1.1, 220), window.innerWidth * 0.85);
  const bigHH = Math.max(bigW * 0.25, 52);
  const openSmall = startHH * 1.05;
  const openBig   = bigHH * 0.92;

  const stage = document.createElement("div");
  stage.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:2147483646;`;
  document.body.appendChild(stage);
  if (wrapEl) wrapEl.style.visibility = "hidden";

  // ── SVG jaw builder ─────────────────────────────────────────────────────
  // viewBox 0 0 100 40 normalized; stretches with div (preserveAspectRatio=none)
  // Teeth drawn with Bezier curves for organic rounded tips + white enamel
  function makeJaw(isTop, cx, cy, w, hh, nTeeth) {
    const vw = 100, vh = 40;
    const tw = vw / nTeeth;
    const gumY = isTop ? 15 : 25; // where teeth meet the gum line

    // Bezier tooth path — curves from gum to rounded tip and back
    let d;
    if (isTop) {
      d = `M 0 0 L ${vw} 0 L ${vw} ${gumY}`;
      for (let i = nTeeth - 1; i >= 0; i--) {
        const x0 = tw * (i + 1), xm = tw * (i + 0.5), x1 = tw * i;
        d += ` L ${x0 - tw*0.06} ${gumY}`;
        d += ` C ${x0-tw*0.18} ${vh*0.65} ${xm+tw*0.06} ${vh} ${xm} ${vh}`;
        d += ` C ${xm-tw*0.06} ${vh} ${x1+tw*0.18} ${vh*0.65} ${x1+tw*0.06} ${gumY}`;
      }
      d += ` L 0 ${gumY} Z`;
    } else {
      d = `M 0 ${vh} L ${vw} ${vh} L ${vw} ${gumY}`;
      for (let i = nTeeth - 1; i >= 0; i--) {
        const x0 = tw * (i + 1), xm = tw * (i + 0.5), x1 = tw * i;
        d += ` L ${x0 - tw*0.06} ${gumY}`;
        d += ` C ${x0-tw*0.18} ${vh*0.35} ${xm+tw*0.06} 0 ${xm} 0`;
        d += ` C ${xm-tw*0.06} 0 ${x1+tw*0.18} ${vh*0.35} ${x1+tw*0.06} ${gumY}`;
      }
      d += ` L 0 ${gumY} Z`;
    }

    // White enamel ellipse on each tooth tip
    let enamel = '';
    for (let i = 0; i < nTeeth; i++) {
      const xm = tw * (i + 0.5);
      const ey = isTop ? vh - 2.5 : 2.5;
      enamel += `<ellipse cx="${xm}" cy="${ey}" rx="${tw*0.21}" ry="3.2"
        fill="rgba(255,255,255,0.9)"/>`;
    }

    // Gum shading (darker ridge where teeth meet jaw)
    const gumLine = isTop
      ? `<rect x="0" y="${gumY-2}" width="${vw}" height="3" fill="rgba(90,20,160,0.55)" rx="1.5"/>`
      : `<rect x="0" y="${gumY-1}" width="${vw}" height="3" fill="rgba(90,20,160,0.55)" rx="1.5"/>`;

    const uid = `sq-j-${Math.random().toString(36).slice(2,7)}`;
    const el = document.createElement("div");
    el.style.cssText = `
      position:fixed;
      left:${cx - w/2}px; top:${isTop ? cy - hh : cy}px;
      width:${w}px; height:${hh}px;
      pointer-events:none;
    `;
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"
      width="100%" height="100%"
      viewBox="0 0 ${vw} ${vh}"
      preserveAspectRatio="none"
      style="display:block;overflow:visible;">
      <defs>
        <linearGradient id="${uid}g" x1="0" y1="${isTop?0:1}" x2="0" y2="${isTop?1:0}">
          <stop offset="0%"   stop-color="#3b0764"/>
          <stop offset="40%"  stop-color="#6d28d9"/>
          <stop offset="100%" stop-color="#a78bfa"/>
        </linearGradient>
        <filter id="${uid}s">
          <feDropShadow dx="0" dy="${isTop?3:-3}" stdDeviation="4"
            flood-color="#2e1065" flood-opacity="0.7"/>
        </filter>
        <filter id="${uid}gl" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <!-- jaw body with gradient -->
      <path d="${d}" fill="url(#${uid}g)" filter="url(#${uid}s)"/>
      <!-- edge highlight -->
      <path d="${d}" fill="none" stroke="rgba(167,139,250,0.5)" stroke-width="0.7"/>
      <!-- gum line -->
      ${gumLine}
      <!-- enamel on each tip (glow filter) -->
      <g filter="url(#${uid}gl)">${enamel}</g>
    </svg>`;
    stage.appendChild(el);
    return el;
  }

  // ── Throat: dark void visible between open jaws ──────────────────────────
  function makeThroat(cx, cy, w, openGap) {
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;
      left:${cx - w/2}px; top:${cy - openGap}px;
      width:${w}px; height:${openGap * 2}px;
      background:radial-gradient(ellipse at 50% 50%,
        rgba(15,0,40,0.97) 0%,rgba(30,5,70,0.88) 55%,transparent 100%);
      pointer-events:none;`;
    stage.appendChild(el);
    return el;
  }

  // ── Shadow overlay creeps over image as jaws approach ────────────────────
  const imgOverlay = document.createElement("div");
  imgOverlay.style.cssText = `position:fixed;
    left:${imgRect.left}px; top:${imgRect.top}px;
    width:${imgRect.width}px; height:${imgRect.height}px;
    background:rgba(20,0,50,0); pointer-events:none;
    border-radius:6px; z-index:2147483644;
    transition:background 0.38s ease;`;
  document.body.appendChild(imgOverlay);

  // ── Build initial jaws at pill position ───────────────────────────────────
  const nSmall = Math.max(3, Math.floor(startW / 16));
  const topJ   = makeJaw(true,  startCX, startCY, startW, startHH, nSmall);
  const botJ   = makeJaw(false, startCX, startCY, startW, startHH, nSmall);
  let throat   = null;

  // Save image's original style props so we can cleanly restore them
  const imgSavedTrans  = imgEl.style.transition;
  const imgSavedTransf = imgEl.style.transform;
  const imgSavedFilter = imgEl.style.filter;

  function tr(el, dur, ease, styles) {
    el.style.transition = `all ${dur}ms ${ease}`;
    requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(el.style, styles)));
  }

  // ── Phase 1: Pill cracks open, teeth show ────────────────────────────────
  setTimeout(() => {
    tr(topJ, 290, "cubic-bezier(0.34,1.56,0.64,1)", {
      top: `${startCY - startHH - openSmall}px`
    });
    tr(botJ, 290, "cubic-bezier(0.34,1.56,0.64,1)", {
      top: `${startCY + openSmall}px`
    });
    // Throat void appears as gap opens
    setTimeout(() => {
      throat = makeThroat(startCX, startCY, startW, openSmall * 0.9);
    }, 200);
  }, 25);

  // ── Phase 2: Launch at image, grow to swallow width, shadow falls ─────────
  setTimeout(() => {
    imgOverlay.style.background = "rgba(20,0,50,0.42)";

    tr(topJ, 420, "cubic-bezier(0.4,0,0.2,1)", {
      left: `${imgCX - bigW/2}px`,
      top:  `${imgCY - bigHH - openBig}px`,
      width: `${bigW}px`, height: `${bigHH}px`,
    });
    tr(botJ, 420, "cubic-bezier(0.4,0,0.2,1)", {
      left: `${imgCX - bigW/2}px`,
      top:  `${imgCY + openBig}px`,
      width: `${bigW}px`, height: `${bigHH}px`,
    });
    if (throat) {
      tr(throat, 420, "cubic-bezier(0.4,0,0.2,1)", {
        left: `${imgCX - bigW/2}px`,
        top:  `${imgCY - openBig}px`,
        width: `${bigW}px`, height: `${openBig * 2}px`,
      });
    }
  }, 390);

  // ── Phase 3: SNAP SHUT ────────────────────────────────────────────────────
  setTimeout(() => {
    tr(topJ, 105, "cubic-bezier(0.22,0,0.5,1)", { top: `${imgCY - bigHH}px` });
    tr(botJ, 105, "cubic-bezier(0.22,0,0.5,1)", { top: `${imgCY}px` });
    if (throat) { tr(throat, 80, "ease-in", { opacity:"0", height:"0", top:`${imgCY}px` }); }

    // ── White flash ───────────────────────────────────────────────────────
    const flash = document.createElement("div");
    flash.style.cssText = `position:fixed;inset:0;background:#fff;opacity:0.65;
      pointer-events:none;z-index:2147483643;`;
    stage.appendChild(flash);
    setTimeout(() => { flash.style.transition="opacity 0.3s"; flash.style.opacity="0"; }, 55);
    setTimeout(() => flash.remove(), 380);

    // ── Screen shake ──────────────────────────────────────────────────────
    const shakeStyle = document.createElement("style");
    shakeStyle.textContent = `@keyframes sq-chomp-shake {
      0%,100%{transform:translate(0,0)rotate(0)}
      14%{transform:translate(-8px,5px)rotate(-0.5deg)}
      28%{transform:translate(7px,-7px)rotate(0.4deg)}
      42%{transform:translate(-5px,5px)rotate(-0.3deg)}
      57%{transform:translate(5px,-3px)rotate(0.2deg)}
      71%{transform:translate(-3px,2px)rotate(-0.1deg)}
      85%{transform:translate(2px,-1px)}
    }`;
    document.head.appendChild(shakeStyle);
    stage.style.animation = "sq-chomp-shake 0.48s cubic-bezier(0.36,0.07,0.19,0.97)";
    setTimeout(() => { stage.style.animation=""; shakeStyle.remove(); }, 520);

    // ── Image consumed ────────────────────────────────────────────────────
    imgOverlay.style.transition = "background 0.12s ease";
    imgOverlay.style.background = "rgba(88,28,135,0.78)";
    imgEl.style.transition = "transform 0.18s ease, filter 0.18s ease";
    imgEl.style.transform  = "scale(0.9)";
    imgEl.style.filter     = "brightness(0.25) saturate(0) blur(1px)";

    // ── Particle burst from bite center ───────────────────────────────────
    for (let i = 0; i < 24; i++) {
      const p = document.createElement("div");
      const sz    = 5 + Math.random() * 12;
      const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.28;
      const dist  = 55 + Math.random() * 100;
      const hue   = 265 + Math.random() * 50;
      const lit   = 50 + Math.random() * 25;
      const col   = `hsl(${hue},85%,${lit}%)`;
      p.style.cssText = `position:fixed;
        left:${imgCX - sz/2}px; top:${imgCY - sz/2}px;
        width:${sz}px; height:${sz}px; border-radius:50%;
        background:${col}; pointer-events:none; z-index:2147483645;
        box-shadow:0 0 ${sz*1.2}px ${col};`;
      stage.appendChild(p);
      const delay = Math.random() * 60;
      setTimeout(() => {
        p.style.transition = `all ${0.38+Math.random()*0.35}s cubic-bezier(0,0,0.3,1)`;
        p.style.transform  = `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px) scale(0)`;
        p.style.opacity    = "0";
      }, delay);
      setTimeout(() => p.remove(), 900);
    }

    // Signal panel to open at the moment of the bite
    onReady();
  }, 860);

  // ── Phase 4: Bite mark + image recovers + jaws exit ──────────────────────
  setTimeout(() => {
    addBiteMarkSVG(imgRect);

    // Image springs back
    imgOverlay.style.transition = "background 0.55s ease";
    imgOverlay.style.background = "rgba(20,0,50,0)";
    imgEl.style.transition = `transform 0.55s cubic-bezier(0.34,1.3,0.64,1), filter 0.45s ease`;
    imgEl.style.transform  = imgSavedTransf || "";
    imgEl.style.filter     = imgSavedFilter || "";

    tr(topJ, 350, "cubic-bezier(0.4,0,1,1)", {
      top: `${-bigHH * 3}px`, opacity: "0",
    });
    tr(botJ, 350, "cubic-bezier(0.4,0,1,1)", {
      top: `${window.innerHeight + bigHH * 2}px`, opacity: "0",
    });

    setTimeout(() => {
      imgEl.style.transition = imgSavedTrans;
      if (wrapEl) wrapEl.style.visibility = "visible";
      imgOverlay.remove();
      stage.remove();
    }, 420);
  }, 1090);
}

function addBiteMarkSVG(rect) {
  const w = rect.width;
  // Bite mark sits at the horizontal center of the image (where jaws snapped)
  const biteY = rect.top + rect.height * 0.5;

  const n  = Math.max(4, Math.floor(w / 38)); // upper tooth count
  const tw = w / n;                            // tooth spacing
  const r  = tw * 0.33;                        // upper tooth radius
  const r2 = r * 0.78;                         // lower tooth radius (slightly smaller)
  const gap = r * 0.6;                         // gap between upper & lower rows

  // Upper row: n circles aligned to tooth positions
  // Lower row: n circles offset by half tooth width (interdigitates)
  let upper = '', lower = '';
  for (let i = 0; i < n; i++) {
    const cx = tw * (i + 0.5);
    upper += `<circle cx="${cx}" cy="${r}" r="${r}" fill="rgba(76,29,149,0.7)"/>`;
    // Enamel sheen on upper teeth
    upper += `<ellipse cx="${cx}" cy="${r*0.45}" rx="${r*0.42}" ry="${r*0.28}" fill="rgba(255,255,255,0.18)"/>`;
  }
  for (let i = 0; i < n + 1; i++) {
    const cx = tw * i;
    if (cx - r2 > -r && cx + r2 < w + r) {
      lower += `<circle cx="${cx}" cy="${r*2 + gap + r2}" r="${r2}" fill="rgba(76,29,149,0.55)"/>`;
      lower += `<ellipse cx="${cx}" cy="${r*2+gap+r2*0.45}" rx="${r2*0.42}" ry="${r2*0.28}" fill="rgba(255,255,255,0.14)"/>`;
    }
  }

  const totalH = r * 2 + gap + r2 * 2 + 6;
  const uid = `sq-bm-${Math.random().toString(36).slice(2,7)}`;
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;
    left:${rect.left}px; top:${biteY - r}px;
    width:${w}px; height:${totalH}px;
    pointer-events:none; z-index:2147483645;`;

  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}">
    <defs>
      <filter id="${uid}f" x="-15%" y="-15%" width="130%" height="130%">
        <feGaussianBlur stdDeviation="2.8" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g filter="url(#${uid}f)">${upper}${lower}</g>
  </svg>`;

  document.body.appendChild(el);
  // Hold visible for a beat, then fade
  setTimeout(() => { el.style.transition = "opacity 1.2s ease"; el.style.opacity = "0"; }, 800);
  setTimeout(() => el.remove(), 2200);
}

// ─── Absorb: beam connects pill to image, colors drain into pill ──────────────
function playDrainAnim(imgEl, onReady) {
  const imgRect = imgEl.getBoundingClientRect();
  if (imgRect.width < 20 || imgRect.height < 20) { onReady(); return; }

  const host   = document.getElementById("__scoutiq__");
  const wrapEl = host?.shadowRoot?.querySelector("#sq-wrap");
  const pR     = wrapEl?.getBoundingClientRect();
  const pCX    = pR ? pR.left + pR.width  / 2 : imgRect.left + imgRect.width  / 2;
  const pCY    = pR ? pR.top  + pR.height / 2 : imgRect.top  - 50;
  const ancX   = imgRect.left + imgRect.width  / 2;  // where beam meets image
  const ancY   = imgRect.top;

  const stage = document.createElement("div");
  stage.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:2147483646;`;
  document.body.appendChild(stage);

  // ── Beam: animated SVG path drawn from pill to image top ─────────────────
  const ns  = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.style.cssText = `position:absolute;inset:0;width:100%;height:100%;overflow:visible;`;
  stage.appendChild(svg);

  const defs = document.createElementNS(ns, "defs");
  svg.appendChild(defs);

  function svgEl(tag, attrs) {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // Gradient along the beam (pill colour → image anchor)
  const grad = svgEl("linearGradient", {
    id:"sq-d-grad", gradientUnits:"userSpaceOnUse",
    x1:pCX, y1:pCY, x2:ancX, y2:ancY,
  });
  grad.appendChild(svgEl("stop", { offset:"0%",   "stop-color":"#a78bfa" }));
  grad.appendChild(svgEl("stop", { offset:"100%",  "stop-color":"#7c3aed" }));
  defs.appendChild(grad);

  // Glow filter on beam
  const gf = svgEl("filter", { id:"sq-d-glow", x:"-20%", y:"-20%", width:"140%", height:"140%" });
  const fb = svgEl("feGaussianBlur", { stdDeviation:"2.5", result:"b" });
  const fm = svgEl("feMerge", {}); fm.appendChild(svgEl("feMergeNode",{in:"b"})); fm.appendChild(svgEl("feMergeNode",{in:"SourceGraphic"}));
  gf.appendChild(fb); gf.appendChild(fm); defs.appendChild(gf);

  // Curved beam path (quadratic bezier for a natural arc)
  const cpX = (pCX + ancX) / 2 + (Math.random() - 0.5) * 50;
  const cpY = Math.min(pCY, ancY) - Math.abs(ancY - pCY) * 0.25;
  const beamD = `M ${pCX} ${pCY} Q ${cpX} ${cpY} ${ancX} ${ancY}`;
  const dx = ancX - pCX, dy = ancY - pCY;
  const beamLen = Math.sqrt(dx*dx + dy*dy) * 1.08;

  const beamPath = svgEl("path", {
    d: beamD,
    stroke: "url(#sq-d-grad)", "stroke-width":"3",
    fill:"none", "stroke-linecap":"round",
    "stroke-dasharray": beamLen,
    "stroke-dashoffset": beamLen,
    filter:"url(#sq-d-glow)",
  });
  svg.appendChild(beamPath);

  // Draw beam (dash-offset trick)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    beamPath.style.transition = "stroke-dashoffset 0.26s ease-out";
    beamPath.setAttribute("stroke-dashoffset", "0");
  }));

  // ── Drain overlay: image copy with purple-grey filter sweeps top→bottom ───
  const imgCS   = window.getComputedStyle(imgEl);
  const imgCopy = document.createElement("img");
  imgCopy.src = imgEl.src;
  imgCopy.style.cssText = `position:fixed;
    left:${imgRect.left}px; top:${imgRect.top}px;
    width:${imgRect.width}px; height:${imgRect.height}px;
    object-fit:${imgCS.objectFit || "cover"};
    object-position:${imgCS.objectPosition || "center"};
    filter:grayscale(1) brightness(0.48) sepia(0.5) hue-rotate(250deg) saturate(3);
    clip-path:inset(100% 0 0 0);
    pointer-events:none; z-index:2147483644; border-radius:4px;`;
  document.body.appendChild(imgCopy);

  // Bright scan edge that rides the drain line (gives it a "cutting" feel)
  const drainEdge = document.createElement("div");
  drainEdge.style.cssText = `position:fixed;
    left:${imgRect.left - 2}px; top:${imgRect.top}px;
    width:${imgRect.width + 4}px; height:4px;
    background:linear-gradient(90deg,transparent 0%,#c4b5fd 20%,#fff 50%,#c4b5fd 80%,transparent 100%);
    box-shadow:0 0 16px 4px rgba(167,139,250,0.9), 0 0 40px rgba(124,58,237,0.5);
    pointer-events:none; z-index:2147483645;
    transition:top 0.92s linear;`;
  document.body.appendChild(drainEdge);

  // Start sweep 300ms after beam connects
  setTimeout(() => {
    imgCopy.style.transition = "clip-path 0.92s linear";
    imgCopy.style.clipPath = "inset(0% 0 0 0)";
    drainEdge.style.top = `${imgRect.top + imgRect.height - 4}px`;
  }, 300);

  // ── Energy particles: colored dots travel from image to pill ──────────────
  const drainStart = Date.now() + 300;
  let pInt;
  setTimeout(() => {
    pInt = setInterval(() => {
      for (let i = 0; i < 2; i++) {
        const prog  = Math.min(1, (Date.now() - drainStart) / 920);
        const p     = document.createElement("div");
        const sz    = 4 + Math.random() * 9;
        const spX   = imgRect.left + Math.random() * imgRect.width;
        const spY   = imgRect.top  + Math.random() * imgRect.height * prog;
        const dur   = 0.30 + Math.random() * 0.40;
        const col   = `hsl(${Math.random()*360},88%,66%)`;
        p.style.cssText = `position:fixed;left:${spX}px;top:${spY}px;
          width:${sz}px;height:${sz}px;border-radius:50%;
          background:${col};box-shadow:0 0 ${sz*1.6}px ${col};
          pointer-events:none;z-index:2147483645;
          transition:left ${dur}s ease-in,top ${dur}s ease-in,
            opacity ${dur}s ease-in,transform ${dur}s ease-in;`;
        document.body.appendChild(p);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          p.style.left = `${pCX - sz/2}px`;
          p.style.top  = `${pCY - sz/2}px`;
          p.style.opacity   = "0";
          p.style.transform = "scale(0.1)";
        }));
        setTimeout(() => p.remove(), dur * 1000 + 200);
      }
    }, 48);
    setTimeout(() => clearInterval(pInt), 1020);
  }, 300);

  // ── Pill absorption: expanding rings radiate outward as energy arrives ─────
  const absorbSty = document.createElement("style");
  absorbSty.textContent = `@keyframes sq-absorb-ring {
    0%   { transform:scale(1);   opacity:0.9; }
    100% { transform:scale(2.4); opacity:0;   }
  }`;
  document.head.appendChild(absorbSty);

  const rW = (pR?.width  || 160) + 8;
  const rH = (pR?.height || 44)  + 8;
  const spawnRing = () => {
    const r = document.createElement("div");
    r.style.cssText = `position:fixed;
      left:${pCX - rW/2}px; top:${pCY - rH/2}px;
      width:${rW}px; height:${rH}px;
      border-radius:999px;
      border:2px solid rgba(167,139,250,0.9);
      box-shadow:0 0 8px rgba(124,58,237,0.4);
      pointer-events:none; z-index:2147483645;
      animation:sq-absorb-ring 0.72s ease-out forwards;`;
    stage.appendChild(r);
    setTimeout(() => r.remove(), 760);
  };
  [240, 460, 660, 840, 980, 1090, 1190].forEach(t => setTimeout(spawnRing, t));

  // ── Full-charge burst from pill + open panel ──────────────────────────────
  setTimeout(() => {
    // Bright flash on pill
    const pillFlash = document.createElement("div");
    pillFlash.style.cssText = `position:fixed;
      left:${pCX - rW/2 - 8}px; top:${pCY - rH/2 - 8}px;
      width:${rW+16}px; height:${rH+16}px;
      border-radius:999px;
      background:radial-gradient(ellipse,rgba(167,139,250,0.7),transparent 70%);
      pointer-events:none; z-index:2147483645;
      transition:opacity 0.45s ease;`;
    stage.appendChild(pillFlash);
    setTimeout(() => { pillFlash.style.opacity="0"; }, 50);

    // Particle burst from pill outward
    for (let i = 0; i < 20; i++) {
      const p   = document.createElement("div");
      const sz  = 5 + Math.random() * 11;
      const ang = (i / 20) * Math.PI * 2 + Math.random() * 0.35;
      const dst = 50 + Math.random() * 80;
      const col = `hsl(${265 + Math.random()*60},85%,${58+Math.random()*22}%)`;
      p.style.cssText = `position:fixed;left:${pCX-sz/2}px;top:${pCY-sz/2}px;
        width:${sz}px;height:${sz}px;border-radius:50%;
        background:${col};box-shadow:0 0 ${sz}px ${col};
        pointer-events:none;z-index:2147483645;`;
      stage.appendChild(p);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        p.style.transition = `all ${0.42+Math.random()*0.3}s cubic-bezier(0,0,0.3,1)`;
        p.style.transform  = `translate(${Math.cos(ang)*dst}px,${Math.sin(ang)*dst}px) scale(0)`;
        p.style.opacity    = "0";
      }));
      setTimeout(() => p.remove(), 600);
    }

    onReady();
  }, 1340);

  // ── Cleanup: fade drain copy away, restore ────────────────────────────────
  setTimeout(() => {
    imgCopy.style.transition  = "opacity 0.7s ease";
    imgCopy.style.opacity     = "0";
    drainEdge.remove();
    beamPath.style.transition = "opacity 0.5s ease";
    beamPath.style.opacity    = "0";
    setTimeout(() => {
      imgCopy.remove();
      absorbSty.remove();
      stage.remove();
    }, 750);
  }, 1580);
}

function playImageReadAnim(imgEl, onReady = () => {}) {
  if (_readImgStyle === "none" || !imgEl) { onReady(); return; }
  const rect = imgEl.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) { onReady(); return; }

  if (_readImgStyle === "chomp") {
    playChompElaborate(imgEl, onReady);
    return;
  }

  if (_readImgStyle === "absorb") {
    playDrainAnim(imgEl, onReady);
    return;
  }

  // All non-chomp styles open the panel immediately then run animation in parallel
  onReady();

  const wrap = document.createElement("div");
  wrap.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;
    width:${rect.width}px;height:${rect.height}px;
    pointer-events:none;z-index:2147483646;overflow:hidden;border-radius:6px;`;
  document.body.appendChild(wrap);

  if (_readImgStyle === "focus") {
    const s = Math.min(28, rect.width * 0.28, rect.height * 0.28);
    const b = 3;
    const corners = [
      { top:0,    left:0,  borderTop:b, borderLeft:b   },
      { top:0,    right:0, borderTop:b, borderRight:b  },
      { bottom:0, left:0,  borderBottom:b, borderLeft:b  },
      { bottom:0, right:0, borderBottom:b, borderRight:b },
    ];
    corners.forEach(c => {
      const d = document.createElement("div");
      const pos = Object.entries(c)
        .filter(([k]) => ["top","left","right","bottom"].includes(k))
        .map(([k,v]) => `${k}:${v}px`).join(";");
      const borders = Object.entries(c)
        .filter(([k]) => k.startsWith("border"))
        .map(([k,v]) => `${k.replace(/[A-Z]/g, m => "-"+m.toLowerCase())}:${v}px solid #7c3aed`).join(";");
      d.style.cssText = `position:absolute;width:${s}px;height:${s}px;${pos};${borders};
        opacity:0;transition:opacity 0.2s ease,transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
        transform:scale(1.4);`;
      wrap.appendChild(d);
      requestAnimationFrame(() => { d.style.opacity = "1"; d.style.transform = "scale(1)"; });
    });
    const glow = document.createElement("div");
    glow.style.cssText = `position:absolute;inset:0;
      background:rgba(124,58,237,0.12);opacity:0;transition:opacity 0.3s;`;
    wrap.appendChild(glow);
    requestAnimationFrame(() => { glow.style.opacity = "1"; });

  } else if (_readImgStyle === "scanline") {
    const line = document.createElement("div");
    line.style.cssText = `position:absolute;left:0;right:0;top:0;height:3px;
      background:linear-gradient(90deg,transparent 0%,#7c3aed 30%,#c4b5fd 50%,#7c3aed 70%,transparent 100%);
      box-shadow:0 0 10px 2px rgba(124,58,237,0.6);
      transition:top 0.85s linear;`;
    wrap.appendChild(line);
    requestAnimationFrame(() => { line.style.top = rect.height - 3 + "px"; });

  } else if (_readImgStyle === "glow") {
    wrap.style.boxShadow = "0 0 0 0 rgba(124,58,237,0)";
    wrap.style.transition = "box-shadow 0.3s ease";
    requestAnimationFrame(() => {
      wrap.style.boxShadow = "0 0 0 4px #7c3aed, 0 0 28px rgba(124,58,237,0.55)";
    });
  }

  setTimeout(() => wrap.remove(), 950);
}

// ─── Movement trail ───────────────────────────────────────────────────────────
let _lastTrailTime = 0;
function emitTrail(x, y) {
  if (_trailStyle === "none") return;
  const now = Date.now();
  const interval = _trailStyle === "comet" ? 20 : _trailStyle === "burst" ? 45 : 35;
  if (now - _lastTrailTime < interval) return;
  _lastTrailTime = now;

  if (_trailStyle === "dots") {
    // Bold Pac-Man style dots — large, immediate fade
    const size = 14 + Math.random() * 8;
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;left:${x-size/2}px;top:${y-size/2}px;
      width:${size}px;height:${size}px;border-radius:50%;
      background:#7c3aed;opacity:1;pointer-events:none;z-index:2147483645;
      box-shadow:0 0 8px rgba(124,58,237,0.7);`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      el.style.opacity = "0"; el.style.transform = "scale(0.1)";
    }));
    setTimeout(() => el.remove(), 450);

  } else if (_trailStyle === "sparkle") {
    // High-energy sparkles that shoot outward
    const chars = ["✦","✧","★","◆","⬟","✺"];
    for (let i = 0; i < 2; i++) {
      const el = document.createElement("div");
      el.textContent = chars[Math.floor(Math.random() * chars.length)];
      const size = 14 + Math.random() * 10;
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      el.style.cssText = `position:fixed;left:${x-size/2}px;top:${y-size/2}px;
        font-size:${size}px;color:#c4b5fd;opacity:1;pointer-events:none;
        z-index:2147483645;text-shadow:0 0 6px #7c3aed;`;
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        el.style.opacity = "0";
        el.style.transform = `translate(${dx}px,${dy}px) scale(0) rotate(${Math.random()*180}deg)`;
      }));
      setTimeout(() => el.remove(), 550);
    }

  } else if (_trailStyle === "comet") {
    // Dense fast-fading orbs — classic comet tail
    for (let i = 0; i < 3; i++) {
      const size = (8 + Math.random() * 6) * (1 - i * 0.2);
      const ox = (Math.random()-0.5)*6, oy = (Math.random()-0.5)*6;
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;left:${x-size/2+ox}px;top:${y-size/2+oy}px;
        width:${size}px;height:${size}px;border-radius:50%;
        background:radial-gradient(circle,#e9d5ff,#7c3aed);
        opacity:${0.9 - i*0.25};pointer-events:none;z-index:2147483645;`;
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = `opacity ${0.25 + i*0.05}s ease`;
        el.style.opacity = "0";
      }));
      setTimeout(() => el.remove(), 300);
    }

  } else if (_trailStyle === "burst") {
    // Explosive burst of particles at each point — very visible
    const count = 6;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      const size = 8 + Math.random() * 8;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 24 + Math.random() * 20;
      el.style.cssText = `position:fixed;left:${x-size/2}px;top:${y-size/2}px;
        width:${size}px;height:${size}px;border-radius:50%;
        background:hsl(${270+Math.random()*40},80%,${55+Math.random()*25}%);
        opacity:1;pointer-events:none;z-index:2147483645;
        box-shadow:0 0 6px rgba(124,58,237,0.5);`;
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = "opacity 0.45s ease, transform 0.45s ease";
        el.style.opacity = "0";
        el.style.transform = `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px) scale(0)`;
      }));
      setTimeout(() => el.remove(), 500);
    }
  }
}

function startReadingAnim() {} // kept for compat — now handled by playImageReadAnim
function stopReadingAnim() {}  // image overlays self-remove via setTimeout

// ─── Animations ──────────────────────────────────────────────────────────────
function applyPillAnimation(style) {
  const pill = $("sq-pill");
  if (!pill) return;
  pill.classList.remove("sq-anim-pop", "sq-anim-glow", "sq-anim-breathe");
  if (style === "none") return;

  if (style === "breathe") {
    pill.classList.add("sq-anim-breathe");
    return;
  }

  // "pop" — spring entrance, then glow pulse once finished
  pill.classList.add("sq-anim-pop");
  pill.addEventListener("animationend", () => {
    pill.classList.remove("sq-anim-pop");
    pill.classList.add("sq-anim-glow");
    pill.addEventListener("animationend", () => {
      pill.classList.remove("sq-anim-glow");
    }, { once: true });
  }, { once: true });
}

// ─── Inject panel ─────────────────────────────────────────────────────────────
function inject(info) {
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
  $("sq-gear-btn").addEventListener("click", (e) => { e.stopPropagation(); toggleSettings(); });
  $("sq-close").addEventListener("click", closePanel);
  $("sq-btn-track").addEventListener("click", handleTrack);
  $("sq-btn-login").addEventListener("click", handleSignIn);
  $("sq-password").addEventListener("keydown", (e) => { if (e.key === "Enter") handleSignIn(); });
  $("sq-logo-link").addEventListener("mousedown", (e) => e.stopPropagation());

  // Click outside settings dropdown to close it
  shadow.addEventListener("click", (e) => {
    if ($("sq-settings-body").style.display !== "none" &&
        !e.target.closest("#sq-settings-body") &&
        !e.target.closest("#sq-gear-btn")) {
      closeSettings();
    }
  });

  // Header click (not on buttons) minimizes
  $("sq-header").addEventListener("click", (e) => {
    const t = e.target;
    if (t.id === "sq-close" || t.id === "sq-gear-btn" || (t.closest && t.closest("#sq-logo-link"))) return;
    closePanel();
  });


  // Auto-show toggle
  chrome.storage.local.get(["sq_auto_open", "sq_animation"], (d) => {
    $("sq-auto-open").checked = d.sq_auto_open !== false;
    const anim = d.sq_animation ?? "pop";
    $("sq-anim-select").value = anim;
    applyPillAnimation(anim);
  });
  $("sq-auto-open").addEventListener("change", (e) => {
    chrome.storage.local.set({ sq_auto_open: e.target.checked });
  });
  $("sq-anim-select").addEventListener("change", (e) => {
    const anim = e.target.value;
    chrome.storage.local.set({ sq_animation: anim });
    applyPillAnimation(anim);
  });
  $("sq-read-anim-select").addEventListener("change", (e) => {
    _readImgStyle = e.target.value;
    chrome.storage.local.set({ sq_read_animation: _readImgStyle });
  });
  $("sq-trail-select").addEventListener("change", (e) => {
    _trailStyle = e.target.value;
    chrome.storage.local.set({ sq_trail: _trailStyle });
  });

  const sqWrap = $("sq-wrap");
  makeDraggable($("sq-pill"), sqWrap, handleImageDrop);
  makeDraggable($("sq-header"), sqWrap, handleImageDrop);

  // Restore saved position so pill appears in same spot across tabs
  loadStoredPos().then(pos => applyPos(sqWrap, pos));

  // Load all animation prefs
  chrome.storage.local.get(["sq_animation", "sq_read_animation", "sq_trail"], (d) => {
    applyPillAnimation(d.sq_animation ?? "pop");
    _readImgStyle = d.sq_read_animation ?? "chomp";
    _trailStyle   = d.sq_trail ?? "dots";
    $("sq-read-anim-select").value = _readImgStyle;
    $("sq-trail-select").value     = _trailStyle;
  });

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

// ─── Pill state ───────────────────────────────────────────────────────────────
function pillOff(saveState = false) {
  productInfo = null;
  compareResults = [];
  const host = document.getElementById("__scoutiq__");
  if (host) host.remove();
  shadow = null;
  injected = false;
  if (saveState) chrome.storage.local.set({ sq_pill_active: false });
}

async function pillOn(saveState = false) {
  if (injected) return;
  session = await loadSession();
  inject(null);
  if (saveState) chrome.storage.local.set({ sq_pill_active: true });
}

// Boot: runs once per real page load — check both explicit state and auto-detect
async function boot() {
  if (injected) return;
  const data = await chrome.storage.local.get(["sq_pill_active", "sq_auto_open"]);
  if (data.sq_pill_active) { await pillOn(); return; }
  if (data.sq_auto_open === false) return;
  if (!isProductPage()) return;
  await pillOn();
}

// SPA navigation — hide pill on URL change, re-run boot after page settles
if (window.__sq_nav_observer) window.__sq_nav_observer.disconnect();
let lastUrl = location.href;
const navObserver = new MutationObserver(() => {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  pillOff(); // hide without clearing sq_pill_active
  setTimeout(boot, 300);
});
window.__sq_nav_observer = navObserver;
navObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

// Cross-tab sync — react immediately when pill state changes in another tab
if (!window.__sq_storage_listener) {
  window.__sq_storage_listener = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("sq_pill_active" in changes)) return;
    const active = changes.sq_pill_active.newValue;
    if (active && !injected) pillOn();
    else if (!active && injected) pillOff();
  });
}

// Icon click toggle — saves state so all tabs stay in sync
window.__sq_toggle = async (on) => {
  if (on) await pillOn(true);
  else pillOff(true);
};

// Boot: only on real first page load, not on re-injection
if (!window.__sq_toggle_registered) {
  window.__sq_toggle_registered = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 50));
  } else {
    setTimeout(boot, 50);
  }
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
