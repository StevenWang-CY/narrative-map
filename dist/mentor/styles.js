/* AI-assisted specimen using production assets and CSS. */
(() => {
  "use strict";
  const inventory = window.NarrativeStyleInventory;
  const root = getComputedStyle(document.documentElement);
  document.getElementById("font-stack").textContent =
    "Font stack: " +
    getComputedStyle(document.body).fontFamily +
    ". Uses installed system fallbacks; no font download.";
  for (const weight of inventory.weights) {
    const el = document.createElement("div");
    el.className = "type-sample";
    const sample = document.createElement("span");
    sample.style.fontWeight = weight;
    sample.textContent = "Keep the story connected. 0123456789";
    const label = document.createElement("small");
    label.textContent = "Weight " + weight;
    el.append(sample, label);
    document.getElementById("font-weights").append(el);
  }
  function swatch(parent, name, color) {
    const el = document.createElement("div");
    el.className = "spec-swatch";
    const chip = document.createElement("div");
    chip.className = "swatch-color";
    chip.style.backgroundColor = color;
    const text = document.createElement("div");
    text.className = "swatch-text";
    text.textContent = name;
    const code = document.createElement("code");
    code.textContent = color;
    text.append(code);
    el.append(chip, text);
    parent.append(el);
  }
  for (const name of inventory.semantic)
    swatch(
      document.getElementById("semantic-colors"),
      name.replaceAll("-", " "),
      root.getPropertyValue("--" + name).trim(),
    );
  for (const name of inventory.speakers) {
    const el = document.createElement("div");
    el.className = "speaker-swatch";
    el.dataset.color = name;
    const title = document.createElement("strong");
    title.innerHTML = '<i class="speaker-dot"></i>';
    title.append(
      document.createTextNode(name.charAt(0).toUpperCase() + name.slice(1)),
    );
    el.append(title);
    document.getElementById("speaker-colors").append(el);
    const colors = getComputedStyle(el);
    for (const key of ["speaker", "speaker-soft", "speaker-ink"]) {
      const code = document.createElement("code");
      code.textContent =
        key + ": " + colors.getPropertyValue("--" + key).trim();
      el.append(code);
    }
  }
  const icons = window.NarrativeIcons;
  for (const name of Object.keys(icons.paths)) {
    const el = document.createElement("div");
    el.className = "spec-icon";
    el.innerHTML = icons.icon(name, 24);
    const label = document.createElement("span");
    label.textContent = name;
    el.append(label);
    document.getElementById("icon-grid").append(el);
  }
  const mark = document.createElement("div");
  mark.className = "spec-icon";
  mark.innerHTML =
    '<img src="../mark.svg" width="28" height="28" alt="Narrative Map mark"><span>Product mark</span>';
  document.getElementById("icon-grid").append(mark);
  document.getElementById("icon-count").textContent =
    Object.keys(icons.paths).length +
    " production SVG icons, plus the product mark. The product and this page share the same definitions.";
  for (const color of inventory.colors)
    swatch(document.getElementById("all-colors"), color, color);
  const feedback = document.getElementById("control-feedback");
  document.querySelectorAll("[data-spec]").forEach((b) =>
    b.addEventListener("click", () => {
      feedback.textContent = b.dataset.spec + " action activated.";
    }),
  );
  document.getElementById("style-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("style-duration"),
      error = document.getElementById("style-error"),
      n = window.NarrativeModel.parseDuration(input.value);
    if (n === null) {
      input.setAttribute("aria-invalid", "true");
      error.hidden = false;
      error.textContent =
        "Enter a positive time such as 1:30. Seconds must be 00–59.";
      input.focus();
    } else {
      input.removeAttribute("aria-invalid");
      error.hidden = true;
      input.value = window.NarrativeModel.format(n);
      feedback.textContent =
        "Valid duration: " +
        input.value +
        ". This specimen did not change your plan.";
    }
  });
})();
