/* Shared production icon set. Implementation assistance: OpenAI ChatGPT. */
(() => {
  "use strict";
  const paths = {
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M6 18 18 6",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    left: "M19 12H5m6-6-6 6 6 6",
    up: "m6 14 6-6 6 6",
    down: "m6 10 6 6 6-6",
    undo: "M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12",
    redo: "m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12",
    check: "m5 12 4 4L19 6",
    clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    link: "m9 15 6-6m-7 4-2 2a4 4 0 0 0 6 6l3-3m-6-6 3-3a4 4 0 0 1 6 6l-2 2",
    alert:
      "M12 8v5m0 3v.01M10.3 4.5 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0",
    cut: "m8 8 13 13M8 16 21 3M8 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0m0 14a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    restore: "M3 11a9 9 0 1 1 3 8M3 5v6h6",
    play: "m8 4 12 8-12 8Z",
    pause: "M8 5v14M16 5v14",
    stop: "M5 5h14v14H5Z",
    save: "M5 3h12l4 4v14H3V3h2m2 0v6h10V3M7 21v-8h10v8",
    grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
    timeline: "M3 6h10v4H3Zm7 8h11v4H10Z",
    compare: "M4 4h6v16H4Zm10 0h6v16h-6Z",
    edit: "m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15Z",
    help: "M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    grip: "M9 5v.01M15 5v.01M9 12v.01M15 12v.01M9 19v.01M15 19v.01",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m16-6a4 4 0 0 1 4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-4a4 4 0 0 1 0 8",
    copy: "M9 9h12v12H9ZM15 5V3H3v12h2",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  };
  function icon(name, size = 16) {
    return (
      '<svg width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
      (paths[name] || paths.plus) +
      '"/></svg>'
    );
  }
  window.NarrativeIcons = Object.freeze({ paths: Object.freeze(paths), icon });
})();
