// public/search_page/search.js

// Use the keys you set in search_bar.html
const supabaseUrl = window.SUPABASE_URL || "https://jhzlxmomyypgtkuwdvzn.supabase.co";
const supabaseKey = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoemx4bW9teXlwZ3RrdXdkdnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTgzMzEsImV4cCI6MjA3Mzk3NDMzMX0.IZw6mlxn7Hbue5UlrckhPJeCDNplj-zM1zoiddQGnj0";

// The CDN script exposes window.supabase
if (!window.supabase) {
  console.error("Supabase CDN not loaded. Make sure <script type=\"module\" src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2\"></script> is included.");
}
const supa = window.supabase.createClient(supabaseUrl, supabaseKey);

const listEl   = document.querySelector(".results");
const inputEl  = document.getElementById("searchInput");
const pageSpan = document.querySelector(".pagination span");
const prevBtn  = document.querySelector(".pagination button:nth-child(1)");
const nextBtn  = document.querySelector(".pagination button:nth-child(3)");

const regionSel   = document.getElementById("filterRegion");
const countrySel  = document.getElementById("filterCountry");
const genderSel   = document.getElementById("filterGender");

let page = 1;
const pageSize = 12;
let lastQuery = "";

// Region -> Countries map
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

function artistCard(a){
  const card = document.createElement("a");
  card.className = "result-card artist-card";
  // link from /search_page/ to /artist_page/
  card.href = `../artist_page/artist_page.html?slug=${encodeURIComponent(a.slug)}`;
  card.innerHTML = `
    <img src="${a.avatar_url || '../sample_images/sample_img.png'}" alt="${a.name}" />
    <div class="info">
      <h3>${a.name}</h3>
      ${a.country || a.region_sub ? `<p>${[a.country, a.region_sub].filter(Boolean).join(' — ')}</p>` : ''}
      ${a.bio ? `<p>${a.bio.substring(0,120)}${a.bio.length>120?'…':''}</p>` : ''}
    </div>`;
  return card;
}

async function runSearch(q, pageNum=1){
  lastQuery = q;
  const from = (pageNum-1) * pageSize;
  const to   = from + pageSize - 1;

  let query = supa.from("artists")
    .select("id,name,slug,avatar_url,bio,country,region_sub,gender", { count: "exact" })
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q && q.trim())           query = query.ilike("name", `%${q}%`);
  if (regionSel?.value)        query = query.eq("region_sub", regionSel.value);
  if (countrySel?.value)       query = query.eq("country", countrySel.value);
  if (genderSel?.value)        query = query.eq("gender", genderSel.value);

  const { data, error, count } = await query;
  if (error){
    listEl.innerHTML = `<div class="error">Search error: ${error.message}</div>`;
    return;
  }

  listEl.innerHTML = "";
  (data || []).forEach(a => listEl.appendChild(artistCard(a)));

  const totalPages = Math.max(1, Math.ceil((count||0)/pageSize));
  page = Math.min(pageNum, totalPages);
  pageSpan.textContent = `${page} of ${totalPages}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
}

function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }

// Listeners
inputEl.addEventListener("input", debounce(()=> runSearch(inputEl.value, 1), 250));

regionSel?.addEventListener("change", () => {
  populateCountries(regionSel.value);
  runSearch(inputEl.value, 1);
});

countrySel?.addEventListener("change", () => runSearch(inputEl.value, 1));
genderSel?.addEventListener("change",  () => runSearch(inputEl.value, 1));

prevBtn.addEventListener("click", ()=> runSearch(lastQuery, Math.max(1, page-1)));
nextBtn.addEventListener("click", ()=> runSearch(lastQuery, page+1));

// Initial state
resetCountrySelect();
runSearch("", 1);
