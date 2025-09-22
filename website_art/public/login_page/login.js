// public/login_page/login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD8Hti_jSPVc4EQfypnue9xjtdDFSl5s8s",
  authDomain: "art-kingdom.firebaseapp.com",
  projectId: "art-kingdom",
  messagingSenderId: "1027676825354",
  appId: "1:1027676825354:web:071590312ebd600f603cf3",
  measurementId: "G-E060BR452K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "/search_page/search_bar.html";
  } catch (err) {
    errEl.textContent = friendly(err);
  }
});

function friendly(err) {
  const c = err?.code || "";
  if (c.includes("user-disabled")) return "Your account is disabled. Please contact the admin.";
  if (c.includes("invalid-credential") || c.includes("invalid-login-credentials"))
    return "Email or password is incorrect.";
  if (c.includes("too-many-requests")) return "Too many attempts. Please wait and try again.";
  if (c.includes("network-request-failed")) return "Network error. Check your connection.";
  if (c.includes("invalid-email")) return "Enter a valid email address.";
  if (c.includes("wrong-password") || c.includes("user-not-found"))
    return "Email or password is incorrect.";
  return err.message || "Something went wrong.";
}
