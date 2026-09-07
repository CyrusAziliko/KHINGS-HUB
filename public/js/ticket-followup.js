import { supabase } from "./supabaseClient.js";
import {
  getWorkerPendingFollowUps,
  confirmTicketResolution,
  reopenTicketFromFollowUp,
  remindLaterFollowUp,
} from "./services/ticketService.js";

/* ============================================================
   TICKET FOLLOW-UP & RESOLUTION CONFIRMATION
   Worker-side module for confirming, reopening, or delaying
   resolution follow-ups on tickets.
   ============================================================ */

function byId(id) { return document.getElementById(id); }

/**
 * Render a single follow-up card with 3 action buttons.
 */
function renderFollowUpCard(fu) {
  const ticket = fu.tickets || {};
  const ticketNum = ticket.ticket_number || "#" + (ticket.id || "").slice(0, 8);
  const title = ticket.title || "Untitled Ticket";
  const status = ticket.status || "Unknown";
  const priority = ticket.priority || "medium";
  const updatedAt = ticket.updated_at
    ? new Date(ticket.updated_at).toLocaleString()
    : "—";

  // Priority color class
  const prioClass = String(priority).toLowerCase();
  const prioColor =
    prioClass === "critical" || prioClass === "high"
      ? "var(--danger)"
      : prioClass === "medium"
      ? "var(--warning)"
      : "var(--success)";

  return `
    <div class="tix-fu-card" data-followup-id="${fu.id}" data-ticket-id="${ticket.id}">
      <div class="tix-fu-card-top">
        <div class="tix-fu-card-left">
          <div class="tix-fu-card-num">${ticketNum}</div>
          <div class="tix-fu-card-title">${escapeHtml(title)}</div>
        </div>
        <div class="tix-fu-card-right">
          <span class="tix-fu-prio" style="--fu-prio-color: ${prioColor}">${priority}</span>
          <span class="tix-st tix-st--resolved">Resolved</span>
        </div>
      </div>
      <div class="tix-fu-card-body">
        <div class="tix-fu-card-desc">
          This ticket has been marked as <strong>Resolved</strong>.
          Please confirm the resolution or let us know if you're still experiencing the issue.
        </div>
        <div class="tix-fu-card-meta">
          <span>🕐 Updated: ${updatedAt}</span>
        </div>
      </div>
      <div class="tix-fu-card-actions">
        <button class="tix-fu-btn tix-fu-btn--confirm" data-fu-action="confirm">
          ✓ Confirm Resolved
        </button>
        <button class="tix-fu-btn tix-fu-btn--reopen" data-fu-action="reopen">
          ⚠ Still Having Issue
        </button>
        <button class="tix-fu-btn tix-fu-btn--remind" data-fu-action="remind">
          ⏰ Remind Me Later
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load follow-ups for the current worker and render them.
 */
async function loadFollowUps() {
  console.log("[FollowUp] loadFollowUps() called");
  const section = byId("ticket-followup-section");
  const list = byId("ticket-followup-list");
  const countBadge = byId("followup-count");

  console.log("[FollowUp] DOM elements - section:", section, "list:", list, "countBadge:", countBadge);
  if (!section || !list) {
    console.warn("[FollowUp] Required DOM elements missing");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  console.log("[FollowUp] auth user:", user?.id);
  if (!user) {
    console.warn("[FollowUp] No authenticated user");
    section.style.display = "none";
    return;
  }

  let followUps = [];
  try {
    console.log("[FollowUp] calling getWorkerPendingFollowUps for user:", user.id);
    followUps = await getWorkerPendingFollowUps(user.id);
    console.log("[FollowUp] getWorkerPendingFollowUps returned:", followUps?.length, "items", followUps);
  } catch (e) {
    console.error("[FollowUp] Failed to load follow-ups:", e);
    section.style.display = "none";
    return;
  }

  // Update count badge
  if (countBadge) {
    countBadge.textContent = String(followUps.length);
  }

  // Hide section if no actionable follow-ups
  if (!followUps.length) {
    section.style.display = "none";
    return;
  }

  // Show section and render cards
  console.log("[FollowUp.Render] followUps data:", JSON.stringify(followUps, null, 2));

  section.style.display = "block";
  console.log("[FollowUp.Render] section display set to block");

  let html;
  try {
    html = followUps.map(renderFollowUpCard).join("");
    console.log("[FollowUp.Render] generated HTML:", html.substring(0, 500) + "...");
  } catch (renderErr) {
    console.error("[FollowUp.Render] ERROR during renderFollowUpCard:", renderErr);
    list.innerHTML = `<div class="tix-load">Error rendering follow-up: ${renderErr.message}</div>`;
    return;
  }

  list.innerHTML = html;
  console.log("[FollowUp.Render] list.innerHTML set, current section display:", section.style.display);

  // Verify DOM rendering
  const renderedCount = list.querySelectorAll(".tix-fu-card").length;
  console.log("[FollowUp.Render] rendered .tix-fu-card count:", renderedCount);

  // Bind action buttons
  list.querySelectorAll("[data-fu-action]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = btn.closest(".tix-fu-card");
      if (!card) return;

      const followUpId = card.getAttribute("data-followup-id");
      const ticketId = card.getAttribute("data-ticket-id");
      const action = btn.getAttribute("data-fu-action");

      if (!followUpId || !ticketId || !action) return;

      // Disable all buttons on this card to prevent double-clicks
      card.querySelectorAll("[data-fu-action]").forEach((b) => {
        b.disabled = true;
        b.style.opacity = "0.5";
        b.style.cursor = "not-allowed";
      });

      try {
        await handleFollowUpAction({ followUpId, ticketId, action, card });
      } catch (err) {
        console.error("Follow-up action failed:", err);
        // Re-enable buttons on error
        card.querySelectorAll("[data-fu-action]").forEach((b) => {
          b.disabled = false;
          b.style.opacity = "";
          b.style.cursor = "";
        });
      }
    });
  });
}

/**
 * Handle a follow-up action button click.
 */
async function handleFollowUpAction({ followUpId, ticketId, action, card }) {
  switch (action) {
    case "confirm": {
      await confirmTicketResolution({ followUpId, ticketId });
      // Show success state on card
      card.innerHTML = `
        <div class="tix-fu-card tix-fu-card--done">
          <div class="tix-fu-done-icon">✓</div>
          <div class="tix-fu-done-text">
            <strong>Resolution Confirmed</strong>
            <p>This ticket has been closed. Thank you for confirming.</p>
          </div>
        </div>
      `;
      // Fade out and remove after 2s
      setTimeout(() => {
        card.style.transition = "all 0.4s ease";
        card.style.opacity = "0";
        card.style.transform = "translateX(40px)";
        setTimeout(async () => {
          card.remove();
          await loadFollowUps(); // Refresh count + possibly hide section
        }, 400);
      }, 2000);
      break;
    }

    case "reopen": {
      await reopenTicketFromFollowUp({ followUpId, ticketId });
      // Show reopened state
      card.innerHTML = `
        <div class="tix-fu-card tix-fu-card--reopened">
          <div class="tix-fu-reopened-icon">⚠</div>
          <div class="tix-fu-reopened-text">
            <strong>Ticket Reopened</strong>
            <p>Your ticket has been reopened and an admin has been notified.</p>
          </div>
        </div>
      `;
      setTimeout(() => {
        card.style.transition = "all 0.4s ease";
        card.style.opacity = "0";
        card.style.transform = "translateX(40px)";
        setTimeout(async () => {
          card.remove();
          await loadFollowUps();
        }, 400);
      }, 2500);
      break;
    }

    case "remind": {
      await remindLaterFollowUp({ followUpId });
      // Show remind state
      card.innerHTML = `
        <div class="tix-fu-card tix-fu-card--reminded">
          <div class="tix-fu-remind-icon">⏰</div>
          <div class="tix-fu-remind-text">
            <strong>Reminder Set</strong>
            <p>We'll remind you about this ticket in 24 hours if it's still unresolved.</p>
          </div>
        </div>
      `;
      setTimeout(() => {
        card.style.transition = "all 0.4s ease";
        card.style.opacity = "0";
        card.style.transform = "translateX(40px)";
        setTimeout(async () => {
          card.remove();
          await loadFollowUps();
        }, 400);
      }, 2500);
      break;
    }
  }
}

/**
 * Initialize the Ticket Follow-Up module.
 * Called from the worker dashboard after auth + identity are loaded.
 */
export async function initTicketFollowUp() {
  console.log("[FollowUp] initTicketFollowUp() called");
  // Only run on worker dashboard
  const section = byId("ticket-followup-section");
  console.log("[FollowUp] section element:", section);
  if (!section) {
    console.warn("[FollowUp] #ticket-followup-section not found in DOM");
    return;
  }

  // Initial load
  console.log("[FollowUp] calling loadFollowUps()");
  await loadFollowUps();

  // Re-subscribe to follow-up changes via a simple interval check
  // (Realtime subscription for follow-ups could be added, but polling
  //  is simpler and keeps the realtime.js unchanged.)
  // Check every 30 seconds for new follow-ups
  const intervalId = setInterval(async () => {
    try {
      await loadFollowUps();
    } catch (e) {
      console.error("Follow-up refresh failed:", e);
    }
  }, 30000);

  // Store cleanup for module unload
  section.dataset.followUpInterval = String(intervalId);
}

/**
 * Cleanup: Clear interval when module is unloaded.
 */
export function cleanupTicketFollowUp() {
  const section = byId("ticket-followup-section");
  if (section && section.dataset.followUpInterval) {
    clearInterval(Number(section.dataset.followUpInterval));
    delete section.dataset.followUpInterval;
  }
}

