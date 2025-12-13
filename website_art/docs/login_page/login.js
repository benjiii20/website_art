// /public/login_page/login.js
// 🔧 Supabase project config
const SUPABASE_URL = "https://jhzlxmomyypgtkuwdvzn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoemx4bW9teXlwZ3RrdXdkdnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTgzMzEsImV4cCI6MjA3Mzk3NDMzMX0.IZw6mlxn7Hbue5UlrckhPJeCDNplj-zM1zoiddQGnj0";
const STORAGE_KEY = "sb-jhzlxmomyypgtkuwdvzn-auth-token";

// Prefer localStorage, fall back to sessionStorage (Safari private mode blocks localStorage writes).
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

const loginForm = document.getElementById("loginForm");
const errEl = document.getElementById("login-error");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");

const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: STORAGE_KEY,
    storage: pickAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
}) || null;

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!supabase) {
    if (errEl) errEl.textContent = "Unable to load the auth client. Check your connection and refresh.";
    return;
  }

  const email = emailInput?.value.trim() || "";
  const password = passwordInput?.value || "";
  if (errEl) errEl.textContent = "";
  loginBtn?.setAttribute("disabled", "true");

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Ensure session is written before navigating
    await supabase.auth.getSession();

    // Success → redirect (relative path)
    window.location.href = "../search_page/search_bar.html";
  } catch (err) {
    if (errEl) errEl.textContent = friendly(err);
  } finally {
    loginBtn?.removeAttribute("disabled");
  }
});

// Map Supabase errors to user-friendly messages
function friendly(err) {
  const msg = (err?.message || "").toLowerCase();
  const status = err?.status;

  if (status === 429 || msg.includes("rate limit")) {
    return "Too many attempts. Please wait and try again.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (msg.includes("email not confirmed") || msg.includes("email not verified")) {
    return "Please confirm your email before signing in.";
  }
  if (msg.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (msg.includes("network")) {
    return "Network error. Check your connection.";
  }
  return err?.message || "Something went wrong.";
}
