import { loadMyWorkOrders, updateWorkerWorkOrderStatus } from "./work-orders.js";

let isUpdating = false;

function ensureFeedbackHost(container) {
  let feedback = container.querySelector("[data-worker-wo-feedback]");
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.setAttribute("data-worker-wo-feedback", "true");
    feedback.style.marginBottom = "10px";
    feedback.style.fontSize = "13px";
    container.prepend(feedback);
  }
  return feedback;
}

function setFeedback(container, message, type = "info") {
  const feedback = ensureFeedbackHost(container);
  const colorMap = {
    success: "#22c55e",
    error: "#ef4444",
    info: "#94a3b8",
  };
  feedback.style.color = colorMap[type] || colorMap.info;
  feedback.textContent = message || "";
}

function getActionButton(order) {
  if (order.status === "Assigned") {
    return `<button data-wo-action="accept" data-wo-id="${order.id}">Accept Job</button>`;
  }

  if (order.status === "Accepted") {
    return `<button data-wo-action="start" data-wo-id="${order.id}">Start Work</button>`;
  }

  if (order.status === "In Progress") {
    return `<button data-wo-action="complete" data-wo-id="${order.id}">Complete</button>`;
  }

  return "";
}

function bindActionHandlers(container) {
  const buttons = container.querySelectorAll("button[data-wo-action]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (isUpdating) return;
      const action = btn.getAttribute("data-wo-action");
      const orderId = btn.getAttribute("data-wo-id");
      await handleAction(container, action, orderId);
    });
  });
}

function setButtonsDisabled(container, disabled) {
  container
    .querySelectorAll("button[data-wo-action]")
    .forEach((btn) => {
      btn.disabled = !!disabled;
    });
}

async function handleAction(container, action, id) {
  const nextStatusMap = {
    accept: "Accepted",
    start: "In Progress",
    complete: "Completed",
  };

  const nextStatus = nextStatusMap[action];
  if (!nextStatus || !id) return;

  try {
    isUpdating = true;
    setButtonsDisabled(container, true);
    setFeedback(container, "Updating work order...", "info");

    await updateWorkerWorkOrderStatus(id, nextStatus);

    setFeedback(container, "Work order updated successfully.", "success");
    await renderMyOrders();
  } catch (err) {
    console.error("Worker work-order action failed:", err);
    setFeedback(container, err?.message || "Failed to update work order.", "error");
  } finally {
    isUpdating = false;
    setButtonsDisabled(container, false);
  }
}

export async function initWorkerWorkOrders() {
  console.log("Worker Work Orders loading...");
  await renderMyOrders();
}

async function renderMyOrders() {
  const container = document.getElementById("worker-work-orders");
  if (!container) return;

  const orders = await loadMyWorkOrders();

  if (!orders.length) {
    container.innerHTML = `<p>No assigned work orders</p>`;
    return;
  }

  container.innerHTML = `
    <div data-worker-wo-feedback style="margin-bottom:10px;font-size:13px;"></div>
    ${orders
      .map(
        (order) => `
      <div class="work-card">
        <h3>${order.title}</h3>
        <p>Priority: <strong>${order.priority}</strong></p>
        <p>Status: ${order.status}</p>
        <p>Due: ${order.due_date || "Not set"}</p>
        ${getActionButton(order)}
      </div>
    `,
      )
      .join("")}
  `;

  bindActionHandlers(container);
}
