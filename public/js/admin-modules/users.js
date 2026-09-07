import { supabase } from "../supabaseClient.js";

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return safeText(value);
  return d.toLocaleString();
}

function normalizeRole(role) {
  return safeText(role).trim().toLowerCase();
}

function roleLabel(role) {
  const r = safeText(role).trim();
  return r || "—";
}

function computeRoleKind(role) {
  const r = normalizeRole(role);
  // Keep logic tolerant: depending on how roles are stored, match common patterns.
  if (!r) return "worker";
  if (r.includes("admin") || r.includes("manager") || r.includes("super")) return "admin";
  return "worker";
}

function badgeClassForRole(role) {
  const kind = computeRoleKind(role);
  return kind === "admin" ? "user-role-badge admin" : "user-role-badge worker";
}

function badgeTextForStatus(status) {
  const s = safeText(status).trim();
  return s || "—";
}

function badgeClassForStatus(status) {
  const s = safeText(status).trim().toLowerCase();
  if (!s) return "user-status-badge";
  if (s.includes("active")) return "user-status-badge active";
  if (s.includes("disabled") || s.includes("inactive")) return "user-status-badge disabled";
  if (s.includes("pending")) return "user-status-badge pending";
  return "user-status-badge";
}

function isStatusActive(status) {
  const s = safeText(status).trim().toLowerCase();
  return s.includes("active");
}

function isStatusInactive(status) {
  const s = safeText(status).trim().toLowerCase();
  return s.includes("inactive") || s.includes("disabled");
}

function normalizeSupabaseUserId(userId) {
  return safeText(userId).trim();
}


function avatarHtml(avatarUrl, fullName, size = "table") {
  const url = safeText(avatarUrl).trim();
  const name = safeText(fullName).trim();

  const isTable = size === "table";
  const imgClass = isTable ? "user-table-avatar" : "user-details-avatar";
  const fallbackClass = isTable ? "user-table-avatar-fallback" : "user-details-avatar-fallback";

  if (url) {
    return `
      <img class="${imgClass}" src="${url}" alt="${name}" loading="lazy" onerror="this.onerror=null;this.src='./images/default-avatar.png';" />
    `;
  }

  const initials = name
    ? name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("")
    : "?";

  return `
    <div class="${fallbackClass}" aria-label="${name}">
      ${initials}
    </div>
  `;
}

function iconForKpi(title) {
  const t = safeText(title).toLowerCase();
  if (t.includes("total")) return "👥";
  if (t.includes("admin")) return "🛡️";
  if (t.includes("worker")) return "🧑‍💼";
  if (t.includes("depart")) return "🏢";
  return "✨";
}

function kpiColorClass(title) {
  const t = safeText(title).toLowerCase();
  if (t.includes("total")) return "purple";
  if (t.includes("admin")) return "blue";
  if (t.includes("worker")) return "green";
  if (t.includes("depart")) return "gold";
  return "purple";
}

function buildKpiCard(title, value, hint = "") {
  const hintHtml = hint ? `<div class="kpi-premium-sub">${hint}</div>` : "";
  const icon = iconForKpi(title);
  const colorCls = kpiColorClass(title);
  return `
    <div class="user-kpi-card-premium ${colorCls}" role="group" aria-label="${title}">
      <div class="kpi-premium-head">
        <div class="kpi-premium-icon" aria-hidden="true">${icon}</div>
        <span class="kpi-premium-trend neutral">● Live</span>
      </div>
      <div class="kpi-premium-value">${value}</div>
      <div class="kpi-premium-label">${title}</div>
      ${hintHtml}
    </div>
  `;
}


function buildUserRow(user) {
  const fullName = safeText(user.full_name, "");
  const employeeId = safeText(user.employee_id, "");
  const email = safeText(user.email, "");
  const department = safeText(user.department, "");
  const position = safeText(user.position, "");
  const role = roleLabel(user.role);
  const status = badgeTextForStatus(user.status);

  const roleKind = computeRoleKind(user.role);
  const statusLower = safeText(user.status).trim().toLowerCase();
  const statusCls = statusLower.includes("active") ? "active" : statusLower.includes("disabled") ? "disabled" : statusLower.includes("pending") ? "pending" : "inactive";

  return `
    <tr class="user-table-row" data-user-id="${safeText(user.id)}">
      <td>
        ${avatarHtml(user.avatar_url, fullName, "table")}
      </td>
      <td>
        <div class="user-table-name">${fullName || "—"}</div>
        <div class="user-table-email">${email || "—"}</div>
      </td>
      <td>${employeeId || "—"}</td>
      <td>${department || "—"}</td>
      <td>${position || "—"}</td>
      <td>
        <span class="user-badge-premium role-${roleKind}">${role}</span>
      </td>
      <td>
        <span class="user-badge-premium status-${statusCls}">${status}</span>
      </td>
      <td>
        <div class="user-actions-cell-premium" data-stop-propagation>
          <button type="button" class="user-action-btn-premium" disabled aria-label="View ${fullName || "user"}" title="View">👁</button>
          <button type="button" class="user-action-btn-premium" disabled aria-label="Edit ${fullName || "user"}" title="Edit">✏</button>
        </div>
      </td>
    </tr>
  `;
}


function buildDetailsPanel(user) {
  if (!user) {
    return `
    <div class="user-details-premium" id="user-details-panel">
        <div class="user-details-body" style="text-align:center;padding:32px 24px">
          <div class="user-empty-premium" style="padding:0">
            <div class="user-empty-premium-icon" aria-hidden="true">👤</div>
            <h3>User Profile</h3>
            <p>Select a user from the table to view their full profile information.</p>
          </div>
        </div>
      </div>
    `;
  }


  const fullName = safeText(user.full_name, "");
  const email = safeText(user.email, "");
  const employeeId = safeText(user.employee_id, "");
  const role = roleLabel(user.role);
  const department = safeText(user.department, "");
  const position = safeText(user.position, "");
  const phone = safeText(user.phone, "");
  const status = badgeTextForStatus(user.status);
  const createdAt = formatDate(user.created_at);
  const updatedAt = formatDate(user.updated_at);
  const roleKind = computeRoleKind(user.role);
  const statusLower = safeText(user.status).trim().toLowerCase();
  const statusCls = statusLower.includes("active") ? "active" : statusLower.includes("disabled") ? "disabled" : statusLower.includes("pending") ? "pending" : "inactive";

  return `
    <div class="user-details-premium" id="user-details-panel" data-user-details>
      <!-- Cover Header -->
      <div class="user-details-cover">
        <div class="user-details-avatar-wrap">
          ${avatarHtml(user.avatar_url, fullName, "details")}
          <div class="user-details-avatar-ring"></div>
        </div>
        <div class="user-details-identity">
          <h3>${fullName || "—"}</h3>
          <div class="user-details-meta-row">
            <span class="user-badge-premium role-${roleKind}">${role}</span>
            <span class="user-badge-premium status-${statusCls}">${status}</span>
          </div>
          <div class="user-details-avatar-actions" data-user-avatar-upload style="margin-top:10px">
            <input type="file" class="user-avatar-upload-input" accept="image/*" data-avatar-upload-input hidden />
            <button type="button" class="user-details-action-btn" data-avatar-upload-btn style="font-size:12px;padding:7px 14px">
              Upload Avatar
            </button>
            <div class="user-upload-status-premium" data-avatar-upload-status aria-live="polite"></div>
          </div>
        </div>
      </div>

      <!-- Detail Fields -->
      <div class="user-details-body">
        <div class="user-details-grid-premium">
          <div class="user-details-field">
            <span class="user-details-field-label">Employee ID</span>
            <span class="user-details-field-value">${employeeId || "—"}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">Email</span>
            <span class="user-details-field-value">${email || "—"}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">Department</span>
            <span class="user-details-field-value">${department || "—"}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">Position</span>
            <span class="user-details-field-value">${position || "—"}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">Phone</span>
            <span class="user-details-field-value">${phone || "—"}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">Role</span>
            <span class="user-details-field-value">${role}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">Status</span>
            <span class="user-details-field-value">${status}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">Created</span>
            <span class="user-details-field-value">${createdAt || "—"}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">Updated</span>
            <span class="user-details-field-value">${updatedAt || "—"}</span>
          </div>
          <div class="user-details-field">
            <span class="user-details-field-label">User ID</span>
            <span class="user-details-field-value">${safeText(user.id) || "—"}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="user-details-actions-premium" data-user-actions>
          <button class="user-details-action-btn user-details-action-btn--primary" type="button" data-action="edit-user" disabled>Edit User</button>
          <button class="user-details-action-btn" type="button" data-action="reset-password" disabled>Reset Password</button>
          <div class="user-status-toggle-wrap" style="display:flex;align-items:center;gap:10px;margin-left:auto">
            <button class="user-details-action-btn user-details-action-btn--danger user-status-toggle-btn" type="button" data-action="toggle-account" disabled>Disable Account</button>
            <div class="user-status-toggle-helper" data-user-status-helper hidden style="font-size:12px;color:#fca5a5">You cannot disable your own administrator account.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}


export async function loadUsers() {
  const box = document.getElementById("admin-users");
  if (!box) return;

  // Edit User modal is scoped to the Users page instance.
  const openEditUserModal = (selectedUser) => {

    if (!selectedUser) return;

    // Ensure modal host exists (same host pattern as create-user)
    let host = box.querySelector("#edit-user-modal-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "edit-user-modal-host";
      box.appendChild(host);
    }

    const buildEditUserModalHtml = () => {
      return `
        <div class="edit-user-overlay" role="presentation" data-edit-user-overlay>
          <div class="edit-user-modal" role="dialog" aria-modal="true" aria-label="Edit user">
            <div class="edit-user-header">
              <div>
                <h3 class="edit-user-title">Edit User</h3>
                <div class="edit-user-subtitle muted">Update enterprise profile information</div>
              </div>
              <button type="button" class="edit-user-close" aria-label="Close" data-edit-user-close>✕</button>
            </div>

            <div class="edit-user-body">
              <form class="edit-user-form" data-edit-user-form>
                <div class="edit-user-global-error" data-edit-user-global-error role="alert" aria-live="polite" hidden></div>

                <div class="edit-user-grid">
                  <div class="edit-user-section">
                    <h4 class="edit-user-section-title">Profile</h4>

                    <div class="edit-user-form-group">
                      <label>
                        <span>Full Name</span>
                        <input type="text" name="full_name" autocomplete="name" required />
                      </label>
                      <div class="edit-user-inline-error" data-edit-user-error-for="full_name" aria-live="polite"></div>
                    </div>

                    <div class="edit-user-form-group">
                      <label>
                        <span>Department</span>
                        <input type="text" name="department" autocomplete="organization" />
                      </label>
                      <div class="edit-user-inline-error" data-edit-user-error-for="department" aria-live="polite"></div>
                    </div>

                    <div class="edit-user-form-group">
                      <label>
                        <span>Position</span>
                        <input type="text" name="position" autocomplete="organization-title" />
                      </label>
                      <div class="edit-user-inline-error" data-edit-user-error-for="position" aria-live="polite"></div>
                    </div>

                    <div class="edit-user-form-group">
                      <label>
                        <span>Phone</span>
                        <input type="tel" name="phone" autocomplete="tel" />
                      </label>
                      <div class="edit-user-inline-error" data-edit-user-error-for="phone" aria-live="polite"></div>
                    </div>
                  </div>

                  <div class="edit-user-section edit-user-section-right">
                    <h4 class="edit-user-section-title">Account</h4>

                    <div class="edit-user-form-group">
                      <label>
                        <span>Role</span>
                        <select name="role" required>
                          <option value="admin">admin</option>
                          <option value="supervisor">supervisor</option>
                          <option value="worker">worker</option>
                        </select>
                      </label>
                      <div class="edit-user-inline-error" data-edit-user-error-for="role" aria-live="polite"></div>
                    </div>

                    <div class="edit-user-form-group">
                      <label>
                        <span>Status</span>
                        <select name="status" required>
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                          <option value="disabled">disabled</option>
                          <option value="pending">pending</option>
                        </select>
                      </label>
                      <div class="edit-user-inline-error" data-edit-user-error-for="status" aria-live="polite"></div>
                    </div>

                    <div class="edit-user-readonly-group">
                      <div class="edit-user-readonly-item">
                        <span class="edit-user-readonly-label">Email</span>
                        <input type="text" disabled name="email" value="${safeText(selectedUser.email)}" />
                      </div>
                      <div class="edit-user-readonly-item">
                        <span class="edit-user-readonly-label">Employee ID</span>
                        <input type="text" disabled name="employee_id" value="${safeText(selectedUser.employee_id)}" />
                      </div>
                      <div class="edit-user-readonly-item">
                        <span class="edit-user-readonly-label">User ID</span>
                        <input type="text" disabled name="id" value="${safeText(selectedUser.id)}" />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div class="edit-user-actions">
              <button type="button" class="edit-user-button" data-edit-user-cancel>Cancel</button>
              <button type="button" class="edit-user-submit" data-edit-user-submit>
                Save
              </button>
            </div>
          </div>
        </div>
      `;
    };

    host.innerHTML = buildEditUserModalHtml();

    const overlay = host.querySelector("[data-edit-user-overlay]");
    const closeBtn = host.querySelector("[data-edit-user-close]");
    const cancelBtn = host.querySelector("[data-edit-user-cancel]");
    const submitBtn = host.querySelector("[data-edit-user-submit]");

    const form = host.querySelector("[data-edit-user-form]");
    const globalErrorEl = host.querySelector("[data-edit-user-global-error]");

    const setGlobalError = (msg) => {
      if (!globalErrorEl) return;
      if (!msg) {
        globalErrorEl.hidden = true;
        globalErrorEl.textContent = "";
        return;
      }
      globalErrorEl.hidden = false;
      globalErrorEl.textContent = msg;
    };

    const setInlineError = (field, msg) => {
      const el = host.querySelector(`[data-edit-user-error-for="${field}"]`);
      if (el) el.textContent = msg || "";
    };

    const clearInlineErrors = () => {
      host.querySelectorAll("[data-edit-user-error-for]").forEach((el) => {
        el.textContent = "";
      });
    };

    // Prefill editable fields
    const fullNameInput = host.querySelector('input[name="full_name"]');
    const deptInput = host.querySelector('input[name="department"]');
    const positionInput = host.querySelector('input[name="position"]');
    const phoneInput = host.querySelector('input[name="phone"]');
    const roleSelect = host.querySelector('select[name="role"]');
    const statusSelect = host.querySelector('select[name="status"]');

    if (fullNameInput) fullNameInput.value = safeText(selectedUser.full_name);
    if (deptInput) deptInput.value = safeText(selectedUser.department);
    if (positionInput) positionInput.value = safeText(selectedUser.position);
    if (phoneInput) phoneInput.value = safeText(selectedUser.phone);
    if (roleSelect) roleSelect.value = safeText(selectedUser.role);
    if (statusSelect) statusSelect.value = safeText(selectedUser.status);

    // focus
    const firstEditable = host.querySelector("input:not([disabled]), select:not([disabled])");
    if (firstEditable) firstEditable.focus();

    const escHandler = (e) => {
      if (e.key === "Escape") closeModal();
    };

    const closeModal = () => {
      host.innerHTML = "";
      document.removeEventListener("keydown", escHandler);
    };

    document.addEventListener("keydown", escHandler);

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    const getFormValues = () => {
      const fd = new FormData(form);
      return {
        full_name: safeText(fd.get("full_name")),
        department: safeText(fd.get("department")),
        position: safeText(fd.get("position")),
        phone: safeText(fd.get("phone")),
        role: safeText(fd.get("role")),
        status: safeText(fd.get("status")),
      };
    };

    const validate = ({ full_name, role }) => {
      const errors = {};
      if (!safeText(full_name).trim()) errors.full_name = "Full Name is required.";
      if (!safeText(role).trim()) errors.role = "Role is required.";
      return errors;
    };

    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        if (submitBtn.disabled) return;

        clearInlineErrors();
        setGlobalError("");

        const values = getFormValues();
        const requiredValidation = validate(values);

        if (Object.keys(requiredValidation).length > 0) {
          for (const [k, v] of Object.entries(requiredValidation)) setInlineError(k, v);
          return;
        }

        const prevText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        try {
          const { error } = await supabase
            .from("profiles")
            .update({
              full_name: values.full_name,
              department: values.department,
              position: values.position,
              phone: values.phone,
              role: values.role,
              status: values.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", selectedUser.id);

          if (error) throw error;

          // Success notification
          window.dispatchEvent(
            new CustomEvent("enterprise-toast", {
              detail: { type: "success", message: "User updated successfully." },
            })
          );

          // Close modal
          closeModal();

          // Reload users + refresh details immediately without requiring re-click
          await loadUsers();

          // Preserve selection in details panel using updated users list.
          // Wait a tick for loadUsers to finish rendering.
          setTimeout(() => {
            try {
              // Preserve selection by re-selecting the updated user in the table.
              const refreshedBox = document.getElementById("admin-users");
              const refreshedRow = refreshedBox?.querySelector(
                `tr.user-table-row[data-user-id="${safeText(selectedUser.id)}"]`
              );
              if (refreshedRow) {
                refreshedRow.click();
                return;
              }
              // Fallback: if row isn't present (filters/search), rebuild details from freshly loaded users.
              const refreshedUsers = users;
              const refreshedUser = refreshedUsers.find((u) => safeText(u.id) === safeText(selectedUser.id));
              if (refreshedUser) detailsHost.innerHTML = buildDetailsPanel(refreshedUser);
            } catch (e) {
              // no-op; details refresh failure should not break UX
            }
          }, 0);

        } catch (err) {
          const errMsg = err?.message ? String(err.message) : String(err);
          setGlobalError("Failed to update user profile. Please try again.");

          window.dispatchEvent(
            new CustomEvent("enterprise-toast", {
              detail: { type: "error", message: "User update failed." },
            })
          );
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = prevText;
        }
      });
    }
  };


  box.innerHTML = `
    <!-- Premium Enterprise Header -->
    <div class="user-enterprise-header">
      <div class="user-enterprise-header-left">
        <div class="user-enterprise-header-icon">👥</div>
        <div class="user-enterprise-header-text">
          <h2>Users</h2>
          <p>Manage enterprise users from a single dashboard. View, edit, and control access.</p>
        </div>
      </div>
      <div class="user-enterprise-header-right">
        <button type="button" class="user-enterprise-header-btn user-enterprise-header-btn--icon" id="refresh-users-btn" aria-label="Refresh users" title="Refresh">↻</button>
        <button type="button" class="user-enterprise-header-btn user-enterprise-header-btn--primary" id="user-new-user-btn">+ New User</button>
      </div>
    </div>

    <!-- Premium KPI Grid -->
    <div class="user-kpi-grid-premium" id="user-kpi-grid"></div>

    <!-- Filters Row -->
    <div style="display:flex;align-items:center;gap:12px;margin:14px 0;flex-wrap:wrap">
      <div style="flex:1;min-width:200px;position:relative">
        <input id="user-search-input" type="search" placeholder="Search by name, email, employee ID, department..." style="width:100%;padding:10px 14px 10px 38px;border-radius:var(--radius-md,12px);border:1px solid var(--border-input,rgba(255,255,255,.12));background:var(--input-bg,rgba(15,23,42,.6));color:var(--text-primary,#F8FAFC);font-size:14px;outline:none" />
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted,#64748B);font-size:16px;pointer-events:none">🔍</span>
      </div>
      <select id="user-department-filter" style="padding:10px 14px;border-radius:var(--radius-md,12px);border:1px solid var(--border-input,rgba(255,255,255,.12));background:var(--input-bg,rgba(15,23,42,.6));color:var(--text-primary,#F8FAFC);font-size:13px;outline:none;min-width:150px">
        <option value="">All Departments</option>
      </select>
      <select id="user-status-filter" style="padding:10px 14px;border-radius:var(--radius-md,12px);border:1px solid var(--border-input,rgba(255,255,255,.12));background:var(--input-bg,rgba(15,23,42,.6));color:var(--text-primary,#F8FAFC);font-size:13px;outline:none;min-width:130px">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="disabled">Disabled</option>
        <option value="pending">Pending</option>
      </select>
    </div>

    <!-- Premium Table -->
    <div class="user-table-container-premium">
      <table class="user-table-premium" aria-label="Enterprise users">
        <thead>
          <tr>
            <th style="width:60px">Avatar</th>
            <th>Full Name</th>
            <th>Employee ID</th>
            <th>Department</th>
            <th>Position</th>
            <th>Role</th>
            <th>Status</th>
            <th style="width:100px">Actions</th>
          </tr>
        </thead>
        <tbody id="user-table-body"></tbody>
      </table>
    </div>

    <div id="user-details-host" class="user-details-host"></div>
  `;


  const kpiGrid = box.querySelector("#user-kpi-grid");
  const tableBody = box.querySelector("#user-table-body");
  const detailsHost = box.querySelector("#user-details-host");
  const searchInput = box.querySelector("#user-search-input");

  const refreshBtn = box.querySelector("#refresh-users-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadUsers();
    });
  }


  // Phase 3.3B.1: Create User UI-only modal wiring (no Supabase / no edge calls)
  const userNewBtn = box.querySelector("#user-new-user-btn");

  const ensureCreateUserModalHost = () => {
    // Render modal inside the Users page (per requirement)
    let host = box.querySelector("#create-user-modal-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "create-user-modal-host";
      box.appendChild(host);
    }
    return host;
  };

  const buildCreateUserModalHtml = () => {
    return `
      <div class="create-user-overlay" role="presentation" data-create-user-overlay>
        <div class="create-user-modal" role="dialog" aria-modal="true" aria-label="Create user">
          <div class="create-user-header">
            <div>
              <h3 class="create-user-title">Create User</h3>
              <div class="create-user-subtitle muted">Enterprise account provisioning (UI only)</div>
            </div>
            <button type="button" class="create-user-close" aria-label="Close" data-create-user-close>✕</button>
          </div>

          <div class="create-user-body">
            <form class="create-user-form" data-create-user-form>
              <div class="create-user-global-error" data-create-user-global-error role="alert" aria-live="polite" hidden></div>

              <div class="create-user-grid">
                <div class="create-user-section">
                  <h4 class="create-user-section-title">Personal Information</h4>

                  <div class="create-user-form-group">
                    <label>
                      <span>Full Name</span>
                      <input type="text" name="full_name" autocomplete="name" placeholder="e.g., Jane Doe" required />
                    </label>
                    <div class="create-user-inline-error" data-create-user-error-for="full_name" aria-live="polite"></div>
                  </div>

                  <div class="create-user-form-group">
                    <label>
                      <span>Email</span>
                      <input type="email" name="email" autocomplete="email" placeholder="you@company.com" required />
                    </label>
                    <div class="create-user-inline-error" data-create-user-error-for="email" aria-live="polite"></div>
                  </div>

                  <div class="create-user-form-group">
                    <label>
                      <span>Password</span>
                      <input type="password" name="password" autocomplete="new-password" placeholder="••••••••" required />
                    </label>
                    <div class="create-user-inline-error" data-create-user-error-for="password" aria-live="polite"></div>
                  </div>
                </div>

                <div class="create-user-section">
                  <h4 class="create-user-section-title">Employment Information</h4>

                  <div class="create-user-form-group">
                    <label>
                      <span>Employee ID</span>
                      <input type="text" name="employee_id" autocomplete="off" placeholder="e.g., EMP-1024" required />
                    </label>
                    <div class="create-user-inline-error" data-create-user-error-for="employee_id" aria-live="polite"></div>
                  </div>

                  <div class="create-user-form-group">
                    <label>
                      <span>Department</span>
                      <input type="text" name="department" autocomplete="organization" placeholder="e.g., Operations" required />
                    </label>
                    <div class="create-user-inline-error" data-create-user-error-for="department" aria-live="polite"></div>
                  </div>

                  <div class="create-user-form-group">
                    <label>
                      <span>Position</span>
                      <input type="text" name="position" autocomplete="organization-title" placeholder="e.g., Shift Supervisor" required />
                    </label>
                    <div class="create-user-inline-error" data-create-user-error-for="position" aria-live="polite"></div>
                  </div>

                  <div class="create-user-form-group">
                    <label>
                      <span>Phone</span>
                      <input type="tel" name="phone" autocomplete="tel" placeholder="e.g., +1 555 0123" />
                    </label>
                    <div class="create-user-inline-error" data-create-user-error-for="phone" aria-live="polite"></div>
                  </div>
                </div>

                <div class="create-user-section create-user-section-full">
                  <h4 class="create-user-section-title">Account Information</h4>

                  <div class="create-user-account-grid">
                    <div class="create-user-form-group">
                      <label>
                        <span>Role</span>
                        <select name="role" required>
                          <option value="admin">admin</option>
                          <option value="supervisor">supervisor</option>
                          <option value="worker">worker</option>
                        </select>
                      </label>
                      <div class="create-user-inline-error" data-create-user-error-for="role" aria-live="polite"></div>
                    </div>

                    <div class="create-user-form-group">
                      <label>
                        <span>Status</span>
                        <select name="status" required>
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </label>
                      <div class="create-user-inline-error" data-create-user-error-for="status" aria-live="polite"></div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>


          <div class="create-user-actions">
            <button type="button" class="create-user-button" data-create-user-cancel>Cancel</button>
            <button type="button" class="create-user-submit" data-create-user-submit>
              Create User
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const openCreateUserModal = () => {
    const host = ensureCreateUserModalHost();
    host.innerHTML = buildCreateUserModalHtml();

    const overlay = host.querySelector("[data-create-user-overlay]");
    const closeBtn = host.querySelector("[data-create-user-close]");
    const cancelBtn = host.querySelector("[data-create-user-cancel]");
    const submitBtn = host.querySelector("[data-create-user-submit]");

    // Initial focus for accessibility
    const firstInput = host.querySelector("input, select");
    if (firstInput) firstInput.focus();

    const escHandler = (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };

    const closeModal = () => {
      host.innerHTML = "";
      if (userNewBtn) userNewBtn.focus();
      document.removeEventListener("keydown", escHandler);
    };

    document.addEventListener("keydown", escHandler);

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    const form = host.querySelector("[data-create-user-form]");
    const globalErrorEl = host.querySelector("[data-create-user-global-error]");

    const setGlobalError = (msg) => {
      if (!globalErrorEl) return;
      if (!msg) {
        globalErrorEl.hidden = true;
        globalErrorEl.textContent = "";
        return;
      }
      globalErrorEl.hidden = false;
      globalErrorEl.textContent = msg;
    };

    const clearInlineErrors = () => {
      host.querySelectorAll("[data-create-user-error-for]").forEach((el) => {
        el.textContent = "";
      });
    };

    const setInlineError = (field, msg) => {
      const el = host.querySelector(`[data-create-user-error-for="${field}"]`);
      if (el) el.textContent = msg || "";
    };

    const validate = ({ full_name, email, password, employee_id, role }) => {
      const errors = {};

      if (!safeText(full_name).trim()) errors.full_name = "Full Name is required.";
      if (!safeText(email).trim()) errors.email = "Email is required.";
      if (!safeText(password).trim()) errors.password = "Password is required.";
      if (!safeText(employee_id).trim()) errors.employee_id = "Employee ID is required.";
      if (!safeText(role).trim()) errors.role = "Role is required.";

      const emailVal = safeText(email).trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
      if (emailVal && !emailOk) errors.email = "Enter a valid email address.";

      const passVal = safeText(password);
      if (passVal && passVal.length < 8) errors.password = "Password must be at least 8 characters.";

      const empVal = safeText(employee_id).trim();
      if (empVal !== "" && !empVal) errors.employee_id = "Employee ID cannot be empty.";

      return errors;
    };

    const getFormValues = () => {
      const fd = new FormData(form);
      return {
        full_name: safeText(fd.get("full_name")),
        email: safeText(fd.get("email")),
        password: safeText(fd.get("password")),
        employee_id: safeText(fd.get("employee_id")),
        department: safeText(fd.get("department")),
        position: safeText(fd.get("position")),
        phone: safeText(fd.get("phone")),
        role: safeText(fd.get("role")),
        status: safeText(fd.get("status")),
      };
    };

    // Submit handler
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        if (submitBtn.disabled) return;

        clearInlineErrors();
        setGlobalError("");

        const values = getFormValues();
        const requiredValidation = validate(values);

        if (Object.keys(requiredValidation).length > 0) {
          for (const [k, v] of Object.entries(requiredValidation)) {
            setInlineError(k, v);
          }
          return;
        }

        const previousText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating User...";

        try {
          const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
            "create-user",
            {
              body: {
                full_name: values.full_name,
                email: values.email,
                password: values.password,
                employee_id: values.employee_id,
                department: values.department,
                position: values.position,
                phone: values.phone,
                role: values.role,
                status: values.status,
              },
            }
          );

          if (invokeError) throw invokeError;

          // Enterprise success notification
          // Prefer global toast system if present; otherwise fall back to inline DOM.
          const msg = "User created successfully.";
          if (window?.dispatchEvent) {
            window.dispatchEvent(new CustomEvent("enterprise-toast", { detail: { type: "success", message: msg } }));
          }

          // Close modal + reset + refresh
          closeModal();
          clearInlineErrors();
          form?.reset();
          await loadUsers();
        } catch (err) {
          const errMsg = err?.message ? String(err.message) : String(err);
          setGlobalError("Failed to create user. Please check the form and try again.");

          // Try to map common edge failures to inline hints.
          const lower = errMsg.toLowerCase();
          if (lower.includes("email") && lower.includes("exists")) setInlineError("email", "Email already exists.");
          if (lower.includes("employee") && lower.includes("exists")) setInlineError("employee_id", "Employee ID already exists.");
          if (lower.includes("invalid role")) setInlineError("role", "Invalid role.");

          if (window?.dispatchEvent) {
            window.dispatchEvent(
              new CustomEvent("enterprise-toast", { detail: { type: "error", message: "User creation failed." } })
            );
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = previousText;
        }
      });
    }

  };

  if (userNewBtn) {
    userNewBtn.addEventListener("click", openCreateUserModal);
  }

  detailsHost.innerHTML = buildDetailsPanel(null);

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id, full_name, email, employee_id, role, department, position, phone, status, avatar_url, created_at, updated_at`
    )
    .order("full_name", { ascending: true });

  if (error) {
    box.innerHTML = `<div class="card glass">Unable to load users: ${safeText(error.message, "Unknown error")}</div>`;
    return;
  }

  const users = Array.isArray(data) ? data : [];

  const totalUsers = users.length;
  const administrators = users.filter((u) => computeRoleKind(u.role) === "admin").length;
  const workers = users.filter((u) => computeRoleKind(u.role) === "worker").length;
  const departments = new Set(users.map((u) => safeText(u.department).trim()).filter(Boolean));
  const totalDepartments = departments.size;

  const departmentFilter = box.querySelector("#user-department-filter");
  if (departmentFilter) {
    const opts = Array.from(departments).sort((a, b) => a.localeCompare(b));
    departmentFilter.innerHTML = `<option value="">All</option>` + opts.map((d) => `<option value="${d}">${d}</option>`).join("");
  }

  kpiGrid.innerHTML = [
    buildKpiCard("Total Users", totalUsers),
    buildKpiCard("Administrators", administrators),
    buildKpiCard("Workers", workers),
    buildKpiCard("Departments", totalDepartments),
  ].join("");

  const renderEmptyState = () => {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="padding:22px;">
          <div class="user-empty-premium" role="status">
            <div class="user-empty-premium-icon" aria-hidden="true">👥</div>
            <h3>No users found</h3>
            <p>Try changing your filters or search criteria.</p>
          </div>
        </td>
      </tr>
    `;
  };

  // Render table rows
  const renderRows = (rows) => {
    if (!rows || rows.length === 0) {
      renderEmptyState();
      return;
    }
    tableBody.innerHTML = rows.map((u) => buildUserRow(u)).join("");
  };

  renderRows(users);


  const selectUserById = (id) => {
    const user = users.find((u) => safeText(u.id) === safeText(id));

    const avatarUploadBtn = detailsHost?.querySelector('[data-avatar-upload-btn]');
    const avatarUploadInput = detailsHost?.querySelector('[data-avatar-upload-input]');
    const avatarUploadStatus = detailsHost?.querySelector('[data-avatar-upload-status]');


    const setUploadStatus = (msg) => {
      if (!avatarUploadStatus) return;
      avatarUploadStatus.textContent = msg || '';
    };

    const resetUploadStatus = () => setUploadStatus('');

    if (avatarUploadBtn && avatarUploadInput) {
      // Disable controls when no user selected
      avatarUploadBtn.disabled = !user;

      // Clear previous listeners by replacing handlers
      avatarUploadInput.onchange = async () => {
        resetUploadStatus();

        if (!avatarUploadInput.files || avatarUploadInput.files.length === 0) {
          setUploadStatus('No file selected.');
          return;
        }

        const file = avatarUploadInput.files[0];
        if (!file) {
          setUploadStatus('No file selected.');
          return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const maxBytes = 2 * 1024 * 1024;

        // Validate
        if (file.type && !allowedTypes.includes(file.type)) {
          setUploadStatus('Unsupported file type. Use JPG, PNG, WEBP, or GIF.');
          avatarUploadInput.value = '';
          return;
        }
        if (file.size > maxBytes) {
          setUploadStatus('File too large. Max size is 2MB.');
          avatarUploadInput.value = '';
          return;
        }

        // Disable controls while uploading
        const prevBtnText = avatarUploadBtn.textContent;
        avatarUploadBtn.disabled = true;
        avatarUploadInput.disabled = true;
        avatarUploadBtn.textContent = 'Uploading...';

        const setErrorStatus = (msg) => setUploadStatus(msg);
        const setSuccessStatus = (msg) => setUploadStatus(msg);

        try {
          const profileId = safeText(user?.id).trim() || safeText(selectedUserId).trim();
          if (!profileId) {
            setErrorStatus('User ID missing for upload.');
            throw new Error('Missing profileId for avatar upload');
          }

          const ts = Date.now();
          const originalName = safeText(file.name, 'avatar');
          const sanitizedFileName = originalName
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 120);

          const storagePath = `avatars/${profileId}/${ts}-${sanitizedFileName}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(storagePath);

          const publicUrl = publicUrlData?.publicUrl;
          if (!publicUrl) throw new Error('Unable to resolve public URL for uploaded avatar.');

          const { error: dbError } = await supabase
            .from('profiles')
            .update({
              avatar_url: publicUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', profileId);

          if (dbError) throw dbError;

          setSuccessStatus('Avatar uploaded successfully.');

          window.dispatchEvent(
            new CustomEvent('enterprise-toast', {
              detail: { type: 'success', message: 'Avatar updated successfully.' },
            })
          );

          await loadUsers();

          setTimeout(() => {
            try {
              const refreshedBox = document.getElementById('admin-users');
              const refreshedRow = refreshedBox?.querySelector(
                `tr.user-table-row[data-user-id="${profileId}"]`
              );
              if (refreshedRow) refreshedRow.click();
            } catch (e) {
              // no-op
            }
          }, 0);

        } catch (err) {
          setErrorStatus('Avatar upload failed. Please try again.');

          window.dispatchEvent(
            new CustomEvent('enterprise-toast', {
              detail: { type: 'error', message: 'Avatar upload failed.' },
            })
          );
        } finally {
          avatarUploadBtn.disabled = !user;
          avatarUploadInput.disabled = false;
          avatarUploadBtn.textContent = prevBtnText || 'Upload Avatar';
        }
      };

      avatarUploadBtn.onclick = () => {
        resetUploadStatus();
        if (!avatarUploadInput || avatarUploadBtn.disabled) return;
        avatarUploadInput.click();
      };
    }


    // Keep reference for toggle/protection logic.
    const selectedUserId = safeText(user?.id);

    detailsHost.innerHTML = buildDetailsPanel(user || null);

    // Enable Edit button only when a user is selected
    const editBtn = detailsHost.querySelector('[data-action="edit-user"]');
    if (editBtn) editBtn.disabled = !user;

    // Wire edit button each time details panel re-renders (prevent stacking listeners)
    if (editBtn && user) {
      editBtn.onclick = () => {
        openEditUserModal(user);
      };
    }

    // Phase 3.3D: status toggle button wiring + UI updates
    const toggleBtn = detailsHost.querySelector('[data-action="toggle-account"]');
    const helperEl = detailsHost.querySelector('[data-user-status-helper]');

    // Resolve currently authenticated user id (best-effort from auth.js / session)
    let currentUserId = "";
    try {
      if (window?.auth?.user?.id) currentUserId = safeText(window.auth.user.id);
      if (!currentUserId && window?.currentUser?.id) currentUserId = safeText(window.currentUser.id);
    } catch (e) {
      // no-op
    }

    if (!toggleBtn) return;

    if (!user) {
      toggleBtn.disabled = true;
      if (helperEl) helperEl.classList.add('hidden');
      return;
    }

    const isActive = isStatusActive(user.status);
    const isInactive = isStatusInactive(user.status);

    // Button label should update automatically.
    if (isActive) {
      toggleBtn.textContent = "Disable Account";
      toggleBtn.dataset.targetStatus = "inactive";
      toggleBtn.classList.add('danger');
    } else if (isInactive) {
      toggleBtn.textContent = "Enable Account";
      toggleBtn.dataset.targetStatus = "active";
      toggleBtn.classList.remove('danger');
    } else {
      // Unknown/other statuses: default to disabling behavior.
      toggleBtn.textContent = "Disable Account";
      toggleBtn.dataset.targetStatus = "inactive";
      toggleBtn.classList.add('danger');
    }

    const isSelf = currentUserId && selectedUserId && safeText(selectedUserId) === safeText(currentUserId);
    if (isSelf) {
      toggleBtn.disabled = true;
      if (helperEl) helperEl.classList.remove('hidden');
      toggleBtn.onclick = null;
      return;
    }

    if (helperEl) helperEl.classList.add('hidden');

    toggleBtn.disabled = false;

    toggleBtn.onclick = async () => {
      const targetStatus = safeText(toggleBtn.dataset.targetStatus);
      const nextStatus = targetStatus.includes('active') ? 'active' : 'inactive';
      const isEnabling = nextStatus === 'active';

      const modalHost = document.getElementById('enterprise-confirmation-modal-host');
      let host = modalHost;
      if (!host) {
        host = document.createElement('div');
        host.id = 'enterprise-confirmation-modal-host';
        document.body.appendChild(host);
      }

      const closeModal = () => {
        if (!host) return;
        host.innerHTML = '';
      };

      const msg = isEnabling
        ? 'Are you sure you want to enable this account?'
        : 'Are you sure you want to disable this account?';

      const overlay = document.createElement('div');
      overlay.className = 'enterprise-confirmation-overlay';
      overlay.innerHTML = `
        <div class="enterprise-confirmation-modal" role="dialog" aria-modal="true" aria-label="Confirm action">
          <div class="enterprise-confirmation-header">
            <h3>Confirm</h3>
            <button type="button" class="enterprise-confirmation-close" aria-label="Close" data-enterprise-confirm-close>✕</button>
          </div>
          <div class="enterprise-confirmation-body">
            <p class="enterprise-confirmation-message">${msg}</p>
          </div>
          <div class="enterprise-confirmation-actions">
            <button type="button" class="enterprise-confirmation-btn enterprise-confirmation-cancel" data-enterprise-cancel>Cancel</button>
            <button type="button" class="enterprise-confirmation-btn enterprise-confirmation-confirm" data-enterprise-confirm>Confirm</button>
          </div>
        </div>
      `;

      host.innerHTML = '';
      host.appendChild(overlay);

      const cancelBtn = host.querySelector('[data-enterprise-cancel]');
      const confirmBtn = host.querySelector('[data-enterprise-confirm]');
      const closeBtn = host.querySelector('[data-enterprise-confirm-close]');

      const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', escHandler);

      const cleanup = () => document.removeEventListener('keydown', escHandler);

      const onCancel = () => {
        cleanup();
        closeModal();
      };

      cancelBtn?.addEventListener('click', onCancel);
      closeBtn?.addEventListener('click', onCancel);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) onCancel();
      });

      confirmBtn?.addEventListener('click', async () => {
        if (!confirmBtn || confirmBtn.disabled) return;

        confirmBtn.disabled = true;
        const prevText = confirmBtn.textContent;
        confirmBtn.textContent = 'Updating...';

        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              status: nextStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', selectedUserId);

          if (error) throw error;

          window.dispatchEvent(
            new CustomEvent('enterprise-toast', {
              detail: { type: 'success', message: isEnabling ? 'User account enabled.' : 'User account disabled.' },
            })
          );

          // Close modal
          cleanup();
          closeModal();

          // Preserve current selection through refresh
          const refreshedId = selectedUserId;
          await loadUsers();

          setTimeout(() => {
            try {
              const refreshed = document.getElementById('admin-users');
              const refreshedUsersModuleHost = refreshed;
              // Re-select same user so details + button update immediately.
              const row = refreshedUsersModuleHost?.querySelector(`tr.user-table-row[data-user-id="${refreshedId}"]`);
              if (row) {
                row.click();
              } else {
                // Fallback: if row not in DOM due to filters, force details refresh.
                selectUserById(refreshedId);

              }
            } catch (e) {
              // no-op
            }
          }, 0);
        } catch (err) {
          const errMsg = err?.message ? String(err.message) : String(err);
          window.dispatchEvent(
            new CustomEvent('enterprise-toast', {
              detail: { type: 'error', message: 'User account update failed.' },
            })
          );

          // Re-enable
          confirmBtn.disabled = false;
          confirmBtn.textContent = prevText;
        }
      });
    };
  };



  // Row click -> details (keep action buttons non-interactive placeholders)
  tableBody.addEventListener("click", (e) => {
    const actionCell = e.target.closest("[data-stop-propagation]");
    if (actionCell) return;

    const tr = e.target.closest("tr.user-table-row");
    if (!tr) return;
    selectUserById(tr.getAttribute("data-user-id"));
  });


  const getSearchIndex = (u) =>
    [
      safeText(u.full_name),
      safeText(u.email),
      safeText(u.employee_id),
      safeText(u.department),
      safeText(u.position),
      safeText(u.role),
      safeText(u.status),
    ]
      .join(" ")
      .toLowerCase();

  const departmentSelect = box.querySelector("#user-department-filter");
  const statusSelect = box.querySelector("#user-status-filter");

  const applyAllClientFilters = () => {
    const q = searchInput ? safeText(searchInput.value).trim().toLowerCase() : "";
    const dept = departmentSelect ? safeText(departmentSelect.value).trim() : "";
    const status = statusSelect ? safeText(statusSelect.value).trim().toLowerCase() : "";

    let filtered = users;

    if (dept) {
      filtered = filtered.filter((u) => safeText(u.department).trim() === dept);
    }

    if (status) {
      filtered = filtered.filter((u) => safeText(u.status).trim().toLowerCase() === status);
    }

    if (q) {
      filtered = filtered.filter((u) => getSearchIndex(u).includes(q));
    }

    renderRows(filtered);

    // Keep details panel stable; only update if there is a matching selection.
  };

  // Client-side search + dropdown filters
  if (searchInput) {
    searchInput.addEventListener("input", applyAllClientFilters);
  }
  if (departmentSelect) {
    departmentSelect.addEventListener("change", applyAllClientFilters);
  }
  if (statusSelect) {
    statusSelect.addEventListener("change", applyAllClientFilters);
  }

}

