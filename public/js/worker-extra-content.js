// Adds extra visible content to the Worker Dashboard without changing existing modules.
// This file is intentionally self-contained.

function ensureElement(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el;
}

function renderQuickActions(container) {
  container.innerHTML = "";
  container.className = "grid";
  container.style.gridTemplateColumns = "1fr";

  const totalTicketsEl = document.querySelector("[data-total-tickets]");
  const openTicketsEl = document.querySelector("[data-open-tickets]");
  const resolvedTicketsEl = document.querySelector("[data-resolved-tickets]");

  const totalTickets = totalTicketsEl ? totalTicketsEl.textContent : "0";
  const openTickets = openTicketsEl ? openTicketsEl.textContent : "0";
  const resolvedTickets = resolvedTicketsEl ? resolvedTicketsEl.textContent : "0";

  const cards = [
    {
      title: "Quick Ticket",
      desc: "Start a new request in seconds with a prefilled template.",
      actionText: "Create",
      onClick: () => {
        const title = document.querySelector("#ticket-title");
        if (title) title.focus();
        const button = document.querySelector("button[data-create-ticket]");
        if (button) {
          button.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    {
      title: "My SLA",
      desc: `You have ${openTickets} open • ${resolvedTickets} resolved (today/overall).`
    },
    {
      title: "Broadcasts",
      desc: "View recent announcements and critical updates."
    },
    {
      title: "Tickets Overview",
      desc: `Total submitted: ${totalTickets}`,
      actionText: "View",
      onClick: () => {
        const panel = document.querySelector("[data-view-panel='tickets']");
        panel?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  ];


  // Basic layout: 1 column on small screens, 2 columns via existing CSS grid media query.
  // We'll keep this card group in a local wrapper.
  const wrapper = document.createElement("div");
  wrapper.className = "grid";

  cards.forEach((c, idx) => {
    const sec = document.createElement("section");
    sec.className = "card glass";
    sec.style.padding = "16px";

    const h2 = document.createElement("h2");
    h2.className = "h2";
    h2.textContent = c.title;

    const p = document.createElement("div");
    p.className = "muted";
    p.style.fontSize = "13px";
    p.style.lineHeight = "1.5";
    p.textContent = c.desc;

    sec.appendChild(h2);
    sec.appendChild(p);

    if (c.onClick) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn primary";
      btn.style.marginTop = "12px";
      btn.textContent = c.actionText || "Open";
      btn.addEventListener("click", c.onClick);
      sec.appendChild(btn);
    }

    wrapper.appendChild(sec);
  });

  container.appendChild(wrapper);
}

function renderMiniDirectory(container) {
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "muted";
  list.style.fontSize = "13px";
  list.style.lineHeight = "1.6";

  list.innerHTML = `
    <div style="font-weight:800;color:var(--text);margin-bottom:6px">Suggested Contacts</div>
    <div>• IT Helpdesk — hardware/software & account access</div>
    <div>• HR Support — leave, benefits, and employee issues</div>
    <div>• Safety Officer — incident reporting & compliance</div>
  `;

  container.appendChild(list);
}

function renderWorkerHighlights(container) {
  container.innerHTML = "";
  const card = document.createElement("section");
  card.className = "card glass";
  card.style.padding = "16px";

  const h2 = document.createElement("h2");
  h2.className = "h2";
  h2.textContent = "Worker Highlights";

  const p = document.createElement("p");
  p.className = "muted";
  p.style.margin = "0";
  p.style.fontSize = "13px";
  p.style.lineHeight = "1.55";
  p.textContent = "Track your progress, respond faster, and keep work flowing.";

  const ul = document.createElement("div");
  ul.style.marginTop = "12px";
  ul.className = "muted";
  ul.style.fontSize = "13px";
  ul.style.lineHeight = "1.7";
  ul.innerHTML = `
    <div>✅ New: create tickets with attachments</div>
    <div>⚡ Fast: AI suggestions for ticket descriptions</div>
    <div>📡 Live: updates via realtime notifications</div>
  `;

  card.appendChild(h2);
  card.appendChild(p);
  card.appendChild(ul);

  container.appendChild(card);
}

export function initWorkerExtraContent() {

  // Create extra sections only if the placeholders exist.
  const qa = ensureElement("[data-worker-quick-actions]");
  if (qa) renderQuickActions(qa);

  const dir = ensureElement("[data-worker-mini-directory]");
  if (dir) renderMiniDirectory(dir);

  const highlights = ensureElement("[data-worker-highlights]");
  if (highlights) renderWorkerHighlights(highlights);
}

