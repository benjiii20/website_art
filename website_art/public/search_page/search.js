// /public/search_page/search.js — updated with live-region support for Khaya NOIR

// === Config ===
const ROTATE_MS = 2500;
const FADE_MS   = 250;

// Supabase client
const supabaseUrl = window.SUPABASE_URL;
const supabaseKey = window.SUPABASE_ANON_KEY;
if (!window.supabase) {
  console.error('Supabase CDN not loaded.');
}
const supa = window.supabase.createClient(supabaseUrl, supabaseKey);

// Auth guard
async function ensureSignedIn() {
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (!session?.user) {
      location.href = "/admin.html";
      return false;
    }
    return true;
  } catch {
    location.href = "/admin.html";
    return false;
  }
}

supa.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") location.href = "/admin.html";
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

let page = 1;
const pageSize = 12;
let lastQuery = "";

// Image rotation cleanup
let rotationCleanups = [];
function clearRotations() {
  rotationCleanups.forEach(fn => { try { fn(); } catch {} });
  rotationCleanups = [];
}

const REGION_COUNTRIES = { /* ...same mapping as before... */ };

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

function artistCard(artist, imagesForArtist) {
  const card = document.createElement("a");
  card.className = "artist-card";
  card.href = `../artist_page/artist_page.html?slug=${encodeURIComponent(artist.slug)}`;
  const imgs = (imagesForArtist && imagesForArtist.length > 0) ? imagesForArtist : [PLACEHOLDER];
  card.innerHTML = `
    <div class="art-image"><img alt="${artist.name}" loading="lazy" /></div>
    <div class="artist-info">
      <h3>${artist.name}</h3>
      ${artist.country || artist.region_sub ? `<p>${[artist.country, artist.region_sub].filter(Boolean).join(' — ')}</p>` : ''}
      ${artist.bio ? `<p>${artist.bio.substring(0, 100)}${artist.bio.length > 100 ? '…' : ''}</p>` : ''}
    </div>
  `;

  const imgEl = card.querySelector(".art-image img");
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let idx = 0;
  let timerId = null;

  function setImage(src) {
    imgEl.style.opacity = 0;
    setTimeout(() => {
      imgEl.src = src || PLACEHOLDER;
      imgEl.style.opacity = 1;
    }, FADE_MS);
  }
  function rotate() {
    idx = (idx + 1) % imgs.length;
    setImage(imgs[idx]);
  }
  function start() {
    if (timerId || imgs.length <= 1 || prefersReduced) return;
    timerId = setInterval(rotate, ROTATE_MS);
  }
  function stop() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  imgEl.src = imgs[0];
  const onEnter = () => stop();
  const onLeave = () => start();
  card.addEventListener('mouseenter', onEnter);
  card.addEventListener('mouseleave', onLeave);
  start();
  rotationCleanups.push(() => {
    stop();
    card.removeEventListener('mouseenter', onEnter);
    card.removeEventListener('mouseleave', onLeave);
  });
  return card;
}

async function runSearch(q, pageNum = 1) {
  lastQuery = q;
  const from = (pageNum - 1) * pageSize;
  const to   = from + pageSize - 1;
  clearRotations();
  listEl.innerHTML = "";

  try {
    let query = supa.from("artists")
      .select("id,name,slug,bio,country,region_sub,gender", { count: "exact" })
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q && q.trim()) {
      const t = q.trim();
      query = query.or(`name.ilike.%${t}%,slug.ilike.%${t}%,country.ilike.%${t}%,region_sub.ilike.%${t}%`);
    }
    if (regionSel?.value)   query = query.eq("region_sub", regionSel.value);
    if (countrySel?.value)  query = query.eq("country", countrySel.value);
    if (genderSel?.value)   query = query.eq("gender", genderSel.value);

    const { data: artists, error: artistsErr, count } = await query;
    if (artistsErr) {
      if (artistsErr.code === "PGRST116" || artistsErr.message?.toLowerCase().includes("permission denied")) {
        location.href = "/admin.html";
        return;
      }
      listEl.innerHTML = `<div class="artist-card" style="padding:15px;">Search error: ${artistsErr.message}</div>`;
      return;
    }

    const artistIds = (artists || []).map(a => a.id);
    const artworksByArtist = {};
    if (artistIds.length > 0) {
      const { data: artworks, error: artErr } = await supa
        .from("artworks")
        .select("artist_id,image_url,is_published")
        .in("artist_id", artistIds)
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (!artErr) {
        for (const row of artworks || []) {
          if (!row.image_url) continue;
          if (!artworksByArtist[row.artist_id]) artworksByArtist[row.artist_id] = [];
          artworksByArtist[row.artist_id].push(row.image_url);
        }
      }
    }

    listEl.innerHTML = "";
    (artists || []).forEach(a => {
      const imgs = artworksByArtist[a.id] || [];
      const card = artistCard(a, imgs);
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
      liveRegion.textContent = `Showing ${artists?.length || 0} artists. Page ${page} of ${totalPages}. Total results: ${total}.`;
    }
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="artist-card" style="padding:15px;">Error: ${err.message || err}</div>`;
  }
}

function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }

inputEl.addEventListener("input", debounce(()=> runSearch(inputEl.value, 1), 250));
regionSel?.addEventListener("change", () => { populateCountries(regionSel.value); runSearch(inputEl.value, 1); });
countrySel?.addEventListener("change", () => runSearch(inputEl.value, 1));
genderSel?.addEventListener("change",  () => runSearch(inputEl.value, 1));
prevBtn.addEventListener("click", ()=> runSearch(lastQuery, Math.max(1, page - 1)));
nextBtn.addEventListener("click", ()=> runSearch(lastQuery, page + 1));

(async function init(){
  const ok = await ensureSignedIn();
  if (!ok) return;
  resetCountrySelect();
  runSearch("", 1);
 })();
