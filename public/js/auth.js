import { supabase } from "./supabaseClient.js";

function getEl(id) {
  return document.getElementById(id);
}

async function getProfileRole() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
.eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.role ?? "worker";
}

function setLoading(isLoading) {
  const authButtons = document.querySelectorAll("button[data-loading='auth']");
  authButtons.forEach((btn) => {
    btn.disabled = !!isLoading;
    const spinner = btn.querySelector("[data-spinner]");
    if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
    const label = btn.querySelector(".btn-label");
    if (label) {
      const defaultLabel = btn.dataset.defaultLabel || label.textContent;
      label.textContent = isLoading ? (btn.dataset.authAction === "login" ? "AUTHENTICATING..." : "PROCESSING...") : defaultLabel;
    }
  });
}

function showError(msg, isSuccess = false) {
  const el = getEl("auth-error");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isSuccess ? "#86efac" : "#fda4af";
}

function clearError() {
  const el = getEl("auth-error");
  if (el) {
    el.textContent = "";
    el.style.color = "";
  }
}

function wirePasswordToggle() {
  const toggle = document.querySelector("button[data-toggle-password]");
  const input = document.querySelector("input[data-password-input]");
  if (!toggle || !input) return;

  toggle.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(!isPassword));
    toggle.textContent = isPassword ? "Hide" : "Show";
    toggle.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
}

export async function initAuthPage() {
  // Diagnostics for click-handler + config issues
  console.debug("[VaultDesk] initAuthPage booted");
  wirePasswordToggle();

  const loginBtn = document.querySelector("button[data-auth-action='login']");
  const signupBtn = document.querySelector("button[data-auth-action='signup']");
  const authCard = document.querySelector(".auth-card");
  if (!loginBtn && !signupBtn) return;

  const emailInput = getEl("email");
  const passwordInput = getEl("password");

  if (!emailInput || !passwordInput) {
    console.warn("Auth page missing #email or #password");
    return;
  }

  loginBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    clearError();
    authCard?.classList.remove("shake");
    setLoading(true);

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (loginBtn) {
        const label = loginBtn.querySelector(".btn-label");
        if (label) label.textContent = "✓ ACCESS GRANTED";
      }

      const role = await getProfileRole();
      if (role === "admin") window.location.href = "admin-dashboard.html";
      else window.location.href = "worker-dashboard.html";
    } catch (err) {
      showError(err?.message || String(err));
      authCard?.classList.add("shake");
    } finally {
      setLoading(false);
    }
  });

  signupBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // In production you typically enforce signup flow via Supabase admin/seed.
      // Here we allow sign-up but the role is expected to be assigned via seed/migration.
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      showError("Check your email for confirmation (or ensure email confirmations are disabled)." );
    } catch (err) {
      showError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  });

  const forgot = document.querySelector("a[data-forgot-password]");
  forgot?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const email = emailInput.value.trim();
      if (!email) {
        showError("Enter your email to reset password.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/Page.html",
      });
      if (error) throw error;
      showError("Password reset email sent.");
    } catch (err) {
      showError(err?.message || String(err));
    }
  });
}

