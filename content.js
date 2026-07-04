// Plain IIFE â€” const declarations are function-scoped so re-injection is safe.
// window.__sq_nav_observer is disconnected before re-registering.
(() => { try {
console.log("[ScoutIQ] content.js initializing â€” GSAP:", typeof gsap !== "undefined" ? gsap.version : "NOT LOADED");

const SCOUTIQ_URL = "https://scoutiq10.lovable.app";
const SCRAPER_URL = "https://scoutiq-scraper.onrender.com";
const EXT_KEY = "sq_ext_Kp7mN3xQ9vR2wL5j";
const SUPABASE_URL = "https://qxsegnzpjbxmunfnvavh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4c2VnbnpwamJ4bXVuZm52YXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTU0OTcsImV4cCI6MjA5NjI5MTQ5N30.obX93Mxx_pZ3csXAVLW1j4fYT5wC0QM4um-8--nDryA";

// â”€â”€â”€ Product detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Hard exclusions (listing / search / category pages) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Search query params â€” almost always a results page
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

  // â”€â”€ Positive signals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // og:type = product (very reliable â€” set per-item by every major retailer)
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
  return document.title.split(/\s*[\|Ã¢â‚¬"\-]\s*/)[0].trim();
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
    if (txt && /\$|Â£|â‚¬|\d/.test(txt)) return txt.slice(0, 20);
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
    .replace(/\s*[\|Ã¢â‚¬"\-]\s*(Amazon|Walmart|Best Buy|Target|eBay|Newegg|Etsy|Costco|Shop|Store|Buy|Online).*$/i, "")
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

// â”€â”€â”€ Shadow DOM Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  /* â”€â”€ Micro interaction: spring entrance â”€â”€ */
  @keyframes sq-pop-in {
    0%   { transform: scale(0.4); opacity: 0; }
    65%  { transform: scale(1.12); opacity: 1; }
    82%  { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
  /* â”€â”€ Micro interaction: attention glow pulse (plays once after entrance) â”€â”€ */
  @keyframes sq-glow-pulse {
    0%, 100% { box-shadow: 0 4px 20px rgba(124,58,237,0.45); }
    50%       { box-shadow: 0 4px 32px rgba(124,58,237,0.9), 0 0 0 6px rgba(124,58,237,0.15); }
  }
  /* â”€â”€ Micro interaction: subtle breathe (continuous, low-key) â”€â”€ */
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
  .sq-result-wrap { position: relative; display: flex; align-items: center; gap: 7px; padding: 7px 9px; border-radius: 7px; border: 1px solid #1e1e1e; background: #141414; color: inherit; transition: border-color 0.12s, background 0.12s; cursor: pointer; overflow: hidden; }
  .sq-result-wrap:hover { border-color: #7c3aed44; background: #1a1220; }
  .sq-result-wrap.sq-best { border-color: #059669; background: #052e1a; }
  .sq-atc-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(10,0,24,0.78); opacity: 0; transition: opacity 0.14s; border-radius: 6px; pointer-events: none; }
  .sq-result-wrap:hover .sq-atc-overlay { opacity: 1; pointer-events: auto; }
  .sq-atc-btn { background: #7c3aed; color: #fff; border: none; border-radius: 6px; padding: 5px 13px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.12s, transform 0.1s; letter-spacing: 0.01em; }
  .sq-atc-btn:hover { background: #6d28d9; transform: scale(1.04); }
  .sq-atc-btn.sq-atc-added { background: #059669; cursor: default; }
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
  .sq-result-wrap.sq-best .sq-result-price { color: #34d399; }
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
      <button id="sq-pill-main"><span>âš¡</span><span>Compare prices</span></button>
    </div>
    <div id="sq-panel">
      <div class="sq-header" id="sq-header" draggable="false">
        <a class="sq-logo" id="sq-logo-link" href="${SCOUTIQ_URL}/dashboard" target="_blank" rel="noopener"><div class="sq-logo-icon">âš¡</div>ScoutIQ</a>
        <span class="sq-version">v1.4</span>
        <button class="sq-gear-btn" id="sq-gear-btn" title="Settings">âš™</button>
        <button class="sq-close" id="sq-close">âœ•</button>
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
            <option value="chomp">Chomp ðŸ‘¾</option>
            <option value="absorb">Absorb âœ¨</option>
            <option value="wand">Wand ðŸª„</option>
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
          <button class="sq-btn-track" id="sq-btn-track">🛒 Add to cart</button>
          <div class="sq-hint" id="sq-hint"></div>
        </div>
        <div class="sq-auth" id="sq-auth" style="display:none">
          <div class="sq-auth-title">Sign in to track prices</div>
          <div class="sq-field"><label>Email</label><input type="email" id="sq-email" placeholder="you@email.com" /></div>
          <div class="sq-field"><label>Password</label><input type="password" id="sq-password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" /></div>
          <div class="sq-auth-error" id="sq-auth-error"></div>
          <button class="sq-btn-login" id="sq-btn-login">Sign in</button>
          <div class="sq-auth-footer">No account? <a href="${SCOUTIQ_URL}/signup" target="_blank">Sign up free â†—</a></div>
        </div>
      </div>
    </div>
  </div>
`;

// â”€â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let shadow = null;
let productInfo = null;
let compareResults = [];
let session = null;
let injected = false;

function $(id) { return shadow ? shadow.querySelector("#" + id) : null; }

// â”€â”€â”€ Session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Pill enabled state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isPillEnabled() {
  return new Promise(r => chrome.storage.local.get(["sq_pill_on"], d => r(!!d.sq_pill_on)));
}
function setPillEnabled(val) {
  return new Promise(r => chrome.storage.local.set({ sq_pill_on: val }, r));
}

// â”€â”€â”€ Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // Non-product page â€” show placeholder message
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
  // Show Track button immediately â€” don't wait for compare results
  $("sq-track-section").style.display = "";
  updateTrackBtn();
}

// â”€â”€â”€ Compare â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmtPrice(p) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p);
}
const BADGES = { Amazon: "amazon", Walmart: "walmart", "Best Buy": "bestbuy", Target: "target", eBay: "ebay", Newegg: "newegg" };

async function fetchPrices() {
  $("sq-spinner").style.display = "";
  $("sq-results").style.display = "none";
  $("sq-error").style.display = "none";
  $("sq-track-section").style.display = "none";

  // Show "waking up" hint after 4s â€” Render free tier cold starts take up to 45s
  const wakeHint = setTimeout(() => {
    const err = $("sq-error");
    if (err) { err.textContent = "Waking up price serverâ€¦ this takes ~30s on first use."; err.style.display = ""; }
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
    const wrap = document.createElement("div");
    wrap.className = `sq-result-wrap${isBest ? " sq-best" : ""}`;
    wrap.innerHTML = `
      <span class="sq-badge sq-badge-${BADGES[r.retailer] || "other"}">${r.retailer}</span>
      <span class="sq-result-name">${r.name.slice(0, 45)}</span>
      ${isBest ? '<span class="sq-best-label">BEST</span>' : ""}
      <span class="sq-result-price">${fmtPrice(r.price)}</span>
      <div class="sq-atc-overlay"><button class="sq-atc-btn">🛒 Add to cart</button></div>
    `;
    // Clicking the row (not the overlay) opens the product URL
    wrap.addEventListener("click", (e) => {
      if (!e.target.closest(".sq-atc-overlay")) window.open(r.url, "_blank", "noopener");
    });
    // Per-row add to cart
    wrap.querySelector(".sq-atc-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      addResultToCart(r, e.currentTarget);
    });
    list.appendChild(wrap);
  });
  list.style.display = "flex";
  $("sq-track-section").style.display = "";
  updateTrackBtn();
}

async function addResultToCart(r, btn) {
  if (!session) { $("sq-auth").style.display = ""; $("sq-email").focus(); return; }
  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tracked_products`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: session.user.id, product_name: r.name, url: r.url, retailer: r.retailer, current_price: r.price, currency: "USD", drop_threshold_pct: 5, scrape_status: "pending" }),
    });
    if (res.status === 401) {
      session = null;
      chrome.storage.local.remove("sb_session");
      $("sq-auth").style.display = "";
      btn.disabled = false;
      btn.textContent = "🛒 Add to cart";
      return;
    }
    btn.textContent = "✓ Added!";
    btn.className = "sq-atc-btn sq-atc-added";
  } catch {
    btn.disabled = false;
    btn.textContent = "🛒 Add to cart";
  }
}

// â”€â”€â”€ Track â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateTrackBtn() {
  const btn = $("sq-btn-track");
  if (!btn) return;
  if (!session) {
    btn.textContent = "🛒 Add to cart";
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
    if (res.status === 401) { session = null; chrome.storage.local.remove("sb_session"); $("sq-auth").style.display = ""; btn.disabled = false; btn.textContent = "🛒 Add to cart"; return; }
    btn.className = “sq-btn-track sq-tracked”; btn.textContent = “✓ In cart”; btn.disabled = true;
    $(“sq-hint”).innerHTML = `<a href=”${SCOUTIQ_URL}/dashboard/cart” target=”_blank”>View in cart ↗</a>`;
    $("sq-auth").style.display = "none";
  } catch {
    btn.disabled = false; btn.textContent = "🛒 Add to cart";
    $(“sq-hint”).textContent = “Error — try again.”;
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

// â”€â”€â”€ Drag & position persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    let hlImg = null;
    let pendingX = e.clientX, pendingY = e.clientY;
    let rafPending = false;
    let dropCheckFrame = 0; // throttle elementsFromPoint

    const onMove = (ev) => {
      pendingX = ev.clientX;
      pendingY = ev.clientY;

      if (!moved && Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
      if (!moved) {
        moved = true;
        handle.classList.add("sq-dragging");
        document.body.style.userSelect = "none";
        // Kill any transitions so position snaps instantly to cursor
        wrap.style.transition = "none";
        wrap.style.willChange = "left, top";
      }

      emitTrail(ev.clientX, ev.clientY);

      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const left = Math.max(4, Math.min(window.innerWidth  - wrap.offsetWidth  - 4, pendingX - offX));
        const top  = Math.max(4, Math.min(window.innerHeight - wrap.offsetHeight - 4, pendingY - offY));
        wrap.style.left   = left + "px";
        wrap.style.top    = top  + "px";
        wrap.style.right  = "auto";
        wrap.style.bottom = "auto";

        // elementsFromPoint is expensive â€” only run every 3 frames
        if (onDrop && ++dropCheckFrame % 3 === 0) {
          const under = document.elementsFromPoint(pendingX, pendingY);
          const imgEl = under.find(el => el.tagName === "IMG" && !el.closest("#__scoutiq__") && (el.naturalWidth > 30 || el.width > 30));
          if (imgEl !== hlImg) {
            if (hlImg) { hlImg.style.outline = ""; hlImg.style.borderRadius = ""; }
            hlImg = imgEl || null;
            if (hlImg) { hlImg.style.outline = "3px solid #7c3aed"; hlImg.style.borderRadius = "6px"; }
          }
        }
      });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      handle.classList.remove("sq-dragging");
      document.body.style.userSelect = "";
      wrap.style.transition  = "";
      wrap.style.willChange  = "auto";
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

// â”€â”€â”€ Image reading animation (injected into page DOM over the image) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _readImgStyle = "chomp";
let _trailStyle = "dots";

// â”€â”€â”€ Elaborate chomp: pill splits, grows, flies at image, snaps shut â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function playChompElaborate(imgEl, onReady) {
  const imgRect = imgEl.getBoundingClientRect();
  if (imgRect.width < 20 || imgRect.height < 20) { onReady(); return; }

  const host     = document.getElementById("__scoutiq__");
  const wrapEl   = host?.shadowRoot?.querySelector("#sq-wrap");
  const pillRect = wrapEl?.getBoundingClientRect();

  const imgCX   = imgRect.left + imgRect.width  / 2;
  const imgCY   = imgRect.top  + imgRect.height / 2;
  const startCX = pillRect ? pillRect.left + pillRect.width  / 2 : imgCX;
  const startCY = pillRect ? pillRect.top  + pillRect.height / 2 : imgRect.top - 80;
  const startW  = pillRect ? pillRect.width  : 160;
  const startHH = Math.max(20, pillRect ? pillRect.height / 2 : 26);

  const bigW   = Math.min(Math.max(imgRect.width * 1.15, 250), window.innerWidth * 0.88);
  const bigHH  = Math.max(bigW * 0.22, 52);
  const openBig = Math.max(bigHH, imgRect.height * 0.45);

  // Approach direction for rotation hinge effect
  const toImgX = imgCX - startCX, toImgY = imgCY - startCY;
  const toImgDist = Math.hypot(toImgX, toImgY) || 1;
  const rotSign = toImgX >= 0 ? 1 : -1;  // leading edge opens wider
  const windX = startCX - (toImgX / toImgDist) * 88;
  const windY = startCY - (toImgY / toImgDist) * 88;

  // Full-screen canvas
  const cv = document.createElement("canvas");
  cv.width  = window.innerWidth;
  cv.height = window.innerHeight;
  cv.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646;";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");

  // Image darkening overlay
  const imgOverlay = document.createElement("div");
  imgOverlay.style.cssText = `position:fixed;left:${imgRect.left}px;top:${imgRect.top}px;
    width:${imgRect.width}px;height:${imgRect.height}px;
    background:rgba(20,0,50,0);pointer-events:none;border-radius:6px;z-index:2147483644;`;
  document.body.appendChild(imgOverlay);

  if (wrapEl) wrapEl.style.visibility = "hidden";
  const imgSavedTrans  = imgEl.style.transition;
  const imgSavedTransf = imgEl.style.transform;
  const imgSavedFilter = imgEl.style.filter;

  // Seeded tooth variation — deterministic so teeth look the same every frame
  const tseed = Math.floor(Math.random() * 9999);
  function sr(n) { return ((n * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff; }

  // Animation state object — GSAP tweens these directly
  const S = { cx: startCX, cy: startCY, w: startW, hh: startHH,
               gap: 0, topRot: 0, botRot: 0, alpha: 1 };

  // ── Canvas helpers ──────────────────────────────────────────────────────────
  function rrect(p, x, y, w, h, r) {
    r = Math.min(r, w * 0.5, h * 0.5);
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);     p.arcTo(x+w, y,   x+w, y+r,   r);
    p.lineTo(x + w, y+h-r);     p.arcTo(x+w, y+h, x+w-r,y+h, r);
    p.lineTo(x + r, y + h);     p.arcTo(x,   y+h, x, y+h-r,   r);
    p.lineTo(x, y + r);         p.arcTo(x,   y,   x+r, y,      r);
    p.closePath();
  }

  function drawHalf(isTop) {
    const { cx, cy, w, hh, gap } = S;
    const rot  = isTop ? S.topRot : S.botRot;
    const gumY = cy + (isTop ? -gap : gap);
    const r    = hh * 0.5;
    const td   = isTop ? 1 : -1;   // tooth direction: top->down(+y), bottom->up(-y)
    const nTeeth = Math.max(4, Math.min(9, Math.floor(w / 34)));
    const slotW  = w / nTeeth;
    const toothH = Math.max(hh * 0.54, 13);

    ctx.save();
    ctx.globalAlpha = S.alpha;
    ctx.translate(cx, gumY);
    ctx.rotate(rot);

    // Body path
    const bp = new Path2D();
    rrect(bp, -w/2, isTop ? -hh : 0, w, hh, r);

    // 1. Drop shadow pass
    ctx.save();
    ctx.shadowColor  = "rgba(0,0,0,0.65)";
    ctx.shadowBlur   = 24;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = isTop ? 14 : -14;
    ctx.fillStyle = "#1a0035";
    ctx.fill(bp);
    ctx.restore();

    // 2. Main body gradient — light at outer edge, deep dark at seam
    const y0 = isTop ? -hh : hh, y1 = 0;
    const mg = ctx.createLinearGradient(0, y0, 0, y1);
    mg.addColorStop(0,    "#e9d5ff");  // bright lavender outer edge
    mg.addColorStop(0.18, "#a855f7");  // purple
    mg.addColorStop(0.55, "#6d28d9");  // deep purple
    mg.addColorStop(1,    "#0f0020");  // near-black at seam
    ctx.fillStyle = mg;
    ctx.fill(bp);

    // 3. Side edge darkening — cylindrical curvature illusion
    const sg = ctx.createLinearGradient(-w/2, 0, w/2, 0);
    sg.addColorStop(0,    "rgba(0,0,0,0.5)");
    sg.addColorStop(0.12, "rgba(0,0,0,0.0)");
    sg.addColorStop(0.88, "rgba(0,0,0,0.0)");
    sg.addColorStop(1,    "rgba(0,0,0,0.5)");
    ctx.fillStyle = sg;
    ctx.fill(bp);

    // 4. Specular highlight blob (offset left like real light source)
    const sy = isTop ? -hh * 0.72 : hh * 0.28;
    const sp = ctx.createRadialGradient(-w*0.08, sy, 0, -w*0.08, sy, w*0.3);
    sp.addColorStop(0,    "rgba(255,255,255,0.78)");
    sp.addColorStop(0.28, "rgba(255,255,255,0.28)");
    sp.addColorStop(0.65, "rgba(255,255,255,0.06)");
    sp.addColorStop(1,    "rgba(255,255,255,0)");
    ctx.fillStyle = sp;
    ctx.fill(bp);

    // 5. Inner (seam) ambient occlusion — thin dark strip at gum line
    ctx.save();
    ctx.clip(bp);
    const ao = ctx.createLinearGradient(0, 0, 0, isTop ? -hh*0.18 : hh*0.18);
    ao.addColorStop(0, "rgba(0,0,0,0.6)");
    ao.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ao;
    ctx.fillRect(-w/2, isTop ? -hh*0.18 : 0, w, hh*0.18);
    ctx.restore();

    // 6. Rim light on outer edge
    ctx.strokeStyle = "rgba(216,180,254,0.55)";
    ctx.lineWidth = 1.8;
    ctx.stroke(bp);

    // ── Gum tissue ──────────────────────────────────────────────────────────
    const gh  = toothH * 0.28;
    const gp  = new Path2D();
    gp.moveTo(-w/2, 0);
    for (let i = 0; i < nTeeth; i++) {
      const x0 = -w/2 + i*slotW, xm = x0 + slotW*0.5;
      gp.lineTo(x0 + slotW*0.08, 0);
      gp.quadraticCurveTo(xm, td*gh, x0 + slotW - slotW*0.08, 0);
    }
    gp.lineTo(w/2, 0);
    gp.lineTo(w/2, td*gh*0.45);
    gp.lineTo(-w/2, td*gh*0.45);
    gp.closePath();

    const gg = ctx.createLinearGradient(0, 0, 0, td*gh);
    gg.addColorStop(0, "#c8304a");
    gg.addColorStop(1, "#7a1828");
    ctx.fillStyle = gg;
    ctx.fill(gp);
    // Wet sheen on gum
    const gs = ctx.createLinearGradient(-w/2, 0, w/2, 0);
    gs.addColorStop(0,   "rgba(255,190,205,0)");
    gs.addColorStop(0.38,"rgba(255,190,205,0.32)");
    gs.addColorStop(0.62,"rgba(255,190,205,0.32)");
    gs.addColorStop(1,   "rgba(255,190,205,0)");
    ctx.fillStyle = gs;
    ctx.fill(gp);

    // ── Teeth ───────────────────────────────────────────────────────────────
    for (let i = 0; i < nTeeth; i++) {
      const s1 = sr(tseed+i*7), s2 = sr(tseed+i*7+1), s3 = sr(tseed+i*7+2);
      const xc = -w/2 + (i+0.5)*slotW;
      const tw = slotW * (0.48 + s1*0.24);
      const th = toothH * (0.70 + s2*0.44);
      const tilt = (s3 - 0.5) * 0.09;

      ctx.save();
      ctx.translate(xc, 0);
      ctx.rotate(tilt);

      const tp = new Path2D();
      tp.moveTo(-tw/2, 0);
      tp.lineTo( tw/2, 0);
      tp.bezierCurveTo( tw/2, td*th*0.55,  tw*0.34, td*th, 0, td*th);
      tp.bezierCurveTo(-tw*0.34, td*th,   -tw/2, td*th*0.55, -tw/2, 0);
      tp.closePath();

      // Tooth shadow
      ctx.save();
      ctx.shadowColor = "rgba(5,0,20,0.65)";
      ctx.shadowBlur  = 5;
      ctx.shadowOffsetX = 1.5;
      ctx.shadowOffsetY = td * 3;
      const tg = ctx.createLinearGradient(0, 0, 0, td*th);
      tg.addColorStop(0,    "#7c3aed");   // purple base blending into gum
      tg.addColorStop(0.09, "#f0ebff");   // fast ivory transition
      tg.addColorStop(0.6,  "#ffffff");   // white enamel
      tg.addColorStop(1,    "#ccc0e8");   // tip shadow
      ctx.fillStyle = tg;
      ctx.fill(tp);
      ctx.restore();

      // Enamel specular — thin bright sliver on left face of tooth
      const ep = new Path2D();
      ep.moveTo(-tw*0.28, 0);
      ep.bezierCurveTo(-tw*0.08, td*th*0.12, -tw*0.04, td*th*0.36, -tw*0.04, td*th*0.5);
      ep.lineTo(-tw*0.22, td*th*0.5);
      ep.bezierCurveTo(-tw*0.28, td*th*0.33, -tw*0.32, td*th*0.12, -tw*0.28, 0);
      ep.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fill(ep);

      ctx.restore();
    }

    ctx.restore(); // end half transform
  }

  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawHalf(true);
    drawHalf(false);
  }

  gsap.ticker.add(draw);

  // ── Phase 1 (30ms): CRACK OPEN ─────────────────────────────────────────────
  setTimeout(() => {
    gsap.to(S, { gap: startHH*0.85, topRot: rotSign*0.18, botRot: -rotSign*0.18,
      duration: 0.42, ease: "back.out(2.5)" });
    // Spit sparks from seam
    for (let i = 0; i < 12; i++) {
      const sp = document.createElement("div");
      const sz = 3 + Math.random()*6;
      const a  = (Math.random()-0.5) * Math.PI * 1.2;
      const d  = 22 + Math.random()*55;
      const col = `hsl(${265+Math.random()*30},85%,${60+Math.random()*25}%)`;
      sp.style.cssText = `position:fixed;left:${startCX-sz/2}px;top:${startCY-sz/2}px;
        width:${sz}px;height:${sz}px;border-radius:50%;pointer-events:none;z-index:2147483647;
        background:${col};box-shadow:0 0 ${sz*1.6}px ${col};`;
      document.body.appendChild(sp);
      gsap.to(sp, { x:Math.cos(a)*d, y:Math.sin(a)*d, scale:0, opacity:0,
        duration:0.28+Math.random()*0.22, ease:"power2.out",
        delay:Math.random()*0.05, onComplete:()=>sp.remove() });
    }
  }, 30);

  // ── Phase 2 (750ms): GAPE WIDE ─────────────────────────────────────────────
  setTimeout(() => {
    gsap.to(S, { gap: startHH*1.65, topRot: rotSign*0.26, botRot: -rotSign*0.26,
      duration: 0.55, ease: "back.out(1.7)" });
  }, 750);

  // ── Phase 3 (1380ms): WIND-UP ──────────────────────────────────────────────
  setTimeout(() => {
    gsap.to(S, { cx: windX, cy: windY, duration: 0.38, ease: "power2.out" });
    gsap.to(imgOverlay, { backgroundColor: "rgba(20,0,50,0.28)", duration: 0.5 });
  }, 1380);

  // ── Phase 4 (1840ms): LUNGE ────────────────────────────────────────────────
  setTimeout(() => {
    gsap.killTweensOf(S, "cx,cy,w,hh,gap,topRot,botRot");
    gsap.to(S, { cx:imgCX, cy:imgCY, w:bigW, hh:bigHH, gap:openBig,
      topRot:rotSign*0.32, botRot:-rotSign*0.32,
      duration:0.54, ease:"power3.in" });
    gsap.to(imgOverlay, { backgroundColor:"rgba(20,0,50,0.62)", duration:0.5 });
  }, 1840);

  // ── Phase 5 (2440ms): SNAP SHUT ────────────────────────────────────────────
  setTimeout(() => {
    gsap.killTweensOf(S);
    gsap.to(S, { gap:0, topRot:0, botRot:0, duration:0.13, ease:"power4.in" });

    // Flash
    const fl = document.createElement("div");
    fl.style.cssText = "position:fixed;inset:0;background:#fff;opacity:0.85;pointer-events:none;z-index:2147483645;";
    document.body.appendChild(fl);
    gsap.to(fl, { opacity:0, duration:0.5, onComplete:()=>fl.remove() });

    // Shockwave rings
    const bsz = Math.max(imgRect.width, imgRect.height) * 0.72;
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement("div");
      const sz = bsz + i*62;
      ring.style.cssText = `position:fixed;left:${imgCX-sz/2}px;top:${imgCY-sz/2}px;
        width:${sz}px;height:${sz}px;border-radius:50%;pointer-events:none;
        border:${4-i}px solid rgba(167,139,250,${0.9-i*0.22});
        z-index:2147483645;transform:scale(0);`;
      document.body.appendChild(ring);
      gsap.to(ring, { scale:1, opacity:0, duration:0.7,
        delay:i*0.12, ease:"power1.out", onComplete:()=>ring.remove() });
    }

    // Screen shake
    gsap.to(cv, { keyframes:[
      { x:-11, y:8,  rotation:-0.6, duration:0.07 },
      { x:10,  y:-10,rotation:0.6,  duration:0.07 },
      { x:-7,  y:7,  rotation:-0.4, duration:0.07 },
      { x:7,   y:-4, rotation:0.3,  duration:0.07 },
      { x:-3,  y:2,  rotation:-0.1, duration:0.07 },
      { x:0,   y:0,  rotation:0,    duration:0.08 },
    ]});

    gsap.to(imgOverlay, { backgroundColor:"rgba(88,28,135,0.88)", duration:0.18 });
    gsap.to(imgEl, { scale:0.85, filter:"brightness(0.12) saturate(0) blur(3px)",
      duration:0.22, ease:"power3.in" });

    // Particles
    for (let i = 0; i < 44; i++) {
      const p = document.createElement("div");
      const isShard = i%4===0;
      const sz  = isShard ? 3+Math.random()*5 : 6+Math.random()*14;
      const szH = isShard ? sz*(3.5+Math.random()*4) : sz;
      const a   = (i/44)*Math.PI*2 + Math.random()*0.4;
      const d   = 80+Math.random()*160;
      const col = `hsl(${255+Math.random()*65},90%,${46+Math.random()*30}%)`;
      p.style.cssText = `position:fixed;left:${imgCX-sz/2}px;top:${imgCY-szH/2}px;
        width:${sz}px;height:${szH}px;border-radius:${isShard?2:50}%;
        background:${col};box-shadow:0 0 ${sz*1.6}px ${col};
        pointer-events:none;z-index:2147483645;transform-origin:50% 50%;`;
      document.body.appendChild(p);
      gsap.to(p, { x:Math.cos(a)*d, y:Math.sin(a)*d, scale:0, opacity:0,
        rotation:isShard?(Math.random()-0.5)*260:0,
        duration:0.7+Math.random()*0.55, ease:"power2.out",
        delay:Math.random()*0.1, onComplete:()=>p.remove() });
    }

    onReady();
  }, 2440);

  // ── Phase 6 (2740ms): RETREAT + CLEANUP ────────────────────────────────────
  setTimeout(() => {
    addBiteMarkSVG(imgRect);
    gsap.to(imgOverlay, { backgroundColor:"rgba(20,0,50,0)", duration:0.75, ease:"power1.out" });
    gsap.to(imgEl, { scale:1, filter:imgSavedFilter||"none", duration:0.75, ease:"back.out(1.6)",
      onComplete:() => {
        gsap.set(imgEl, { clearProps:"scale,filter" });
        imgEl.style.transition = imgSavedTrans;
        if (imgSavedTransf) imgEl.style.transform = imgSavedTransf;
        if (imgSavedFilter)  imgEl.style.filter   = imgSavedFilter;
      }
    });
    // Jaws fly apart as canvas fades
    gsap.to(S, { gap: window.innerHeight * 0.8, alpha:0, duration:0.45, ease:"power3.in" });

    setTimeout(() => {
      gsap.ticker.remove(draw);
      if (wrapEl) wrapEl.style.visibility = "visible";
      imgOverlay.remove();
      cv.remove();
    }, 500);
  }, 2740);
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

// â”€â”€â”€ Absorb: beam connects pill to image, colors drain into pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Beam: animated SVG path drawn from pill to image top â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Gradient along the beam (pill colour â†’ image anchor)
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

  // â”€â”€ Drain overlay: image copy with purple-grey filter sweeps topâ†’bottom â”€â”€â”€
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

  // â”€â”€ Energy particles: colored dots travel from image to pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        // Position via left/top only once, then animate purely with transform (GPU path)
        p.style.cssText = `position:fixed;left:${spX}px;top:${spY}px;
          width:${sz}px;height:${sz}px;border-radius:50%;
          background:${col};box-shadow:0 0 ${sz*1.6}px ${col};
          pointer-events:none;z-index:2147483645;will-change:transform,opacity;`;
        document.body.appendChild(p);
        const tx = pCX - sz/2 - spX;
        const ty = pCY - sz/2 - spY;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          p.style.transition = `transform ${dur}s ease-in, opacity ${dur}s ease-in`;
          p.style.transform  = `translate(${tx}px,${ty}px) scale(0.1)`;
          p.style.opacity    = "0";
        }));
        setTimeout(() => p.remove(), dur * 1000 + 200);
      }
    }, 48);
    setTimeout(() => clearInterval(pInt), 1020);
  }, 300);

  // â”€â”€ Pill absorption: expanding rings radiate outward as energy arrives â”€â”€â”€â”€â”€
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

  // â”€â”€ Full-charge burst from pill + open panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Cleanup: fade drain copy away, restore â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Wand: materializes, charges, casts lightning bolt, stamps rune circle â”€â”€â”€â”€
function playWandAnim(imgEl, onReady) {
  const imgRect = imgEl.getBoundingClientRect();
  if (imgRect.width < 20 || imgRect.height < 20) { onReady(); return; }

  const host   = document.getElementById("__scoutiq__");
  const wrapEl = host?.shadowRoot?.querySelector("#sq-wrap");
  const pR     = wrapEl?.getBoundingClientRect();
  const pCX    = pR ? pR.left + pR.width  / 2 : imgRect.left + imgRect.width  / 2;
  const pCY    = pR ? pR.top  + pR.height / 2 : imgRect.top  - 50;
  const imgCX  = imgRect.left + imgRect.width  / 2;
  const imgCY  = imgRect.top  + imgRect.height / 2;

  const stage = document.createElement("div");
  stage.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:2147483646;`;
  document.body.appendChild(stage);

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.style.cssText = `position:absolute;inset:0;width:100%;height:100%;overflow:visible;`;
  stage.appendChild(svg);

  const defs = document.createElementNS(ns, "defs");
  svg.appendChild(defs);

  function se(tag, attrs) {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }
  function filter(id, blur, x = "-50%", y = "-50%", w = "200%", h = "200%") {
    const f = se("filter", { id, x, y, width: w, height: h });
    const b = se("feGaussianBlur", { stdDeviation: blur, result: "b" });
    const m = se("feMerge", {});
    m.appendChild(se("feMergeNode", { in: "b" }));
    m.appendChild(se("feMergeNode", { in: "SourceGraphic" }));
    f.appendChild(b); f.appendChild(m); defs.appendChild(f);
  }
  filter("sq-w-glow",  "3");
  filter("sq-w-tip",   "5", "-150%", "-150%", "400%", "400%");
  filter("sq-w-bolt",  "2.5");
  filter("sq-w-rune",  "2");

  // Wand geometry: points from pill outward at angle toward image
  const ang      = Math.atan2(imgCY - pCY, imgCX - pCX);
  const perp     = ang + Math.PI / 2;
  const wandLen  = 95;
  const tipX = pCX + Math.cos(ang) * wandLen;
  const tipY = pCY + Math.sin(ang) * wandLen;
  const basX = pCX - Math.cos(ang) * 10;
  const basY = pCY - Math.sin(ang) * 10;

  // Wand gradient
  const wg = se("linearGradient", { id:"sq-wg", gradientUnits:"userSpaceOnUse",
    x1:basX, y1:basY, x2:tipX, y2:tipY });
  wg.appendChild(se("stop", { offset:"0%",   "stop-color":"#1a0530" }));
  wg.appendChild(se("stop", { offset:"55%",  "stop-color":"#4c1d95" }));
  wg.appendChild(se("stop", { offset:"100%", "stop-color":"#8b5cf6" }));
  defs.appendChild(wg);

  // â”€â”€ Wand shaft (tapered quad) + crystal tip star â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const bw = 7, tw2 = 2.5;
  const shaftPath =
    `M ${basX + Math.cos(perp)*bw/2} ${basY + Math.sin(perp)*bw/2}
     L ${tipX + Math.cos(perp)*tw2/2} ${tipY + Math.sin(perp)*tw2/2}
     L ${tipX - Math.cos(perp)*tw2/2} ${tipY - Math.sin(perp)*tw2/2}
     L ${basX - Math.cos(perp)*bw/2} ${basY - Math.sin(perp)*bw/2} Z`;

  const shaft = se("path", { d:shaftPath, fill:"url(#sq-wg)", filter:"url(#sq-w-glow)", opacity:"0" });
  shaft.style.cssText = "transition:opacity 0.22s ease;";
  svg.appendChild(shaft);

  // Knot rings along shaft
  [0.25, 0.5, 0.72].forEach(t => {
    const kx = basX + Math.cos(ang)*(wandLen + 10)*t;
    const ky = basY + Math.sin(ang)*(wandLen + 10)*t;
    const kr = (bw/2) * (1 - t * 0.5) + 1;
    const knot = se("ellipse", { cx:kx, cy:ky,
      rx: kr * 1.2, ry: kr * 0.7,
      fill:"#2e1065", stroke:"#6d28d9", "stroke-width":"0.8", opacity:"0" });
    knot.style.cssText = "transition:opacity 0.22s ease;";
    svg.appendChild(knot);
    setTimeout(() => { knot.style.opacity = "0.9"; }, 80);
  });

  // 4-point star crystal tip
  function starD(cx, cy, r, pts, inner) {
    let d = "";
    for (let i = 0; i < pts * 2; i++) {
      const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
      const ri = i % 2 === 0 ? r : r * inner;
      d += (i === 0 ? "M" : "L") + `${cx + Math.cos(a)*ri} ${cy + Math.sin(a)*ri}`;
    }
    return d + "Z";
  }
  const tipStar = se("path", { d: starD(tipX, tipY, 9, 4, 0.4),
    fill:"#ddd6fe", filter:"url(#sq-w-tip)", opacity:"0" });
  tipStar.style.cssText = "transition:opacity 0.2s ease;";
  svg.appendChild(tipStar);

  // Wand materializes
  setTimeout(() => { shaft.style.opacity = "1"; tipStar.style.opacity = "1"; }, 30);

  // â”€â”€ Charge phase: CSS orbital rings around tip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const chargeSty = document.createElement("style");
  chargeSty.textContent = `
    @keyframes sq-orbit { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes sq-orbit-ccw { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
    @keyframes sq-tip-pulse {
      0%,100%{filter:brightness(1)} 50%{filter:brightness(1.8) saturate(2)}
    }`;
  document.head.appendChild(chargeSty);

  // Spawn 3 orbital rings, each a different radius and speed
  const orbiters = [];
  [[18, "0.7s", "sq-orbit", "#c4b5fd"],
   [26, "1.1s", "sq-orbit-ccw", "#a78bfa"],
   [34, "0.9s", "sq-orbit", "#7c3aed"]].forEach(([r, spd, anim, col], i) => {
    const ring = document.createElement("div");
    ring.style.cssText = `position:fixed;left:${tipX}px;top:${tipY}px;
      width:${r*2}px;height:${r*2}px;
      margin-left:${-r}px;margin-top:${-r}px;
      border-radius:50%;
      border:1.5px solid ${col};
      box-shadow:0 0 6px ${col};
      pointer-events:none;z-index:2147483645;
      animation:${anim} ${spd} linear infinite;
      opacity:0;transition:opacity 0.3s;`;
    document.body.appendChild(ring);
    orbiters.push(ring);
    setTimeout(() => { ring.style.opacity = "0.75"; }, 350 + i * 80);

    // Spawn charged sparkles in each orbit
    const spawnOrbiter = () => {
      if (!ring.isConnected) return;
      const p = document.createElement("div");
      const sz = 3 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2;
      p.style.cssText = `position:fixed;
        left:${tipX + Math.cos(a)*r - sz/2}px;
        top:${tipY + Math.sin(a)*r - sz/2}px;
        width:${sz}px;height:${sz}px;border-radius:50%;
        background:${col};box-shadow:0 0 ${sz*2.5}px ${col};
        pointer-events:none;z-index:2147483645;
        transition:opacity 0.5s ease;`;
      document.body.appendChild(p);
      setTimeout(() => { p.style.opacity = "0"; }, 80);
      setTimeout(() => p.remove(), 600);
    };
    const sparkInt = setInterval(spawnOrbiter, 120 + i * 40);
    orbiters.push({ remove: () => clearInterval(sparkInt), isConnected: true });
  });

  // Tip pulse during charge
  tipStar.style.animation = "sq-tip-pulse 0.6s ease-in-out infinite";

  // â”€â”€ Cast: collapse orbiters, draw lightning bolt, impact â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setTimeout(() => {
    // Collapse all orbiters into tip (flash of energy)
    orbiters.forEach(o => {
      if (o.style) { o.style.transition = "all 0.18s ease-in"; o.style.transform = "scale(0)"; o.style.opacity = "0"; setTimeout(() => o.remove?.(), 200); }
      else o.remove?.();
    });
    tipStar.style.animation = "";
    tipStar.style.filter = "url(#sq-w-tip)";

    // Wind-up glow burst at tip
    const burst = se("circle", { cx:tipX, cy:tipY, r:"4", fill:"#fff", filter:"url(#sq-w-tip)", opacity:"1" });
    svg.appendChild(burst);
    burst.style.cssText = "transition:r 0.12s ease-out,opacity 0.12s ease;";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      burst.setAttribute("r", "24");
      burst.style.opacity = "0";
    }));
    setTimeout(() => burst.remove(), 200);

    // Lightning bolt (jagged multi-segment path)
    function jag(x1, y1, x2, y2, segs, spread) {
      const dx = x2 - x1, dy = y2 - y1;
      const d = Math.sqrt(dx*dx + dy*dy);
      const px = -dy/d, py = dx/d;
      let pts = [{x:x1, y:y1}];
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const off = (Math.random() - 0.5) * spread;
        pts.push({ x: x1+dx*t + px*off, y: y1+dy*t + py*off });
      }
      pts.push({x:x2, y:y2});
      return "M " + pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
    }

    const boltLen = Math.hypot(imgCX - tipX, imgCY - tipY) * 1.15;
    // Core bolt (bright white/lavender)
    const bolt1 = se("path", { d:jag(tipX,tipY,imgCX,imgCY,8,28),
      stroke:"#e9d5ff", "stroke-width":"2", fill:"none",
      "stroke-linecap":"round", "stroke-linejoin":"round",
      "stroke-dasharray":boltLen, "stroke-dashoffset":boltLen,
      filter:"url(#sq-w-bolt)" });
    svg.appendChild(bolt1);

    // Outer bolt (wider, violet)
    const bolt2 = se("path", { d:jag(tipX,tipY,imgCX,imgCY,6,40),
      stroke:"#7c3aed", "stroke-width":"4", fill:"none",
      "stroke-linecap":"round", "stroke-linejoin":"round",
      "stroke-dasharray":boltLen, "stroke-dashoffset":boltLen,
      filter:"url(#sq-w-bolt)", opacity:"0.7" });
    svg.insertBefore(bolt2, bolt1);

    bolt2.style.transition = "stroke-dashoffset 0.18s ease-out";
    bolt1.style.transition = "stroke-dashoffset 0.15s ease-out";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bolt2.setAttribute("stroke-dashoffset", "0");
      bolt1.setAttribute("stroke-dashoffset", "0");
    }));

    // Bolts fade after drawn
    setTimeout(() => {
      [bolt1, bolt2].forEach(b => { b.style.transition="opacity 0.35s ease"; b.style.opacity="0"; });
    }, 450);
  }, 1050);

  // â”€â”€ Impact: sparks + rotating rune circle on image â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setTimeout(() => {
    // Sparks explode from image center
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("div");
      const sz  = 4 + Math.random() * 9;
      const a   = (i/18)*Math.PI*2 + Math.random()*0.4;
      const dst = 35 + Math.random() * 90;
      const hue = 255 + Math.random() * 80;
      const col = `hsl(${hue},88%,72%)`;
      p.style.cssText = `position:fixed;left:${imgCX-sz/2}px;top:${imgCY-sz/2}px;
        width:${sz}px;height:${sz}px;border-radius:50%;
        background:${col};box-shadow:0 0 ${sz}px ${col};
        pointer-events:none;z-index:2147483645;will-change:transform,opacity;`;
      document.body.appendChild(p);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        p.style.transition = `transform ${0.38+Math.random()*0.3}s cubic-bezier(0,0,0.3,1),opacity ${0.38+Math.random()*0.3}s ease`;
        p.style.transform  = `translate(${Math.cos(a)*dst}px,${Math.sin(a)*dst}px) scale(0)`;
        p.style.opacity    = "0";
      }));
      setTimeout(() => p.remove(), 780);
    }

    // Rune circle SVG stamped on image
    const rr = Math.min(imgRect.width, imgRect.height) * 0.34;
    const rg = se("g", { filter:"url(#sq-w-rune)", opacity:"0" });
    rg.style.cssText = "transition:opacity 0.3s ease;transform-box:fill-box;";
    rg.appendChild(se("circle", { cx:imgCX,cy:imgCY,r:rr, fill:"none", stroke:"#a78bfa","stroke-width":"1.5" }));
    rg.appendChild(se("circle", { cx:imgCX,cy:imgCY,r:rr*0.68, fill:"none", stroke:"#7c3aed","stroke-width":"1","stroke-dasharray":"5 7" }));
    rg.appendChild(se("circle", { cx:imgCX,cy:imgCY,r:rr*0.35, fill:"rgba(109,40,217,0.12)",stroke:"#c4b5fd","stroke-width":"0.8" }));
    const syms = ["âœ¦","â—ˆ","â¬¡","â˜…","â—†","âœ§"];
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2 - Math.PI/2;
      const lx1 = imgCX + Math.cos(a)*rr*0.36, ly1 = imgCY + Math.sin(a)*rr*0.36;
      const lx2 = imgCX + Math.cos(a)*rr*0.95, ly2 = imgCY + Math.sin(a)*rr*0.95;
      rg.appendChild(se("line", { x1:lx1,y1:ly1,x2:lx2,y2:ly2,stroke:"#6d28d9","stroke-width":"0.8",opacity:"0.7" }));
      const tx = document.createElementNS(ns, "text");
      Object.entries({ x:imgCX+Math.cos(a)*rr*0.65, y:imgCY+Math.sin(a)*rr*0.65+3.5,
        "text-anchor":"middle","dominant-baseline":"middle",
        fill:"#c4b5fd","font-size":"10",opacity:"0.85" }).forEach(([k,v]) => tx.setAttribute(k,v));
      tx.textContent = syms[i];
      rg.appendChild(tx);
    }
    svg.appendChild(rg);
    requestAnimationFrame(() => requestAnimationFrame(() => { rg.style.opacity = "1"; }));

    // Spin rune circle with rAF
    let rot = 0;
    const spin = () => {
      rot += 0.45;
      rg.style.transform = `rotate(${rot}deg)`;
      rg.style.transformOrigin = `${imgCX}px ${imgCY}px`;
      if (rot < 108) requestAnimationFrame(spin);
      else {
        rg.style.transition = "opacity 0.6s ease";
        rg.style.opacity = "0";
        setTimeout(() => rg.remove(), 700);
      }
    };
    requestAnimationFrame(spin);

    onReady();
  }, 1280);

  // â”€â”€ Wand fades out â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setTimeout(() => {
    [shaft, tipStar].forEach(el => { el.style.opacity = "0"; });
    chargeSty.remove();
    setTimeout(() => stage.remove(), 600);
  }, 1600);
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

  if (_readImgStyle === "wand") {
    playWandAnim(imgEl, onReady);
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

// â”€â”€â”€ Movement trail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _lastTrailTime = 0;
function emitTrail(x, y) {
  if (_trailStyle === "none") return;
  const now = Date.now();
  const interval = _trailStyle === "comet" ? 20 : _trailStyle === "burst" ? 45 : 35;
  if (now - _lastTrailTime < interval) return;
  _lastTrailTime = now;

  if (_trailStyle === "dots") {
    // Bold Pac-Man style dots â€” large, immediate fade
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
    const chars = ["âœ¦","âœ§","â˜…","â—†","â¬Ÿ","âœº"];
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
    // Dense fast-fading orbs â€” classic comet tail
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
    // Explosive burst of particles at each point â€” very visible
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

function startReadingAnim() {} // kept for compat â€” now handled by playImageReadAnim
function stopReadingAnim() {}  // image overlays self-remove via setTimeout

// â”€â”€â”€ Animations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function applyPillAnimation(style) {
  const pill = $("sq-pill");
  if (!pill) return;
  pill.classList.remove("sq-anim-pop", "sq-anim-glow", "sq-anim-breathe");
  if (style === "none") return;

  if (style === "breathe") {
    pill.classList.add("sq-anim-breathe");
    return;
  }

  // "pop" â€” spring entrance, then glow pulse once finished
  pill.classList.add("sq-anim-pop");
  pill.addEventListener("animationend", () => {
    pill.classList.remove("sq-anim-pop");
    pill.classList.add("sq-anim-glow");
    pill.addEventListener("animationend", () => {
      pill.classList.remove("sq-anim-glow");
    }, { once: true });
  }, { once: true });
}

// â”€â”€â”€ Inject panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Stored product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function loadStoredProduct() {
  return new Promise(r => chrome.storage.local.get(["sq_last_product"], d => r(d.sq_last_product || null)));
}
function saveStoredProduct(product) {
  if (product) chrome.storage.local.set({ sq_last_product: product });
  else chrome.storage.local.remove("sq_last_product");
}

// â”€â”€â”€ Pill state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function pillOff(saveState = false) {
  productInfo = null;
  compareResults = [];
  const host = document.getElementById("__scoutiq__");
  if (host) host.remove();
  shadow = null;
  injected = false;
  if (saveState) chrome.storage.local.set({ sq_pill_active: false });
  chrome.runtime.sendMessage({ type: "sq_pill_state", active: false }).catch(() => {});
}

async function pillOn(saveState = false) {
  console.log("[SQ content] pillOn called, injected:", injected);
  if (injected) return;
  session = await loadSession();
  console.log("[SQ content] calling inject, session:", !!session);
  inject(null);
  if (saveState) chrome.storage.local.set({ sq_pill_active: true });
  chrome.runtime.sendMessage({ type: "sq_pill_state", active: true }).catch(() => {});
}

// Boot: runs once per real page load â€” check both explicit state and auto-detect
async function boot() {
  if (injected) return;
  const data = await chrome.storage.local.get(["sq_pill_active", "sq_auto_open"]);
  if (data.sq_pill_active) { await pillOn(); return; }
  if (data.sq_auto_open === false) return;
  if (!isProductPage()) return;
  await pillOn();
}

// SPA navigation â€” hide pill on URL change, re-run boot after page settles
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

// Cross-tab sync â€” react immediately when pill state changes in another tab
if (!window.__sq_storage_listener) {
  window.__sq_storage_listener = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("sq_pill_active" in changes)) return;
    const active = changes.sq_pill_active.newValue;
    if (active && !injected) pillOn();
    else if (!active && injected) pillOff();
  });
}

// Icon click toggle â€” saves state so all tabs stay in sync
window.__sq_toggle = async (on) => {
  if (on) await pillOn(true);
  else pillOff(true);
};

// Message listener for icon-click toggle from background.js (registered once per page)
if (!window.__sq_msg_listener) {
  window.__sq_msg_listener = true;
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "sq_toggle") {
      const isOn = !!document.getElementById("__scoutiq__");
      console.log("[SQ content] sq_toggle received, isOn:", isOn, "injected:", injected, "__sq_toggle:", typeof window.__sq_toggle);
      if (window.__sq_toggle) window.__sq_toggle(!isOn);
      sendResponse({ ok: true });
      return true;
    }
  });
}

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
    d.textContent = "âš¡ ScoutIQ init error: " + e.message;
    document.body.appendChild(d);
  };
}
})();
