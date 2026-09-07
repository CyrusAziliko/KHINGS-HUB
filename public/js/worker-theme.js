const THEME_STORAGE_KEY = "theme";
const DEFAULT_THEME = "dark";

export function getCurrentTheme() {
  const attrTheme = document.documentElement.getAttribute("data-theme");
  return attrTheme === "light" ? "light" : "dark";
}

export function setTheme(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", normalizedTheme);
  localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: normalizedTheme } }));
  return normalizedTheme;
}

export function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", initialTheme);
  return initialTheme;
}

export function updateThemeToggleLabel(buttonEl) {
  if (!buttonEl) return;
  const currentTheme = getCurrentTheme();
  const label =
    currentTheme === "light" ? "🌙 Switch to Dark Mode" : "☀️ Switch to Light Mode";
  buttonEl.textContent = label;
  buttonEl.setAttribute("aria-label", label);
}

export function toggleTheme() {
  const nextTheme = getCurrentTheme() === "light" ? "dark" : "light";
  return setTheme(nextTheme);
}

export function bindThemeToggle(buttonEl) {
  if (!buttonEl) return;
  updateThemeToggleLabel(buttonEl);

  if (buttonEl.dataset.themeBound === "true") return;
  buttonEl.dataset.themeBound = "true";

  buttonEl.addEventListener("click", () => {
    toggleTheme();
    updateThemeToggleLabel(buttonEl);
  });

  window.addEventListener("themechange", () => {
    updateThemeToggleLabel(buttonEl);
  });
}

function autoInitTheme() {
  initializeTheme();
  const toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) bindThemeToggle(toggleBtn);
}

autoInitTheme();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoInitTheme, { once: true });
}

