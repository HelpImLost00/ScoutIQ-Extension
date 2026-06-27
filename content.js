// Extracts product info from the current retailer page
(function () {
  function getMetaContent(property) {
    const el =
      document.querySelector(`meta[property="${property}"]`) ||
      document.querySelector(`meta[name="${property}"]`);
    return el ? el.getAttribute("content") : null;
  }

  function extractProductInfo() {
    const host = location.hostname.replace("www.", "");
    let name = null;
    let price = null;
    let image = null;

    if (host.includes("amazon")) {
      name =
        document.getElementById("productTitle")?.textContent?.trim() ||
        document.querySelector("h1.a-size-large")?.textContent?.trim();
      price =
        document.querySelector(".a-price .a-offscreen")?.textContent?.trim() ||
        document.querySelector("#priceblock_ourprice")?.textContent?.trim() ||
        document.querySelector("#priceblock_dealprice")?.textContent?.trim();
      image =
        document.getElementById("landingImage")?.getAttribute("src") ||
        document.getElementById("imgBlkFront")?.getAttribute("src");
    } else if (host.includes("walmart")) {
      name =
        document.querySelector('[itemprop="name"]')?.textContent?.trim() ||
        document.querySelector("h1.prod-ProductTitle")?.textContent?.trim() ||
        document.querySelector("h1[class*='ProductTitle']")?.textContent?.trim();
      price =
        document.querySelector('[itemprop="price"]')?.getAttribute("content") ||
        document.querySelector("[class*='price-characteristic']")?.textContent?.trim();
      image = document.querySelector('[data-testid="hero-image"] img')?.getAttribute("src");
    } else if (host.includes("bestbuy")) {
      name =
        document.querySelector("h1.sku-title")?.textContent?.trim() ||
        document.querySelector("[class*='heading-5']")?.textContent?.trim();
      price = document.querySelector(".priceView-hero-price span")?.textContent?.trim();
      image = document.querySelector(".primary-image")?.getAttribute("src");
    } else if (host.includes("target")) {
      name =
        document.querySelector('[data-test="product-title"]')?.textContent?.trim() ||
        document.querySelector("h1[class*='ProductTitle']")?.textContent?.trim();
      price = document.querySelector("[data-test='product-price']")?.textContent?.trim();
      image = document.querySelector("[data-test='product-image']")?.getAttribute("src");
    } else if (host.includes("ebay")) {
      name =
        document.querySelector("h1.x-item-title__mainTitle")?.textContent?.trim() ||
        document.querySelector("#itemTitle")?.textContent?.replace("Details about", "").trim();
      price =
        document.querySelector(".x-price-primary .ux-textspans")?.textContent?.trim() ||
        document.querySelector("#prcIsum")?.textContent?.trim();
      image = document.querySelector("#icImg")?.getAttribute("src");
    } else if (host.includes("newegg")) {
      name = document.querySelector(".product-title")?.textContent?.trim();
      price = document.querySelector(".price-current strong")?.textContent?.trim();
      image = document.querySelector(".product-view-img-original img")?.getAttribute("src");
    }

    // Fallback to og: meta tags
    name = name || getMetaContent("og:title") || document.title;
    image = image || getMetaContent("og:image");

    // Clean up name — strip store name suffixes
    if (name) {
      name = name
        .replace(/\s*[\|–\-]\s*(Amazon|Walmart|Best Buy|Target|eBay|Newegg|Costco).*$/i, "")
        .replace(/\s*:\s*Amazon\.com.*$/i, "")
        .trim()
        .slice(0, 200);
    }

    return { name, price, image, url: location.href, host };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "GET_PRODUCT_INFO") {
      sendResponse(extractProductInfo());
    }
    return true;
  });
})();
