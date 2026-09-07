export function showPanel(view) {
  document
    .querySelectorAll(".content-panel")
    .forEach((panel) => {
      panel.classList.remove("active");
    });

  const target = document.querySelector(
    `[data-view-panel="${view}"]`
  );

  if (target) {
    target.classList.add("active");
  }
}

// Keep event flow identical: click -> showPanel(view) -> loadModule(view)
export function setupNavigation(loadModule) {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      showPanel(view);
      loadModule(view);
    });
  });
}

