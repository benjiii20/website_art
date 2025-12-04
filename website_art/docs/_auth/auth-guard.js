// /_auth/auth-guard.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 🔧 Your project config
const SUPABASE_URL = "https://jhzlxmomyypgtkuwdvzn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoemx4bW9teXlwZ3RrdXdkdnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTgzMzEsImV4cCI6MjA3Mzk3NDMzMX0.IZw6mlxn7Hbue5UlrckhPJeCDNplj-zM1zoiddQGnj0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session || null;
}

// Require any signed-in user
export async function requireAuth({ redirect = "/admin.html" } = {}) {
  const session = await getSession();
  if (!session?.user) {
    location.href = redirect;
    return null;
  }
  return session;
}

// Require admin by checking membership in public.admins
export async function requireAdmin({
  redirectIfNoSession = "/admin.html",
  redirectIfNotAdmin = "/search_page/search_bar.html",
} = {}) {
  const session = await requireAuth({ redirect: redirectIfNoSession });
  if (!session) return null;

  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    location.href = redirectIfNotAdmin;
    return null;
  }
  return session;
}

// (Optional) quick helper without redirecting
export async function isAdmin() {
  const session = await getSession();
  if (!session?.user) return false;
  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();
  return !!data;
}

// Expose for quick debugging in the console
if (typeof window !== "undefined") {
  window.__supabase = supabase;
}

// Auto-redirect to login when signed out
supabase.auth.onAuthStateChange((evt) => {
  if (evt === "SIGNED_OUT") location.href = "/admin.html";
});
