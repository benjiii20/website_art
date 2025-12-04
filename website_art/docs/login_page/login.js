// /public/login_page/login.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 🔧 Supabase project config
const SUPABASE_URL = "https://jhzlxmomyypgtkuwdvzn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoemx4bW9teXlwZ3RrdXdkdnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTgzMzEsImV4cCI6MjA3Mzk3NDMzMX0.IZw6mlxn7Hbue5UlrckhPJeCDNplj-zM1zoiddQGnj0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Success → redirect (relative path)
    window.location.href = "../search_page/search_bar.html";
  } catch (err) {
    errEl.textContent = friendly(err);
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
