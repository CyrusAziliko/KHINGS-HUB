import { supabase } from "./supabaseClient.js";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

function getAvatarColor(name) {
  if (!name) return "#2563EB";
  const colors = [
    "#2563EB", "#06B6D4", "#22C55E", "#F59E0B",
    "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6",
    "#F97316", "#6366F1",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function initCommunicationHub() {
  const dir = document.querySelector("[data-employee-directory]");
  if (!dir) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let allContacts = [];
  let searchTerm = "";
  let filterDept = "";

  // Build search input and filter into the DOM
  const shell = dir.closest(".content-panel") || dir.closest("[data-view-panel]");
  const headerEl = shell?.querySelector("[data-call-center-header]");
  const countBadge = shell?.querySelector("[data-call-center-count]");
  const searchInput = shell?.querySelector("[data-call-center-search]");
  const deptSelect = shell?.querySelector("[data-call-center-dept-filter]");

  async function loadContacts() {
    const dept = dir.getAttribute("data-department") || null;
    let query = supabase
      .from("profiles")
      .select("full_name, department, role, position, phone, email, avatar_url, status")
      .order("full_name", { ascending: true });

    if (dept) query = query.eq("department", dept);

    const { data, error } = await query;
    if (error) {
      console.error("communication.js: failed to load contacts", error);
      dir.innerHTML = `<div class="call-center-empty">Failed to load contacts. Please try again.</div>`;
      return;
    }

    allContacts = data || [];

    // Populate department filter dropdown
    if (deptSelect) {
      const depts = [...new Set(allContacts.map((c) => c.department).filter(Boolean))].sort();
      deptSelect.innerHTML = `<option value="">All Departments</option>${depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}`;
    }

    renderContacts();
  }

  function renderContacts() {
    const filtered = allContacts.filter((c) => {
      const name = (c.full_name || "").toLowerCase();
      const dept = (c.department || "").toLowerCase();
      const pos = (c.position || "").toLowerCase();
      const phone = (c.phone || "");
      const email = (c.email || "").toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch =
        !term ||
        name.includes(term) ||
        dept.includes(term) ||
        pos.includes(term) ||
        phone.includes(term) ||
        email.includes(term);

      const matchesDept = !filterDept || c.department === filterDept;

      return matchesSearch && matchesDept;
    });

    // Update count badge
    if (countBadge) {
      const totalLoaded = allContacts.length;
      countBadge.textContent = `${filtered.length} of ${totalLoaded} active`;
    }

    if (filtered.length === 0) {
      dir.innerHTML = `<div class="call-center-empty">No contacts found matching your criteria.</div>`;
      return;
    }

    dir.innerHTML = filtered
      .map((c) => {
        const initials = getInitials(c.full_name);
        const color = getAvatarColor(c.full_name);
        const avatarContent = c.avatar_url
          ? `<img src="${escapeHtml(c.avatar_url)}" alt="${escapeHtml(c.full_name)}" class="call-center-avatar-img" />`
          : `<span class="call-center-avatar-initials" style="background:${color}">${initials}</span>`;

        return `
          <div class="call-center-card">
            <div class="call-center-card-avatar">
              ${avatarContent}
            </div>
            <div class="call-center-card-body">
              <div class="call-center-card-name">${escapeHtml(c.full_name || "Unknown")}</div>
              <div class="call-center-card-role">${escapeHtml(c.position || "")}${c.position && c.department ? " &middot; " : ""}${escapeHtml(c.department || "")}</div>
              <div class="call-center-card-meta">
                ${c.phone ? `<span class="call-center-card-phone">${escapeHtml(c.phone)}</span>` : ""}
                ${c.email ? `<span class="call-center-card-email">${escapeHtml(c.email)}</span>` : ""}
              </div>
            </div>
            <div class="call-center-card-actions">
              ${c.phone ? `<a class="btn call-center-btn call-center-btn-call" href="tel:${escapeHtml(c.phone)}" title="Call ${escapeHtml(c.full_name)}">📞 Call</a>` : ""}
              ${c.email ? `<a class="btn call-center-btn call-center-btn-mail" href="mailto:${escapeHtml(c.email)}" title="Email ${escapeHtml(c.full_name)}">✉️ Email</a>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Wire up search input
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      renderContacts();
    });
  }

  // Wire up department filter
  if (deptSelect) {
    deptSelect.addEventListener("change", (e) => {
      filterDept = e.target.value;
      renderContacts();
    });
  }

  await loadContacts();
}

