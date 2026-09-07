import { supabase } from "./supabaseClient.js";

function rootEl() {
  return document.querySelector("[data-announcements-panel-root]");
}

export function initAnnouncementsPanel() {
  const root = rootEl();
  if (!root) return;

  async function load() {
    root.innerHTML = "<div class='muted'>Loading...</div>";

    const { data, error } = await supabase
      .from("announcements")
      .select("title, message, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      root.innerHTML = `<div class='muted'>Failed to load announcements.</div>`;
      console.error(error);
      return;
    }

    const items = data || [];
    if (!items.length) {
      root.innerHTML = `<div class='muted'>No announcements right now.</div>`;
      return;
    }

    root.innerHTML = items
      .map((a) => {
        const title = a.title ? String(a.title) : "Announcement";
        const msg = a.message ? String(a.message) : "";
        const when = a.created_at ? new Date(a.created_at).toLocaleString() : "";
        return `
          <div class="card glass" style="padding:14px; margin-bottom:12px">
            <div style="font-weight:900;color:var(--text)" >${title}</div>
            <div class="muted" style="font-size:12.5px; line-height:1.55; margin-top:6px; white-space:pre-wrap">${msg}</div>
            ${when ? `<div class="muted" style="font-size:11.5px; margin-top:6px">${when}</div>` : ""}
          </div>
        `;
      })
      .join("");
  }

  load();
}

