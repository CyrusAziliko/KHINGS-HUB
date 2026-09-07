// Sidebar dropdown functionality (submenu toggles) with smooth animation
// Builds height dynamically for CSS transition support.

function toggleNextSubmenu(btn) {
  const submenu = btn.nextElementSibling;
  if (!submenu) return;

  const isActive = submenu.classList.contains("active");

  if (isActive) {
    // Collapse
    submenu.style.height = submenu.scrollHeight + "px";
    requestAnimationFrame(() => {
      submenu.classList.remove("active");
      submenu.style.height = "0px";
    });
  } else {
    // Expand
    submenu.classList.add("active");
    submenu.style.height = submenu.scrollHeight + "px";
    submenu.addEventListener(
      "transitionend",
      () => {
        submenu.style.height = "auto";
      },
      { once: true }
    );
  }
}

document
  .querySelectorAll(".submenu-toggle")
  .forEach((btn) => {
    btn.addEventListener("click", () => toggleNextSubmenu(btn));
  });

// On page load, ensure any .submenu.active has auto height
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".submenu.active").forEach((el) => {
    el.style.height = "auto";
  });
});

