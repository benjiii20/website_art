// /public/search_page/search.js — static cards + profile artwork via view

// === Config ===
const pageSize = 12;

// Supabase client
const supabaseUrl = window.SUPABASE_URL;
const supabaseKey = window.SUPABASE_ANON_KEY;
const STORAGE_KEY = "sb-jhzlxmomyypgtkuwdvzn-auth-token";

function pickAuthStorage() {
  try {
    const k = "sb-check";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch (_) {}
  try {
    const k = "sb-check";
    sessionStorage.setItem(k, "1");
    sessionStorage.removeItem(k);
    return sessionStorage;
  } catch (_) {}
  return undefined;
}

if (!window.supabase) {
  console.error('Supabase CDN not loaded.');
}
const supa = window.supabase.createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: STORAGE_KEY,
    storage: pickAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Auth guard (matches your RLS = authenticated only)
async function ensureSignedIn() {
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (!session?.user) {
      location.href = "../login_page/login.html";
      return false;
    }
    const label = session.user.email || session.user.id;
    const menuUser = document.getElementById("menuUser");
    if (menuUser) menuUser.textContent = label;
    return true;
  } catch {
    location.href = "../login_page/login.html";
    return false;
  }
}

supa.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") location.href = "../login_page/login.html";
});

// DOM references
const listEl   = document.querySelector(".results-grid");
const inputEl  = document.getElementById("searchInput");
const pageSpan = document.querySelector(".pagination span");
const prevBtn  = document.querySelector(".pagination button:nth-child(1)");
const nextBtn  = document.querySelector(".pagination button:nth-child(3)");
const regionSel   = document.getElementById("filterRegion");
const countrySel  = document.getElementById("filterCountry");
const genderSel   = document.getElementById("filterGender");
const liveRegion  = document.getElementById("resultsStatus");
const menuBtn = document.getElementById("profileMenuBtn");
const menu = document.getElementById("profileMenu");
const logoutBtn = document.getElementById("logoutBtn");

// NEW FILTER DOM REFS
const mediumSel   = document.getElementById("filterMedium");    // Medium / Art Form
const styleSel    = document.getElementById("filterStyle");     // Style / Aesthetic
const themeSel    = document.getElementById("filterTheme");     // Themes / Content
const moodSel     = document.getElementById("filterMood");      // Mood
const paletteSel  = document.getElementById("filterPalette");   // Color Palette
const levelSel    = document.getElementById("filterLevel");     // Artist Level
const formatSel   = document.getElementById("filterFormat");    // Format / Size
const filtersPanel = document.getElementById("filtersPanel");
const filtersToggle = document.getElementById("toggleFilters");

// Profile menu handlers
if (menuBtn && menu) {
  menuBtn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });
}

logoutBtn?.addEventListener("click", async () => {
  await supa.auth.signOut();
  location.href = "../login_page/login.html";
});

let page = 1;
let lastQuery = "";

const REGION_COUNTRIES = {
  "North Africa": ["Algeria","Egypt","Libya","Morocco","Sudan","Tunisia"],
  "West Africa": ["Benin","Burkina Faso","Cabo Verde","Côte d’Ivoire","Gambia","Ghana","Guinea","Guinea-Bissau","Liberia","Mali","Mauritania","Niger","Nigeria","Senegal","Sierra Leone","Togo"],
  "East Africa": ["Burundi","Comoros","Djibouti","Eritrea","Ethiopia","Kenya","Madagascar","Malawi","Mauritius","Mozambique","Rwanda","Seychelles","Somalia","South Sudan","Tanzania","Uganda"],
  "Central Africa": ["Angola","Cameroon","Central African Republic","Chad","Congo","Democratic Republic of the Congo","Equatorial Guinea","Gabon","São Tomé and Príncipe"],
  "Southern Africa": ["Botswana","Eswatini","Lesotho","Namibia","South Africa","Zambia","Zimbabwe"],
  "North America": ["Canada","United States","Mexico","Greenland"],
  "Central America": ["Belize","Costa Rica","El Salvador","Guatemala","Honduras","Nicaragua","Panama"],
  "Caribbean": ["Antigua and Barbuda","Bahamas","Barbados","Cuba","Dominica","Dominican Republic","Grenada","Haiti","Jamaica","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Trinidad and Tobago"],
  "South America": ["Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Guyana","Paraguay","Peru","Suriname","Uruguay","Venezuela"]
};

function resetCountrySelect() {
  if (!countrySel) return;
  countrySel.innerHTML = `<option value="">Country</option>`;
  countrySel.disabled = true;
}

function populateCountries(region) {
  resetCountrySelect();
  if (!region || !REGION_COUNTRIES[region] || !countrySel) return;
  REGION_COUNTRIES[region].forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    countrySel.appendChild(opt);
  });
  countrySel.disabled = false;
}

const PLACEHOLDER = "../sample_images/sample_img.png";

// Static artist card (no favorites icon)
function artistCard(artist, imageUrl) {
  const card = document.createElement("div");
  card.className = "artist-card";

  const safeLocation = [artist.country, artist.region_sub].filter(Boolean).join(" — ");

  const link = document.createElement("a");
  link.href = `../artist_page/artist_page.html?slug=${encodeURIComponent(artist.slug)}`;
  link.className = "card-link";
  link.innerHTML = `
      <div class="art-image">
        <img alt="${artist.name}" loading="lazy" />
      </div>
      <div class="artist-info">
        <h3>${artist.name}</h3>
        ${safeLocation ? `<p>${safeLocation}</p>` : ""}
      </div>
    `;

  const imgEl = link.querySelector(".art-image img");
  imgEl.src = imageUrl || PLACEHOLDER;

  card.appendChild(link);
  return card;
}

async function runSearch(q, pageNum = 1) {
  lastQuery = q;
  const from = (pageNum - 1) * pageSize;
  const to   = from + pageSize - 1;
  listEl.innerHTML = "";

  try {
    // 1) Fetch artists (published only, matches your RLS)
    let query = supa.from("artists")
      .select(
        "id,name,slug,bio,country,region_sub,gender,medium,style,theme,mood,color_palette,artist_level,format_size",
        { count: "exact" }
      )
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    // Text search
    if (q && q.trim()) {
      const t = q.trim();
      query = query.or(
        `name.ilike.%${t}%,slug.ilike.%${t}%,country.ilike.%${t}%,region_sub.ilike.%${t}%`
      );
    }

    // Existing filters
    if (regionSel?.value)   query = query.eq("region_sub", regionSel.value);
    if (countrySel?.value)  query = query.eq("country", countrySel.value);
    if (genderSel?.value)   query = query.eq("gender", genderSel.value);

    // NEW FILTERS (columns exist in artists table)
    if (mediumSel?.value)   query = query.eq("medium", mediumSel.value);
    if (styleSel?.value)    query = query.eq("style", styleSel.value);
    if (themeSel?.value)    query = query.eq("theme", themeSel.value);
    if (moodSel?.value)     query = query.eq("mood", moodSel.value);
    if (paletteSel?.value)  query = query.eq("color_palette", paletteSel.value);
    if (levelSel?.value)    query = query.eq("artist_level", levelSel.value);
    if (formatSel?.value)   query = query.eq("format_size", formatSel.value);

    const { data: artists, error: artistsErr, count } = await query;
    if (artistsErr) {
      if (
        artistsErr.code === "PGRST116" ||
        artistsErr.message?.toLowerCase().includes("permission denied")
      ) {
        location.href = "../login_page/login.html";
        return;
      }
      listEl.innerHTML =
        `<div class="artist-card" style="padding:15px;">Search error: ${artistsErr.message}</div>`;
      return;
    }

    // 2) Fetch profile image per artist from view
    const artistIds = (artists || []).map(a => a.id);
    const profileImageByArtist = {};

    if (artistIds.length > 0) {
      const { data: profiles, error: profileErr } = await supa
        .from("v_artist_profile_image")
        .select("artist_id, profile_image_url")
        .in("artist_id", artistIds);

      if (!profileErr) {
        for (const row of (profiles || [])) {
          if (!row.profile_image_url) continue;
          profileImageByArtist[row.artist_id] = row.profile_image_url;
        }
      } else {
        console.error("profile view error:", profileErr);
      }
    }

    // 3) Render cards
    listEl.innerHTML = "";
    (artists || []).forEach(a => {
      const img = profileImageByArtist[a.id] || null;
      const card = artistCard(a, img);
      listEl.appendChild(card);
    });

    const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
    page = Math.min(pageNum, totalPages);
    pageSpan.textContent = `${page} of ${totalPages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;

    // Update live-region for accessibility
    if (liveRegion) {
      const total = count || 0;
      liveRegion.textContent =
        `Showing ${artists?.length || 0} artists. Page ${page} of ${totalPages}. Total results: ${total}.`;
    }
  } catch (err) {
    console.error(err);
    listEl.innerHTML =
      `<div class="artist-card" style="padding:15px;">Error: ${err.message || err}</div>`;
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

inputEl.addEventListener(
  "input",
  debounce(() => runSearch(inputEl.value, 1), 250)
);
regionSel?.addEventListener("change", () => {
  populateCountries(regionSel.value);
  runSearch(inputEl.value, 1);
});
countrySel?.addEventListener("change", () => runSearch(inputEl.value, 1));
genderSel?.addEventListener("change", () => runSearch(inputEl.value, 1));

// NEW FILTER LISTENERS
mediumSel?.addEventListener("change", () => runSearch(inputEl.value, 1));
styleSel?.addEventListener("change", () => runSearch(inputEl.value, 1));
themeSel?.addEventListener("change", () => runSearch(inputEl.value, 1));
moodSel?.addEventListener("change", () => runSearch(inputEl.value, 1));
paletteSel?.addEventListener("change", () => runSearch(inputEl.value, 1));
levelSel?.addEventListener("change", () => runSearch(inputEl.value, 1));
formatSel?.addEventListener("change", () => runSearch(inputEl.value, 1));

prevBtn.addEventListener("click", () =>
  runSearch(lastQuery, Math.max(1, page - 1))
);
nextBtn.addEventListener("click", () =>
  runSearch(lastQuery, page + 1)
);

filtersToggle?.addEventListener("click", () => {
  const nowOpen = !(filtersPanel?.classList.toggle("hidden"));
  filtersToggle.setAttribute("aria-expanded", nowOpen ? "true" : "false");
});

(async function init() {
  const ok = await ensureSignedIn();
  if (!ok) return;
  resetCountrySelect();
  runSearch("", 1);
})();
