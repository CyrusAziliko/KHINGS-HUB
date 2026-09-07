import { supabase } from "./supabaseClient.js";
import {
  bindThemeToggle,
  getCurrentTheme,
  setTheme,
  updateThemeToggleLabel,
} from "./worker-theme.js";

function getFileName(file) {
  if (!file) return "";
  return file.name || "profile";
}

async function ensureUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Not signed in.");
  return user;
}

function resolvePasswordRedirectUrl() {
  const origin = window.location.origin;
  const path = window.location.pathname || "";
  if (path.includes("/public/")) return `${origin}/public/Page.html`;
  return `${origin}/Page.html`;
}

export function initSettingsPanel() {
  const root = document.querySelector("[data-settings-root]");
  if (!root) return;

  root.innerHTML = `
<div class="kh-settings-page settings-v2">

  <!-- HEADER -->
  <div class="settings-header glass">

    <div class="settings-header-copy">
      <span class="settings-kicker">Worker Workspace</span>
      <h1>
        ⚙️ Account Settings
      </h1>

      <p class="settings-subtitle">
        Manage your KHING’s Hub profile, security and preferences.
      </p>
    </div>


    <div class="settings-status-pill">
      🟢 Account Active
    </div>

  </div>


  <div class="settings-enterprise-grid">


    <!-- PROFILE CARD -->
    <section class="glass settings-profile-card">

      <div class="settings-profile-premium-wrap">
        <div class="profile-cover settings-profile-premium-head">

          <div class="profile-avatar-large">

            <img 
            id="settings-avatar-preview-img"
            src=""
            alt="Profile">

            <label class="avatar-upload" title="Upload profile photo">

              📷

              <input 
              id="settings-avatar-input"
              type="file"
              accept="image/*"
              hidden>

            </label>

          </div>


          <div class="profile-details settings-profile-premium-identity">

            <h2 id="profile-display-name">
              Loading...
            </h2>

            <div class="settings-profile-meta">
              <span class="settings-meta-chip" id="settings-meta-role">Worker</span>
              <span class="settings-meta-chip" id="settings-meta-department">Mining Operations</span>
              <span class="settings-meta-chip" id="settings-meta-position">Employee</span>
            </div>

            <small>
              KHING’s Hub Enterprise Platform
            </small>

            <div class="settings-avatar-file-row">
              <strong>Avatar:</strong>
              <span data-avatar-file-name>None selected</span>
            </div>

          </div>


        </div>

        <div class="settings-profile-form-surface">
          <p class="settings-locked-note" role="note">
            🔒 Some fields are managed by your administrator.
          </p>

          <div class="settings-form-head">
            <h3>Profile Details</h3>
            <p>Keep your account information current for team visibility and alerts.</p>
          </div>

          <div class="settings-form settings-form-premium">


            <div class="form-group">

              <label>
                Full Name
              </label>

              <input 
              id="settings-full-name"
              type="text">

            </div>



            <div class="form-group">

              <label>
                Email
              </label>

              <input
              id="settings-email"
              aria-readonly="true"
              readonly>

            </div>



            <div class="form-group">

              <label>
                Employee ID
              </label>

              <input
              id="settings-employee-id"
              aria-readonly="true"
              readonly>

            </div>



            <div class="form-group is-readonly">

              <label>
                Department
              </label>

              <input
              id="settings-department">

            </div>



            <div class="form-group is-readonly">

              <label>
                Position
              </label>

              <input
              id="settings-position"
              aria-readonly="true"
              readonly>

            </div>



            <div class="form-group">

              <label>
                Phone Number
              </label>

              <input
              id="settings-phone">

            </div>



          </div>


          <div class="form-group settings-bio-group">

            <label>
              Professional Bio
            </label>


            <textarea 
            id="settings-bio">
            </textarea>


          </div>



          <div class="settings-actions settings-actions-premium">

            <button
            class="btn primary"
            data-save-changes>

            💾 Save Profile

            </button>


            <button
            class="btn ghost"
            data-change-password>

            🔐 Change Password

            </button>


          </div>
        </div>


        <div 
        class="settings-message"
        data-settings-status>
        </div>
      </div>

    </section>





    <!-- RIGHT PANEL -->

    <aside class="settings-side">


      <section class="glass security-card">

        <h3>
          🔐 Security
        </h3>


        <p>
          Protect your account and credentials.
        </p>


        <div class="settings-side-banner">
          <span class="settings-side-banner-title">Protection Status</span>
          <strong data-auth-status>
          Checking...
          </strong>
        </div>


        <div class="security-item">

          <span>
          Password
          </span>

          <button 
          class="btn ghost"
          data-change-password>

          Reset

          </button>

        </div>


        <div class="security-item security-item--compact">

          <span>
          Session Security
          </span>

          <strong>
          Live
          </strong>

        </div>


      </section>




      <section class="glass appearance-card">

        <h3>
          🎨 Appearance
        </h3>


        <p>
          Customize your dashboard experience.
        </p>


        <button
        id="theme-toggle"
        class="btn ghost settings-theme-quick-toggle"
        type="button">

        Toggle Theme

        </button>


        <div class="theme-display">


          <button
          type="button"
          class="theme-choice-btn"
          data-theme-choice="dark"
          aria-pressed="false">
            Dark Mode
          </button>


          <button
          type="button"
          class="theme-choice-btn"
          data-theme-choice="light"
          aria-pressed="false">
            Light Mode
          </button>


        </div>


        <p class="theme-hint">
          Select a preferred mode or use the quick toggle.
        </p>


      </section>



    </aside>



  </div>


</div>
`;

  const statusEl = root.querySelector("[data-settings-status]");
  const avatarInput = root.querySelector("#settings-avatar-input");
  const avatarImg = root.querySelector("#settings-avatar-preview-img");
  const avatarFileName = root.querySelector("[data-avatar-file-name]");

  const fullNameInput = root.querySelector("#settings-full-name");
  const emailInput = root.querySelector("#settings-email");
  const employeeIdInput = root.querySelector("#settings-employee-id");
  const departmentInput = root.querySelector("#settings-department");
  const positionInput = root.querySelector("#settings-position");
  const phoneInput = root.querySelector("#settings-phone");
  const bioInput = root.querySelector("#settings-bio");

  const saveBtn = root.querySelector("[data-save-changes]");
  const changePasswordBtns = Array.from(root.querySelectorAll("[data-change-password]"));
  const accountStatusPill = root.querySelector(".settings-status-pill");
  const authStatusEl = root.querySelector("[data-auth-status]");
  const themeToggleBtn = root.querySelector("#theme-toggle");
  const themeChoiceBtns = Array.from(root.querySelectorAll("[data-theme-choice]"));

  if (themeToggleBtn) {
    bindThemeToggle(themeToggleBtn);
    updateThemeToggleLabel(themeToggleBtn);
  }

  function syncThemeChoiceButtons() {
    const activeTheme = getCurrentTheme();
    themeChoiceBtns.forEach((btn) => {
      const choice = btn.getAttribute("data-theme-choice");
      const isActive = choice === activeTheme;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  themeChoiceBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = btn.getAttribute("data-theme-choice");
      const appliedTheme = choice === "light" ? "light" : "dark";
      setTheme(appliedTheme);
      if (themeToggleBtn) updateThemeToggleLabel(themeToggleBtn);
      syncThemeChoiceButtons();
    });
  });

  window.addEventListener("themechange", syncThemeChoiceButtons);
  syncThemeChoiceButtons();

  let selectedFile = null;
  let currentUser = null;
  let currentProfile = null;
  let uploadedAvatarUrl = "";

  function setStatus(message, type = "neutral") {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-error", "is-success", "is-loading");
    if (type === "error") statusEl.classList.add("is-error");
    else if (type === "success") statusEl.classList.add("is-success");
    else if (type === "loading") statusEl.classList.add("is-loading");
  }

  function toTitleCase(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    return raw
      .toLowerCase()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function getStatusVisual(statusValue) {
    const normalized = String(statusValue || "").trim().toLowerCase();
    if (normalized === "active") return { icon: "🟢", label: "Account Active" };
    if (normalized === "inactive") return { icon: "🟡", label: "Account Inactive" };
    if (normalized === "suspended") return { icon: "🔴", label: "Account Suspended" };
    return { icon: "🔵", label: "Account " + (toTitleCase(statusValue) || "Configured") };
  }

  async function loadAuthStatus() {
    if (!authStatusEl) return;

    try {
      const mfaApi = supabase?.auth?.mfa;
      if (!mfaApi || typeof mfaApi.getAuthenticatorAssuranceLevel !== "function") {
        authStatusEl.textContent = "Session secured";
        return;
      }

      const [{ data: aalData, error: aalError }, factorsResult] = await Promise.all([
        mfaApi.getAuthenticatorAssuranceLevel(),
        typeof mfaApi.listFactors === "function"
          ? mfaApi.listFactors()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (aalError) throw aalError;

      const currentLevel = String(aalData?.currentLevel || "").toLowerCase();
      const factors = factorsResult?.data || {};
      const hasAnyFactor =
        (Array.isArray(factors?.all) && factors.all.length > 0) ||
        (Array.isArray(factors?.totp) && factors.totp.length > 0) ||
        (Array.isArray(factors?.phone) && factors.phone.length > 0) ||
        false;

      if (currentLevel === "aal2" || hasAnyFactor) {
        authStatusEl.textContent = "MFA Enabled";
        return;
      }

      authStatusEl.textContent = "Password Only";
    } catch (_) {
      authStatusEl.textContent = "Status unavailable";
    }
  }

  function setPreviewFromFile(file) {
    if (!file || !avatarImg) return;
    const objectUrl = URL.createObjectURL(file);
    avatarImg.src = objectUrl;
  }

  async function uploadAvatar(file, userId) {
    if (!file) {
      throw new Error("No profile image selected.");
    }
    if (!userId) {
      throw new Error("Missing user id for avatar upload.");
    }

    const bucket =
      window.VAULTDESK_CONFIG?.PROFILE_IMAGE_BUCKET ||
      window.VAULTDESK_CONFIG?.STORAGE?.PROFILE_IMAGES ||
      "profile-images";

    const objectPath = `profiles/${userId}/avatar`;

    // Temporary diagnostics to help identify bucket mismatch issues.
    const { data: buckets, error: listBucketsError } = await supabase.storage.listBuckets();
    if (listBucketsError) {
      throw new Error(`Unable to verify storage buckets: ${listBucketsError.message}`);
    }

    const bucketExists = Array.isArray(buckets) && buckets.some((b) => b?.name === bucket);
    if (!bucketExists) {
      const available = (buckets || []).map((b) => b?.name).filter(Boolean).join(", ");
      throw new Error(
        `Storage bucket "${bucket}" was not found. Available buckets: ${available || "none"}`
      );
    }

    const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
      upsert: true,
      contentType: file.type || undefined,
    });
    if (error) {
      throw new Error(`Avatar upload failed: ${error.message}`);
    }

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = pub?.publicUrl || "";
    if (!publicUrl) {
      throw new Error("Avatar uploaded but public URL could not be generated.");
    }

    return publicUrl;
  }

  function getInitials(nameOrEmail) {
    const raw = (nameOrEmail || "").trim();
    if (!raw) return "U";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function setAvatarFallback(labelSource) {
    if (!avatarImg) return;
    const initials = getInitials(labelSource);
    const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>
        <rect width='100%' height='100%' fill='#0f172a'/>
        <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle'
          fill='#cbd5e1' font-family='Inter,Arial,sans-serif' font-size='88' font-weight='700'>${initials}</text>
      </svg>`;
    avatarImg.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function syncIdentityUI(nextProfile = {}) {
    const name = nextProfile.full_name || currentUser?.email || "Worker";
    const avatar = nextProfile.avatar_url || "";

    // ── Sidebar ──
    const sidebarName = document.querySelector(".sidebar-profile h4");
    if (sidebarName) sidebarName.textContent = name;

    const dept = document.querySelector("[data-sidebar-department]");
    if (dept) dept.textContent = nextProfile.department || "";

    const avatarEl = document.querySelector(".sidebar-profile .avatar");
    if (avatarEl) {
      if (avatar) avatarEl.innerHTML = `<img src="${avatar}" alt="Worker avatar" />`;
      else avatarEl.textContent = "";
    }

    // ── Enterprise topbar ──
    const topbarAvatar = document.querySelector(".enterprise-topbar-user .avatar");
    const topbarName = document.querySelector("[data-topbar-name]");
    const topbarRole = document.querySelector("[data-topbar-role]");
    const greetingH1 = document.querySelector(".enterprise-topbar-greeting h1");

    if (topbarAvatar) {
      if (avatar) topbarAvatar.innerHTML = `<img src="${avatar}" alt="Worker avatar" />`;
      else topbarAvatar.innerHTML = '<div class="avatar-placeholder">👷</div>';
    }
    if (topbarName) topbarName.textContent = name;
    if (topbarRole) topbarRole.textContent = nextProfile.department || "Mining Operations";
    if (greetingH1) greetingH1.textContent = `Good Morning, ${name}`;
  }

  async function loadProfile() {
    try {
      setStatus("Loading profile...", "loading");
      currentUser = await ensureUser();

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, status, avatar_url, department, employee_id, email, position, phone, bio")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) throw error;
      if (!profile) throw new Error("Profile not found.");

      currentProfile = profile;
      uploadedAvatarUrl = profile.avatar_url || "";

      if (accountStatusPill) {
        const visual = getStatusVisual(profile.status);
        accountStatusPill.textContent = `${visual.icon} ${visual.label}`;
      }

      if (avatarImg) {
        if (profile.avatar_url) avatarImg.src = profile.avatar_url;
        else setAvatarFallback(profile.full_name || profile.email || currentUser.email);
      }

      fullNameInput.value = profile.full_name || "";

      const displayName = root.querySelector("#profile-display-name");
      const roleChip = root.querySelector("#settings-meta-role");
      const deptChip = root.querySelector("#settings-meta-department");
      const posChip = root.querySelector("#settings-meta-position");

      if (displayName) displayName.textContent = profile.full_name || "KHING’s Hub User";
      if (roleChip) roleChip.textContent = profile.role || "Worker";
      if (deptChip) deptChip.textContent = profile.department || "Department N/A";
      if (posChip) posChip.textContent = profile.position || "Position N/A";

      emailInput.value = profile.email || currentUser.email || "";
      employeeIdInput.value = profile.employee_id || "";
      departmentInput.value = profile.department || "";
      positionInput.value = profile.position || "";
      phoneInput.value = profile.phone || "";
      bioInput.value = profile.bio || "";

      await loadAuthStatus();

      setStatus("");
    } catch (e) {
      setStatus(`Failed to load profile: ${e?.message || e}`, "error");
    }
  }

  avatarInput?.addEventListener("change", () => {
    selectedFile = avatarInput.files && avatarInput.files[0] ? avatarInput.files[0] : null;
    if (avatarFileName) {
      avatarFileName.textContent = selectedFile ? getFileName(selectedFile) : "None";
    }
    if (selectedFile) setPreviewFromFile(selectedFile);
  });

  saveBtn?.addEventListener("click", async () => {
    try {
      if (!currentUser) currentUser = await ensureUser();

      saveBtn.disabled = true;
      setStatus("Saving changes...", "loading");

      let nextAvatarUrl = uploadedAvatarUrl || currentProfile?.avatar_url || "";
      if (selectedFile) {
        nextAvatarUrl = await uploadAvatar(selectedFile, currentUser.id);
      }

      const updates = {
        full_name: fullNameInput.value.trim(),
        department: departmentInput.value.trim(),
        phone: phoneInput.value.trim(),
        bio: bioInput.value.trim(),
        avatar_url: nextAvatarUrl || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").update(updates).eq("id", currentUser.id);
      if (error) throw error;

      uploadedAvatarUrl = nextAvatarUrl;
      const merged = { ...(currentProfile || {}), ...updates };
      currentProfile = merged;

      if (window.currentWorker) {
        window.currentWorker = { ...window.currentWorker, ...updates };
      }

      const displayName = root.querySelector("#profile-display-name");
      const deptChip = root.querySelector("#settings-meta-department");
      if (displayName) displayName.textContent = merged.full_name || "KHING’s Hub User";
      if (deptChip) deptChip.textContent = merged.department || "Department N/A";

      if (avatarImg) {
        if (nextAvatarUrl) avatarImg.src = nextAvatarUrl;
        else setAvatarFallback(merged.full_name || merged.email || currentUser?.email);
      }

      syncIdentityUI({
        ...window.currentWorker,
        ...merged,
        avatar_url: nextAvatarUrl || null,
        department: departmentInput?.value || merged.department || "",
      });

      setStatus("Profile updated successfully.", "success");
    } catch (e) {
      setStatus(`Save failed: ${e?.message || e}`, "error");
    } finally {
      saveBtn.disabled = false;
    }
  });

  async function handleChangePassword() {
    try {
      if (!currentUser) currentUser = await ensureUser();
      const email = emailInput.value || currentUser.email;
      if (!email) throw new Error("No email found for this account.");

      changePasswordBtns.forEach((btn) => {
        btn.disabled = true;
      });
      setStatus("Sending password reset email...", "loading");

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resolvePasswordRedirectUrl(),
      });
      if (error) throw error;

      setStatus("Password reset link sent to your email.", "success");
    } catch (e) {
      setStatus(`Password reset failed: ${e?.message || e}`, "error");
    } finally {
      changePasswordBtns.forEach((btn) => {
        btn.disabled = false;
      });
    }
  }

  changePasswordBtns.forEach((btn) => {
    btn.addEventListener("click", handleChangePassword);
  });

  loadProfile();
}


