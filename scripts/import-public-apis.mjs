/**
 * Script to import, normalize, categorize, and deduplicate public OpenAPI specs
 * (from APIs.guru, Public-APIs, and custom game connectors) into INGR's unified connector catalog.
 *
 * Usage:
 *   node scripts/import-public-apis.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(REPO_ROOT, "web/lib/pieces-catalog.json");

function normalizeKey(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchWithRetry(url, fallbackPath) {
  if (fallbackPath && fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath, "utf8");
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return await res.text();
}

const FLAGSHIP_GAMING = [
  {
    name: "custom-supercell-clash-of-clans",
    displayName: "Clash of Clans (Supercell API)",
    description: "Official Supercell API for live clan wars, player statistics, league rankings, clan search, and war log automation.",
    logoUrl: "https://cdn.iconscout.com/icon/free/png-256/free-clash-of-clans-1868972-1583134.png",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-supercell-clash-royale",
    displayName: "Clash Royale (Supercell API)",
    description: "Official Supercell API for card collections, upcoming chest cycles, battle log history, and clan tournament telemetry.",
    logoUrl: "https://cdn.iconscout.com/icon/free/png-256/free-clash-royale-1868973-1583135.png",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-supercell-brawl-stars",
    displayName: "Brawl Stars (Supercell API)",
    description: "Official Supercell API for brawlers, battle logs, club rankings, power league stats, and event rotations.",
    logoUrl: "https://cdn.iconscout.com/icon/free/png-256/free-brawl-stars-2831818-2350720.png",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-chess-com",
    displayName: "Chess.com Public API",
    description: "Official open REST API for player Blitz/Rapid ratings, game PGN archives, daily puzzles, leaderboards, and titled streamers.",
    logoUrl: "https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/SamCopeland/phpmeXx6V.png",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-lichess",
    displayName: "Lichess Open Gaming API",
    description: "Free open-source chess platform API for real-time bot play, TV game broadcasts, puzzles, and tournament webhooks.",
    logoUrl: "https://lichess1.org/assets/logo/lichess-favicon-512.png",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-fortnite-api",
    displayName: "Fortnite Cloud API & Item Shop",
    description: "Real-time daily Item Shop rotations, battle pass progress, cosmetics database, weapon stats, and map telemetry.",
    logoUrl: "https://fortnite-api.com/favicon.ico",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-minecraft-mojang",
    displayName: "Minecraft (Mojang & Server RCON)",
    description: "Player profile lookups, skin/cape assets, server ping telemetry, and remote RCON command execution for world automation.",
    logoUrl: "https://www.minecraft.net/etc.clientlibs/minecraft/clientlibs/main/resources/favicon.ico",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-hypixel-api",
    displayName: "Hypixel Minecraft Network API",
    description: "Skyblock auctions, bazaar prices, player bedwars/skywars telemetry, guild leaderboards, and network status.",
    logoUrl: "https://hypixel.net/favicon-32x32.png",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-riot-games",
    displayName: "Riot Games (Valorant & LoL API)",
    description: "Official developer portal API for live match telemetry, ranked tier progress, champion/agent statistics, and esports schedules.",
    logoUrl: "https://developer.riotgames.com/static/img/favicon.png",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-steam-api",
    displayName: "Steam & Valve Web API",
    description: "Player inventory, Community Market price monitoring, player achievements, game library telemetry, and VAC status.",
    logoUrl: "https://store.cloudflare.steamstatic.com/public/shared/images/responsive/share_steam_logo.png",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
  {
    name: "custom-roblox-open-cloud",
    displayName: "Roblox Open Cloud API",
    description: "Experience datastores, place publishing, group management, asset delivery, and universe messaging triggers.",
    logoUrl: "https://images.rbxcdn.com/2342137bc7d05130f76e6f1fa70b1348.ico",
    version: "1.0.0",
    category: "Gaming & Esports",
  },
];

async function main() {
  console.log("► Loading base pieces catalog from:", CATALOG_PATH);
  const existing = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  console.log(`  Found ${existing.length} existing connectors in catalog.`);

  const seen = new Set();
  const combined = [];

  // 1. Add Flagship Gaming connectors first
  for (const piece of FLAGSHIP_GAMING) {
    const norm = normalizeKey(piece.displayName);
    seen.add(norm);
    combined.push(piece);
  }

  // 2. Existing connectors
  for (const piece of existing) {
    const norm = normalizeKey(piece.displayName);
    if (!seen.has(norm)) {
      seen.add(norm);
      let cat = piece.category || "Productivity";
      const text = (piece.displayName + " " + piece.description).toLowerCase();
      if (
        text.includes("game") ||
        text.includes("gaming") ||
        text.includes("esport") ||
        text.includes("chess") ||
        text.includes("steam") ||
        text.includes("pokemon") ||
        text.includes("minecraft") ||
        text.includes("supercell") ||
        text.includes("roblox") ||
        text.includes("valorant")
      ) {
        cat = "Gaming & Esports";
      }
      combined.push({
        name: piece.name,
        displayName: piece.displayName,
        description: piece.description,
        logoUrl: piece.logoUrl || null,
        version: piece.version || "1.0.0",
        category: cat,
      });
    }
  }

  // 3. APIs.guru list
  console.log("► Fetching APIs.guru OpenAPI directory...");
  let apisGuruText;
  try {
    apisGuruText = await fetchWithRetry(
      "https://api.apis.guru/v2/list.json",
      "/tmp/apisguru.json"
    );
  } catch (err) {
    console.warn("  Could not fetch live APIs.guru, checking /tmp/apisguru.json", err.message);
    apisGuruText = fs.readFileSync("/tmp/apisguru.json", "utf8");
  }
  const apisGuru = JSON.parse(apisGuruText);

  const categoryMapGuru = {
    machine_learning: "AI & Machine Learning",
    text: "AI & Machine Learning",
    search: "Productivity",
    social: "Social & Creators",
    media: "Social & Creators",
    entertainment: "Social & Creators",
    messaging: "Communication",
    email: "Communication",
    telecom: "Communication",
    collaboration: "Communication",
    cloud: "Developer & Cloud",
    developer_tools: "Developer & Cloud",
    hosting: "Developer & Cloud",
    backend: "Developer & Cloud",
    security: "Developer & Cloud",
    iot: "Developer & Cloud",
    monitoring: "Developer & Cloud",
    storage: "Databases & Storage",
    open_data: "Databases & Storage",
    financial: "Business & Finance",
    payment: "Business & Finance",
    ecommerce: "Business & Finance",
    enterprise: "Business & Finance",
    marketing: "Business & Finance",
    analytics: "Business & Finance",
    customer_relation: "Business & Finance",
    tools: "Productivity",
    time_management: "Productivity",
    project_management: "Productivity",
    forms: "Productivity",
    support: "Productivity",
    education: "Productivity",
    transport: "Productivity",
    location: "Productivity",
  };

  let apisGuruAdded = 0;
  for (const [key, item] of Object.entries(apisGuru)) {
    const pref = item.preferred;
    const info = item.versions[pref]?.info || {};
    let title = (info.title || key).replace(/\s*API(s)?$/i, "").trim();
    if (!title || title.length < 2) continue;

    const norm = normalizeKey(title);
    if (seen.has(norm)) continue;
    seen.add(norm);

    const rawCats = info["x-apisguru-categories"] || [];
    let category = "Developer & Cloud";
    for (const c of rawCats) {
      if (categoryMapGuru[c]) {
        category = categoryMapGuru[c];
        break;
      }
    }

    const titleLower = title.toLowerCase();
    const descLower = (info.description || "").toLowerCase();
    const fullText = titleLower + " " + descLower;

    if (
      fullText.includes("game") ||
      fullText.includes("gaming") ||
      fullText.includes("esport") ||
      fullText.includes("chess") ||
      fullText.includes("steam") ||
      fullText.includes("pokemon") ||
      fullText.includes("minecraft")
    ) {
      category = "Gaming & Esports";
    } else if (
      titleLower.includes("3d") ||
      titleLower.includes("photo") ||
      titleLower.includes("render") ||
      titleLower.includes("graphic") ||
      titleLower.includes("design") ||
      titleLower.includes("art") ||
      descLower.includes("vector") ||
      descLower.includes("render 3d")
    ) {
      category = "Creative & 3D Design";
    }

    let logoUrl = info["x-logo"]?.url || null;
    if (logoUrl && (logoUrl.includes("no-logo.svg") || !logoUrl.startsWith("http"))) {
      logoUrl = null;
    }

    let cleanDesc = (info.description || `OpenAPI integration for ${title}`)
      .replace(/<[^>]*>?/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanDesc.length > 250) {
      cleanDesc = cleanDesc.slice(0, 247) + "...";
    }

    combined.push({
      name: `openapi-${key.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}`,
      displayName: title,
      description: cleanDesc,
      logoUrl,
      version: info.version || "1.0.0",
      category,
    });
    apisGuruAdded++;
  }
  console.log(`  Added ${apisGuruAdded} OpenAPI connectors from APIs.guru.`);

  // 4. Public-APIs directory
  console.log("► Fetching Public-APIs directory...");
  let publicApisMd;
  try {
    publicApisMd = await fetchWithRetry(
      "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md",
      "/tmp/public-apis.md"
    );
  } catch (err) {
    console.warn("  Could not fetch live public-apis README, checking /tmp/public-apis.md", err.message);
    publicApisMd = fs.readFileSync("/tmp/public-apis.md", "utf8");
  }

  const sectionMap = {
    animals: "Social & Creators",
    anime: "Social & Creators",
    "anti-malware": "Developer & Cloud",
    "art & design": "Creative & 3D Design",
    "authentication & authorization": "Developer & Cloud",
    blockchain: "Business & Finance",
    books: "Productivity",
    business: "Business & Finance",
    calendar: "Productivity",
    "cloud storage & file sharing": "Databases & Storage",
    "continuous integration": "Developer & Cloud",
    cryptocurrency: "Business & Finance",
    "currency exchange": "Business & Finance",
    "data validation": "Developer & Cloud",
    development: "Developer & Cloud",
    dictionaries: "Productivity",
    "documents & productivity": "Productivity",
    email: "Communication",
    entertainment: "Social & Creators",
    environment: "Productivity",
    finance: "Business & Finance",
    "food & drink": "Productivity",
    "games & comics": "Gaming & Esports",
    geocoding: "Productivity",
    government: "Databases & Storage",
    health: "Productivity",
    jobs: "Business & Finance",
    "machine learning": "AI & Machine Learning",
    music: "Social & Creators",
    news: "Social & Creators",
    "open data": "Databases & Storage",
    "open source projects": "Developer & Cloud",
    patent: "Business & Finance",
    personality: "Social & Creators",
    phone: "Communication",
    photography: "Creative & 3D Design",
    programming: "Developer & Cloud",
    "science & math": "Productivity",
    security: "Developer & Cloud",
    shopping: "Business & Finance",
    social: "Social & Creators",
    "sports & fitness": "Social & Creators",
    "test data": "Developer & Cloud",
    "text analysis": "AI & Machine Learning",
    tracking: "Productivity",
    transportation: "Productivity",
    "url shorteners": "Developer & Cloud",
    vehicle: "Productivity",
    video: "Social & Creators",
    weather: "Productivity",
  };

  let currentSection = "Productivity";
  let publicApisAdded = 0;
  for (const line of publicApisMd.split("\n")) {
    if (line.startsWith("### ")) {
      const sec = line.replace("### ", "").trim().toLowerCase();
      currentSection = sectionMap[sec] || "Productivity";
    } else if (line.startsWith("| [")) {
      const match = line.match(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]+)\s*\|/);
      if (match) {
        const title = match[1].trim();
        const desc = match[3].trim().replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ");
        const norm = normalizeKey(title);
        if (!seen.has(norm) && title.length > 1 && !title.includes("---")) {
          seen.add(norm);
          let cat = currentSection;
          const fullText = (title + " " + desc).toLowerCase();
          if (
            fullText.includes("game") ||
            fullText.includes("gaming") ||
            fullText.includes("esport") ||
            fullText.includes("chess") ||
            fullText.includes("steam") ||
            fullText.includes("pokemon") ||
            fullText.includes("minecraft")
          ) {
            cat = "Gaming & Esports";
          }
          combined.push({
            name: `publicapi-${title.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}`,
            displayName: title,
            description: desc || `Public API integration for ${title}`,
            logoUrl: null,
            version: "1.0.0",
            category: cat,
          });
          publicApisAdded++;
        }
      }
    }
  }
  console.log(`  Added ${publicApisAdded} public API entries.`);
  console.log(`► Total catalog size: ${combined.length} connectors.`);

  const catCounts = {};
  for (const p of combined) {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  }
  console.log("Category counts:", catCounts);

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(combined, null, 2), "utf8");
  const stats = fs.statSync(CATALOG_PATH);
  console.log(`✔ Successfully wrote catalog to ${CATALOG_PATH} (${(stats.size / 1024 / 1024).toFixed(2)} MB).`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
