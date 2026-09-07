import { supabase } from "./supabaseClient.js";

function getFileName(file) {
  if (!file) return "";
  return file.name || "profile";
}

function getInitials(nameOrEmail) {
  const raw = (nameOrEmail || "").trim();
  if (!raw) return "U";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function setAvatarFallback(avatarImg, labelSource) {
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

export function initProfilePanel() {
  const root = document.querySelector("[data-profile-root]");
  if (!root) return;

  // ── Build UI ──
  root.innerHTML = `
    <div class="worker-profile-page">
      <!-- Profile Photo Section -->
      <div class="card glass" style="padding:18px; margin-bottom:18px">
        <h3 class="h2" style="font-size:14px; margin:0 0 12px">Profile Photo</h3>

        <div class="profile-upload-row" style="display:flex; gap:18px; align-items:flex-start; flex-wrap:wrap">
          <div class="profile-preview" aria-label="Profile preview" style="width:80px; height:80px; border-radius:50%; overflow:hidden; border:2px solid rgba(255,255,255,.1); flex:0 0 auto;">
            <img id="profile-preview-img" src="" alt="Profile preview" style="width:100%; height:100%; object-fit:cover; display:block" />
          </div>

          <div class="profile-upload-controls" style="flex:1; min-width:200px">
            <label class="btn ghost" style="width: fit-content; cursor: pointer;">
              <input id="profile-photo-input" type="file" accept="image/*" style="display:none" />
              Choose Image
            </label>

            <div class="muted" style="font-size:12.5px; margin-top:8px">
              Uploads to Supabase Storage. Max 2MB.
            </div>

            <div class="profile-upload-actions" style="display:flex; gap:8px; margin-top:10px">
              <button class="btn primary" type="button" data-profile-upload>Upload</button>
              <button class="btn ghost" type="button" data-profile-remove>Remove</button>
            </div>

            <div id="profile-upload-status" class="muted" style="font-size:12px; margin-top:8px"></div>
          </div>
        </div>
      </div>

      <!-- Personal Information Section -->
      <div class="card glass" style="padding:18px; margin-bottom:18px">
        <h3 class="h2" style="font-size:14px; margin:0 0 4px">Personal Information</h3>
        <p class="muted" style="font-size:12.5px; margin-bottom:14px">Update your worker profile details below.</p>

        <div class="worker-profile-form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:14px">
          <div class="worker-profile-form-group" style="grid-column:1/-1">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px; color:var(--text)">Full Name <span style="color:#ef4444">*</span></label>
            <input type="text" id="wp-full-name" style="width:100%; padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.25); color:var(--text); font-size:14px" placeholder="Your full name" />
          </div>

          <div class="worker-profile-form-group">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px; color:var(--text)">Department <span style="color:#ef4444">*</span></label>
            <input type="text" id="wp-department" style="width:100%; padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.25); color:var(--text); font-size:14px" placeholder="e.g. Mining Operations" />
          </div>

          <div class="worker-profile-form-group">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px; color:var(--text)">Position <span style="color:#ef4444">*</span></label>
            <input type="text" id="wp-position" style="width:100%; padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.25); color:var(--text); font-size:14px" placeholder="e.g. Equipment Operator" />
          </div>

          <div class="worker-profile-form-group">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px; color:var(--text)">Phone</label>
            <input type="text" id="wp-phone" style="width:100%; padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.25); color:var(--text); font-size:14px" placeholder="+233 XX XXX XXXX" />
          </div>

          <div class="worker-profile-form-group">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px; color:var(--text)">Email (read-only)</label>
            <input type="text" id="wp-email" readonly style="width:100%; padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.15); color:var(--muted); font-size:14px; cursor:not-allowed" />
          </div>

          <div class="worker-profile-form-group" style="grid-column:1/-1">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px; color:var(--text)">Professional Bio <span style="color:#ef4444">*</span></label>
            <textarea id="wp-bio" rows="4" style="width:100%; padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.25); color:var(--text); font-size:14px; resize:vertical; font-family:inherit" placeholder="Brief description about yourself..."></textarea>
          </div>
        </div>

        <div class="worker-profile-actions" style="display:flex; gap:10px; margin-top:16px; justify-content:flex-end; border-top:1px solid rgba(255,255,255,.06); padding-top:16px">
          <button class="btn ghost" type="button" data-wp-discard>Discard Changes</button>
          <button class="btn primary" type="button" data-wp-save>💾 Save Changes</button>
        </div>

        <div id="wp-status" class="muted" style="font-size:12px; margin-top:10px"></div>
      </div>

      <!-- Account Info (read-only) -->
      <div class="card glass" style="padding:18px">
        <h3 class="h2" style="font-size:14px; margin:0 0 10px">Account Information</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px">
          <div><span style="opacity:.6">Role: </span><strong data-wp-field="role">—</strong></div>
          <div><span style="opacity:.6">Status: </span><strong data-wp-field="status">—</strong></div>
          <div><span style="opacity:.6">Employee ID: </span><strong data-wp-field="employee_id">—</strong></div>
          <div><span style="opacity:.6">Last Updated: </span><strong data-wp-field="updated_at">—</strong></div>
        </div>
      </div>
    </div>
  `;

  // ── DOM refs ──
  const img = root.querySelector("#profile-preview-img");
  const input = root.querySelector("#profile-photo-input");
  const uploadBtn = root.querySelector("[data-profile-upload]");
  const removeBtn = root.querySelector("[data-profile-remove]");
  const uploadStatus = root.querySelector("#profile-upload-status");

  const fullNameInput = root.querySelector("#wp-full-name");
  const deptInput = root.querySelector("#wp-department");
  const positionInput = root.querySelector("#wp-position");
  const phoneInput = root.querySelector("#wp-phone");
  const emailInput = root.querySelector("#wp-email");
  const bioInput = root.querySelector("#wp-bio");

  const saveBtn = root.querySelector("[data-wp-save]");
  const discardBtn = root.querySelector("[data-wp-discard]");
  const statusEl = root.querySelector("#wp-status");

  // ── State ──
  let selectedFile = null;
  let currentUser = null;
  let currentProfile = null;
  let uploadedAvatarUrl = "";
  let removedAvatar = false;

  // ── Helpers ──
  function setStatus(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.style.color = type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "var(--muted)";
  }

  function showToast(type, message) {
    window.dispatchEvent(
      new CustomEvent("enterprise-toast", {
        detail: { type, message },
      }),
    );
  }

  function getFormData() {
    return {
      full_name: fullNameInput?.value.trim() || "",
      department: deptInput?.value.trim() || "",
      position: positionInput?.value.trim() || "",
      phone: phoneInput?.value.trim() || "",
      bio: bioInput?.value.trim() || "",
    };
  }

  function validateForm(data) {
    if (!data.full_name) return "Full name is required.";
    if (!data.department) return "Department is required.";
    if (!data.position) return "Position is required.";
    if (!data.bio) return "Professional bio is required.";
    return null;
  }

  function syncIdentityUI(profile) {
    const name = profile.full_name || currentUser?.email || "Worker";
    const avatar = profile.avatar_url || uploadedAvatarUrl || "";

    // Sidebar
    const sidebarName = document.querySelector(".sidebar-profile h4");
    const sidebarDept = document.querySelector("[data-sidebar-department]");
    const sidebarAvatar = document.querySelector(".sidebar-profile .avatar");

    if (sidebarName) sidebarName.textContent = name;
    if (sidebarDept) sidebarDept.textContent = profile.department || "";

    if (sidebarAvatar) {
      if (avatar) {
        sidebarAvatar.innerHTML = `<img src="${avatar}" alt="Worker avatar" />`;
      } else {
        sidebarAvatar.innerHTML = '<div class="avatar-placeholder">👷</div>';
      }
    }

    // Enterprise topbar
    const topbarAvatar = document.querySelector(".enterprise-topbar-user .avatar");
    const topbarName = document.querySelector("[data-topbar-name]");
    const topbarRole = document.querySelector("[data-topbar-role]");
    const greetingH1 = document.querySelector(".enterprise-topbar-greeting h1");

    if (topbarAvatar) {
      if (avatar) {
        topbarAvatar.innerHTML = `<img src="${avatar}" alt="Worker avatar" />`;
      } else {
        topbarAvatar.innerHTML = '<div class="avatar-placeholder">👷</div>';
      }
    }
    if (topbarName) topbarName.textContent = name;
    if (topbarRole) topbarRole.textContent = profile.department || "Mining Operations";
    if (greetingH1) greetingH1.textContent = `Good Morning, ${name}`;
  }

  async function ensureUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error("Not signed in.");
    return user;
  }

  // ── Load existing profile ──
  async function loadProfile() {
    try {
      currentUser = await ensureUser();

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, employee_id, role, department, position, phone, bio, avatar_url, status, updated_at")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) throw error;
      if (!profile) throw new Error("Profile not found.");

      currentProfile = { ...profile };
      uploadedAvatarUrl = profile.avatar_url || "";

      // Avatar preview
      if (img) {
        if (profile.avatar_url) {
          img.src = profile.avatar_url;
          img.style.display = "block";
        } else {
          setAvatarFallback(img, profile.full_name || profile.email || currentUser.email);
        }
      }

      // Form fields
      if (fullNameInput) fullNameInput.value = profile.full_name || "";
      if (deptInput) deptInput.value = profile.department || "";
      if (positionInput) positionInput.value = profile.position || "";
      if (phoneInput) phoneInput.value = profile.phone || "";
      if (emailInput) emailInput.value = profile.email || currentUser.email || "";
      if (bioInput) bioInput.value = profile.bio || "";

      // Read-only fields
      const roleEl = root.querySelector('[data-wp-field="role"]');
      const statusElRO = root.querySelector('[data-wp-field="status"]');
      const empIdEl = root.querySelector('[data-wp-field="employee_id"]');
      const updatedEl = root.querySelector('[data-wp-field="updated_at"]');

      if (roleEl) roleEl.textContent = profile.role || "worker";
      if (statusElRO) statusElRO.textContent = profile.status || "Active";
      if (empIdEl) empIdEl.textContent = profile.employee_id || "—";
      if (updatedEl) updatedEl.textContent = profile.updated_at ? new Date(profile.updated_at).toLocaleString() : "—";

      setStatus("");
    } catch (e) {
      console.error("Failed to load worker profile:", e);
      setStatus(`Failed to load profile: ${e?.message || e}`, "error");
    }
  }

  // ── Upload / Remove avatar ──
  input?.addEventListener("change", () => {
    selectedFile = input.files && input.files[0] ? input.files[0] : null;
    if (selectedFile) {
      const previewUrl = URL.createObjectURL(selectedFile);
      if (img) img.src = previewUrl;
      uploadStatus.textContent = `Selected: ${getFileName(selectedFile)}`;
      removedAvatar = false;
    } else {
      if (img && currentProfile?.avatar_url) img.src = currentProfile.avatar_url;
      uploadStatus.textContent = "";
    }
  });

  uploadBtn?.addEventListener("click", async () => {
    if (!selectedFile) {
      uploadStatus.textContent = "Choose an image first.";
      return;
    }

    try {
      uploadBtn.disabled = true;
      uploadStatus.textContent = "Uploading...";

      const user = await ensureUser();
      const bucket = window.VAULTDESK_CONFIG?.PROFILE_IMAGE_BUCKET || "profile-images";

      const ext = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
      const objectPath = `profiles/${user.id}/avatar.${ext}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, selectedFile, {
          upsert: true,
          contentType: selectedFile.type || undefined,
        });

      if (error) throw error;

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      const avatarUrl = pub?.publicUrl || "";
      if (avatarUrl && img) img.src = avatarUrl;

      // Update the profiles table
      await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date() })
        .eq("id", user.id);

      uploadedAvatarUrl = avatarUrl;
      removedAvatar = false;

      // Sync UI
      syncIdentityUI({ ...currentProfile, avatar_url: avatarUrl });

      uploadStatus.textContent = "Uploaded!";
    } catch (e) {
      uploadStatus.textContent = `Upload failed: ${e?.message || e}`;
    } finally {
      uploadBtn.disabled = false;
    }
  });

  removeBtn?.addEventListener("click", async () => {
    try {
      removeBtn.disabled = true;
      uploadStatus.textContent = "Removing...";

      const user = await ensureUser();
      const bucket = window.VAULTDESK_CONFIG?.PROFILE_IMAGE_BUCKET || "profile-images";

      const prefix = `profiles/${user.id}/`;
      const { data: listed, error: listErr } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: 100 });

      if (listErr) throw listErr;

      const files = (listed || []).map((f) => f.name).filter(Boolean);
      const avatarFiles = files
        .filter((name) => name.startsWith("avatar."))
        .map((name) => `${prefix}${name}`);

      if (avatarFiles.length) {
        const { error } = await supabase.storage.from(bucket).remove(avatarFiles);
        if (error) throw error;
      }

      if (img) {
        setAvatarFallback(img, currentProfile?.full_name || currentUser?.email || "Worker");
      }
      input.value = "";
      selectedFile = null;
      uploadedAvatarUrl = "";
      removedAvatar = true;
      uploadStatus.textContent = "Removed.";
    } catch (e) {
      uploadStatus.textContent = `Remove failed: ${e?.message || e}`;
    } finally {
      removeBtn.disabled = false;
    }
  });

  // ── Save Changes ──
  saveBtn?.addEventListener("click", async () => {
    const formData = getFormData();
    const validationError = validateForm(formData);
    if (validationError) {
      setStatus(validationError, "error");
      return;
    }

    try {
      if (!currentUser) currentUser = await ensureUser();

      saveBtn.disabled = true;
      setStatus("Saving...", "loading");

      // Determine final avatar URL
      let finalAvatarUrl = uploadedAvatarUrl || currentProfile?.avatar_url || "";
      if (removedAvatar) {
        finalAvatarUrl = "";
      }

      const updates = {
        full_name: formData.full_name,
        department: formData.department,
        position: formData.position,
        phone: formData.phone,
        bio: formData.bio,
        avatar_url: finalAvatarUrl || null,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", currentUser.id);

      if (error) throw error;

      // Merge into currentProfile
      currentProfile = { ...currentProfile, ...updates };
      uploadedAvatarUrl = finalAvatarUrl;

      // Update window.currentWorker
      if (window.currentWorker) {
        window.currentWorker = { ...window.currentWorker, ...updates };
      }

      // Sync UI (sidebar, topbar, greeting)
      syncIdentityUI({
        ...currentProfile,
        full_name: formData.full_name,
        department: formData.department,
        avatar_url: finalAvatarUrl,
      });

      // Update readonly updated_at
      const updatedEl = root.querySelector('[data-wp-field="updated_at"]');
      if (updatedEl) updatedEl.textContent = new Date().toLocaleString();

      setStatus("Profile saved successfully!", "success");
      showToast("success", "Worker profile updated successfully.");
    } catch (e) {
      console.error("Failed to save worker profile:", e);
      setStatus(`Save failed: ${e?.message || e}`, "error");
      showToast("error", "Unable to update worker profile.");
    } finally {
      saveBtn.disabled = false;
    }
  });

  // ── Discard Changes ──
  discardBtn?.addEventListener("click", () => {
    if (!currentProfile) return;

    // Restore from currentProfile
    if (fullNameInput) fullNameInput.value = currentProfile.full_name || "";
    if (deptInput) deptInput.value = currentProfile.department || "";
    if (positionInput) positionInput.value = currentProfile.position || "";
    if (phoneInput) phoneInput.value = currentProfile.phone || "";
    if (bioInput) bioInput.value = currentProfile.bio || "";

    // Restore avatar
    if (img) {
      if (currentProfile.avatar_url) {
        img.src = currentProfile.avatar_url;
      } else {
        setAvatarFallback(img, currentProfile.full_name || currentUser?.email || "Worker");
      }
    }
    input.value = "";
    selectedFile = null;
    uploadedAvatarUrl = currentProfile.avatar_url || "";
    removedAvatar = false;

    setStatus("Changes discarded.", "neutral");
  });

  // ── Kick off ──
  loadProfile();
}

