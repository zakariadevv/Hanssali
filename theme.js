(() => {
  const KEY = "hansali-theme";
  const root = document.documentElement;
  let saved = "light";
  try { saved = localStorage.getItem(KEY) || "light"; } catch {}
  const apply = mode => {
    const dark = mode === "dark";
    root.dataset.theme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.textContent = dark ? "☀ Light mode" : "☾ Dark mode";
      button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      button.setAttribute("aria-pressed", String(dark));
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#111827" : "#f5f6fa");
  };
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  button.dataset.themeToggle = "";
  button.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch {}
    apply(next);
  });
  const header = document.querySelector(".topbar, .student-top");
  if (header) header.append(button);
  apply(saved);
})();