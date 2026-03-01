/**
 * browser.ts — Playwright CDP connection + all browser JS extractors.
 *
 * Extractors are raw ES5 strings evaluated inside the browser page.
 * They walk the DOM, scroll to load content, and return JSON.
 */

import { chromium, type BrowserContext, type Page } from "playwright";

const CDP_PORT = Number(process.env.CDP_PORT) || 18800;

export async function connectBrowser(): Promise<{
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}> {
  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  } catch {
    console.error(`Failed to connect to browser on CDP port ${CDP_PORT}.`);
    console.error(`Make sure your browser is open with remote debugging enabled.`);
    process.exit(1);
  }

  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error("No browser contexts found. Is the browser open?");
    process.exit(1);
  }

  const context = contexts[0];
  const page = await context.newPage();

  return {
    context,
    page,
    close: async () => {
      await page.close();
    },
  };
}

export async function verifyLinkedInLogin(page: Page): Promise<void> {
  console.log("Checking LinkedIn login...");
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(3000);

  const pageUrl = page.url();
  const pageTitle = await page.title();

  if (
    pageUrl.includes("/login") ||
    pageUrl.includes("/authwall") ||
    pageTitle.toLowerCase().includes("log in") ||
    pageTitle.toLowerCase().includes("sign in")
  ) {
    console.error("\nLinkedIn session expired! Log in manually, then re-run.");
    await page.close();
    process.exit(1);
  }

  console.log(`Logged in. Page: "${pageTitle}"\n`);
}

// ───── Content Search (regular LinkedIn) ─────

export const CONTENT_SCROLL_AND_EXTRACT = `async () => {
  var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  var getHeight = function() { return document.documentElement.scrollHeight; };

  var prevHeight = 0;
  var scrollCount = 0;
  var maxScrolls = 4;

  while (scrollCount < maxScrolls) {
    prevHeight = getHeight();
    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(2500);
    if (getHeight() === prevHeight) break;
    scrollCount++;
  }

  window.scrollTo(0, 0);
  await delay(500);

  var seeMoreBtns = document.querySelectorAll("button");
  var clicked = 0;
  for (var s = 0; s < seeMoreBtns.length; s++) {
    var btnText = (seeMoreBtns[s].innerText || "").trim().toLowerCase();
    if (btnText === "\\u2026see more" || btnText === "...more" || btnText === "see more" || btnText === "\\u2026more" || btnText === "...see more") {
      try { seeMoreBtns[s].click(); clicked++; } catch(e) {}
    }
  }
  if (clicked > 0) await delay(1500);

  var results = [];
  var seen = {};

  var profileLinks = document.querySelectorAll('a[href*="/in/"]');

  for (var i = 0; i < profileLinks.length; i++) {
    var link = profileLinks[i];
    var href = link.getAttribute("href") || "";
    if (href.indexOf("/in/") === -1) continue;

    var profileUrl = href.split("?")[0];
    if (seen[profileUrl]) continue;
    seen[profileUrl] = true;

    var card = link;
    for (var j = 0; j < 8; j++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      var text = card.innerText || "";
      if (text.length > 100 && card.offsetHeight > 100) break;
    }

    var cardText = (card.innerText || "").trim();
    if (cardText.length < 50) continue;

    var cardLinks = [];
    var anchors = card.querySelectorAll("a[href]");
    for (var k = 0; k < anchors.length; k++) {
      var h = anchors[k].getAttribute("href") || "";
      var t = (anchors[k].innerText || "").trim();
      if (t && h && h.indexOf("javascript") !== 0) {
        cardLinks.push({ text: t.slice(0, 100), href: h.split("?")[0] });
      }
    }

    results.push({
      profileUrl: profileUrl,
      cardText: cardText.slice(0, 3000),
      links: cardLinks.slice(0, 10)
    });
  }

  return JSON.stringify({
    blocks: results,
    scrolls: scrollCount,
    total: results.length
  });
}`;

// ───── Sales Navigator People Search ─────

export const SALESNAV_SCROLL_AND_EXTRACT = `async () => {
  var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  var getHeight = function() { return document.documentElement.scrollHeight; };

  var prevHeight = 0;
  var scrollCount = 0;
  var maxScrolls = 4;

  while (scrollCount < maxScrolls) {
    prevHeight = getHeight();
    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(2500);
    if (getHeight() === prevHeight) break;
    scrollCount++;
  }

  window.scrollTo(0, 0);
  await delay(500);

  var results = [];
  var seen = {};

  var leadLinks = document.querySelectorAll('a[href*="/sales/lead/"], a[href*="/sales/people/"]');
  if (leadLinks.length === 0) {
    leadLinks = document.querySelectorAll('a[href*="/in/"]');
  }

  for (var i = 0; i < leadLinks.length; i++) {
    var link = leadLinks[i];
    var href = link.getAttribute("href") || "";

    var profileUrl = href.split("?")[0];
    if (seen[profileUrl]) continue;
    seen[profileUrl] = true;

    var card = link;
    for (var j = 0; j < 8; j++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      var text = card.innerText || "";
      if (text.length > 100 && card.offsetHeight > 100) break;
    }

    var cardText = (card.innerText || "").trim();
    if (cardText.length < 50) continue;

    var cardLinks = [];
    var anchors = card.querySelectorAll("a[href]");
    for (var k = 0; k < anchors.length; k++) {
      var h = anchors[k].getAttribute("href") || "";
      var t = (anchors[k].innerText || "").trim();
      if (t && h && h.indexOf("javascript") !== 0) {
        cardLinks.push({ text: t.slice(0, 100), href: h.split("?")[0] });
      }
    }

    results.push({
      profileUrl: profileUrl,
      cardText: cardText.slice(0, 3000),
      links: cardLinks.slice(0, 10)
    });
  }

  return JSON.stringify({
    blocks: results,
    scrolls: scrollCount,
    total: results.length
  });
}`;

// ───── Job Search JS Extractors (with configurable scroll depth) ─────

export function buildContentExtractJs(maxScrolls: number): string {
  return `async () => {
  var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  var getHeight = function() { return document.documentElement.scrollHeight; };

  var prevHeight = 0;
  var scrollCount = 0;
  var maxScrolls = ${maxScrolls};

  while (scrollCount < maxScrolls) {
    prevHeight = getHeight();
    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(2500);
    if (getHeight() === prevHeight) break;
    scrollCount++;
  }

  window.scrollTo(0, 0);
  await delay(500);

  var results = [];
  var seen = {};

  var profileLinks = document.querySelectorAll('a[href*="/in/"]');

  for (var i = 0; i < profileLinks.length; i++) {
    var link = profileLinks[i];
    var href = link.getAttribute("href") || "";
    if (href.indexOf("/in/") === -1) continue;

    var profileUrl = href.split("?")[0];
    if (seen[profileUrl]) continue;
    seen[profileUrl] = true;

    var card = link;
    for (var j = 0; j < 8; j++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      var text = card.innerText || "";
      if (text.length > 100 && card.offsetHeight > 100) break;
    }

    var cardText = (card.innerText || "").trim();
    if (cardText.length < 50) continue;

    var cardLinks = [];
    var anchors = card.querySelectorAll("a[href]");
    for (var k = 0; k < anchors.length; k++) {
      var h = anchors[k].getAttribute("href") || "";
      var t = (anchors[k].innerText || "").trim();
      if (t && h && h.indexOf("javascript") !== 0) {
        cardLinks.push({ text: t.slice(0, 100), href: h.split("?")[0] });
      }
    }

    results.push({
      profileUrl: profileUrl,
      cardText: cardText.slice(0, 2000),
      links: cardLinks.slice(0, 10)
    });
  }

  return JSON.stringify({
    blocks: results,
    scrolls: scrollCount,
    total: results.length
  });
}`;
}

export function buildJobsExtractJs(maxScrolls: number): string {
  return `async () => {
  var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

  var jobsList = document.querySelector('.jobs-search-results-list') ||
                 document.querySelector('.scaffold-layout__list') ||
                 document.querySelector('[class*="jobs-search"]') ||
                 document.documentElement;

  var prevHeight = 0;
  var scrollCount = 0;
  var maxScrolls = ${maxScrolls};

  while (scrollCount < maxScrolls) {
    prevHeight = jobsList.scrollHeight;
    jobsList.scrollTo(0, jobsList.scrollHeight);
    await delay(2000);
    if (jobsList.scrollHeight === prevHeight) break;
    scrollCount++;
  }

  jobsList.scrollTo(0, 0);
  await delay(500);

  var results = [];
  var seen = {};

  var jobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');

  for (var i = 0; i < jobLinks.length; i++) {
    var link = jobLinks[i];
    var href = link.getAttribute("href") || "";
    var jobUrl = href.split("?")[0];

    if (seen[jobUrl]) continue;
    seen[jobUrl] = true;

    var card = link;
    for (var j = 0; j < 8; j++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      var text = card.innerText || "";
      if (text.length > 60 && card.offsetHeight > 60) break;
    }

    var cardText = (card.innerText || "").trim();
    if (cardText.length < 30) continue;

    var cardLinks = [];
    var anchors = card.querySelectorAll("a[href]");
    for (var k = 0; k < anchors.length; k++) {
      var h = anchors[k].getAttribute("href") || "";
      var t = (anchors[k].innerText || "").trim();
      if (t && h && h.indexOf("javascript") !== 0) {
        cardLinks.push({ text: t.slice(0, 100), href: h.split("?")[0] });
      }
    }

    results.push({
      jobUrl: jobUrl,
      cardText: cardText.slice(0, 2000),
      links: cardLinks.slice(0, 10)
    });
  }

  return JSON.stringify({
    blocks: results,
    scrolls: scrollCount,
    total: results.length
  });
}`;
}

export function buildNaukriExtractJs(maxScrolls: number): string {
  return `async () => {
  var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  var getHeight = function() { return document.documentElement.scrollHeight; };

  var prevHeight = 0;
  var scrollCount = 0;
  var maxScrolls = ${maxScrolls};

  while (scrollCount < maxScrolls) {
    prevHeight = getHeight();
    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(2000);
    if (getHeight() === prevHeight) break;
    scrollCount++;
  }

  window.scrollTo(0, 0);
  await delay(500);

  var results = [];
  var seen = {};

  var jobCards = document.querySelectorAll('.srp-jobtuple-wrapper, .jobTuple, article.jobTuple, .cust-job-tuple, [class*="jobTuple"]');
  if (jobCards.length === 0) {
    jobCards = document.querySelectorAll('a[href*="/job-listings-"]');
  }

  for (var i = 0; i < jobCards.length; i++) {
    var card = jobCards[i];
    var cardText = (card.innerText || "").trim();
    if (cardText.length < 30) continue;

    var jobLink = card.querySelector('a[href*="/job-listings-"]') || card.closest('a[href*="/job-listings-"]');
    var jobUrl = jobLink ? (jobLink.getAttribute("href") || "").split("?")[0] : "";
    if (!jobUrl) {
      var anyLink = card.querySelector('a.title, a[class*="title"]');
      if (anyLink) jobUrl = (anyLink.getAttribute("href") || "").split("?")[0];
    }

    var dedupKey = jobUrl || cardText.slice(0, 100);
    if (seen[dedupKey]) continue;
    seen[dedupKey] = true;

    var cardLinks = [];
    var anchors = card.querySelectorAll("a[href]");
    for (var k = 0; k < anchors.length; k++) {
      var h = anchors[k].getAttribute("href") || "";
      var t = (anchors[k].innerText || "").trim();
      if (t && h && h.indexOf("javascript") !== 0) {
        cardLinks.push({ text: t.slice(0, 100), href: h.split("?")[0] });
      }
    }

    results.push({
      jobUrl: jobUrl,
      cardText: cardText.slice(0, 2000),
      links: cardLinks.slice(0, 10)
    });
  }

  return JSON.stringify({
    blocks: results,
    scrolls: scrollCount,
    total: results.length
  });
}`;
}

export function buildHiristExtractJs(maxScrolls: number): string {
  return `async () => {
  var delay = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  var getHeight = function() { return document.documentElement.scrollHeight; };

  var prevHeight = 0;
  var scrollCount = 0;
  var maxScrolls = ${maxScrolls};

  while (scrollCount < maxScrolls) {
    prevHeight = getHeight();
    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(2000);
    if (getHeight() === prevHeight) break;
    scrollCount++;
  }

  window.scrollTo(0, 0);
  await delay(500);

  var results = [];
  var seen = {};

  var jobCards = document.querySelectorAll('.job-card, .jobCard, [class*="job-card"], [class*="jobCard"], .vacancy');
  if (jobCards.length === 0) {
    jobCards = document.querySelectorAll('a[href*="/j/"]');
  }

  for (var i = 0; i < jobCards.length; i++) {
    var card = jobCards[i];
    var cardText = (card.innerText || "").trim();
    if (cardText.length < 30) continue;

    var jobLink = card.querySelector('a[href*="/j/"]') || card.closest('a');
    var jobUrl = jobLink ? (jobLink.getAttribute("href") || "").split("?")[0] : "";

    var dedupKey = jobUrl || cardText.slice(0, 100);
    if (seen[dedupKey]) continue;
    seen[dedupKey] = true;

    var cardLinks = [];
    var anchors = card.querySelectorAll("a[href]");
    for (var k = 0; k < anchors.length; k++) {
      var h = anchors[k].getAttribute("href") || "";
      var t = (anchors[k].innerText || "").trim();
      if (t && h && h.indexOf("javascript") !== 0) {
        cardLinks.push({ text: t.slice(0, 100), href: h.split("?")[0] });
      }
    }

    results.push({
      jobUrl: jobUrl,
      cardText: cardText.slice(0, 2000),
      links: cardLinks.slice(0, 10)
    });
  }

  return JSON.stringify({
    blocks: results,
    scrolls: scrollCount,
    total: results.length
  });
}`;
}

// ───── URL builders ─────

export function buildContentSearchUrl(keyword: string): string {
  return `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&sortBy=date_posted`;
}

export function buildSalesNavSearchUrl(keyword: string): string {
  return `https://www.linkedin.com/sales/search/people?query=(keywords%3A${encodeURIComponent(keyword)})`;
}

export function buildJobsSearchUrl(keyword: string, filters?: { date_posted?: string; experience_level?: string; remote?: boolean }): string {
  let url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}`;
  if (filters?.date_posted === "past_week") url += "&f_TPR=r604800";
  if (filters?.experience_level === "senior") url += "&f_E=4";
  if (filters?.remote) url += "&f_WT=2";
  return url;
}

export function buildNaukriSearchUrl(keyword: string, filters?: { experience?: string; sort_by?: string }): string {
  const exp = filters?.experience || "5-15";
  let url = `https://www.naukri.com/${encodeURIComponent(keyword.toLowerCase().replace(/\s+/g, "-"))}-jobs?k=${encodeURIComponent(keyword)}&experience=${exp}`;
  if (filters?.sort_by === "date") url += "&sortBy=date";
  return url;
}

export function buildHiristSearchUrl(keyword: string): string {
  if (keyword.startsWith("http")) return keyword;
  return `https://www.hirist.tech/c/${keyword}`;
}

// ───── Search job types ─────

export interface SearchJob {
  keyword: string;
  mode: "content" | "sales_nav" | "jobs" | "naukri" | "hirist";
  url: string;
  extractJs: string;
}
