import { initKhingBotPage } from "./khingbot.js";
import { loadWorkforceCommandCenter } from "./workforce-command-center.js";


function setActiveNav(view) {

  document
    .querySelectorAll(".nav-item")
    .forEach((btn) => {

      btn.classList.remove("active");

      if (btn.dataset.view === view) {
        btn.classList.add("active");
      }

    });

}


function showPanel(view) {

  document
    .querySelectorAll(".content-panel")
    .forEach((panel) => {

      panel.classList.remove("active");

      if (panel.dataset.viewPanel === view) {
        panel.classList.add("active");
      }

    });

}



export function initWorkerNav() {
  if (document.querySelectorAll("[data-view]").length === 0) return;

  // Sidebar dropdowns are handled by public/js/sidebar.js

  const navButtons =
    document.querySelectorAll("[data-view]");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;

      setActiveNav(view);
      showPanel(view);

      if (view === "workforce") {
        loadWorkforceCommandCenter();
      }

    });
  });

  showPanel("dashboard");

  const bubble = document.getElementById("khingbot-bubble");
  const windowBox = document.getElementById("khingbot-window");
  const closeBtn = document.getElementById("close-btn");
  const minBtn = document.getElementById("minimize-btn");
  const header = document.getElementById("khingbot-header");


  // OPEN
  bubble?.addEventListener("click", () => {
    windowBox?.classList.remove("hidden");
  });

  // CLOSE
  closeBtn?.addEventListener("click", () => {
    windowBox?.classList.add("hidden");
  });

  // MINIMIZE (hide window but keep bubble)
  minBtn?.addEventListener("click", () => {
    windowBox?.classList.add("hidden");
  });

  // Dragging
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header?.addEventListener("mousedown", (e) => {
    if (!windowBox) return;

    isDragging = true;
    offsetX = e.clientX - windowBox.offsetLeft;
    offsetY = e.clientY - windowBox.offsetTop;

    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDrag);
  });

  function drag(e) {
    if (!isDragging || !windowBox) return;

    windowBox.style.left = e.clientX - offsetX + "px";
    windowBox.style.top = e.clientY - offsetY + "px";
    windowBox.style.right = "auto";
    windowBox.style.bottom = "auto";
    windowBox.style.position = "fixed";
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", stopDrag);
  }

  const openKhingBotWindow = () => windowBox?.classList.remove("hidden");
  const closeKhingBotWindow = () => windowBox?.classList.add("hidden");

  // Initial state for KhingBot panel (keeps existing behavior)
  if (windowBox) {
    windowBox.classList.add("hidden");
  }

}




