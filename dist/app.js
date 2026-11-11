/* Narrative Map. Implementation assistance: OpenAI ChatGPT. */
(() => {
  "use strict";
  const M = window.NarrativeModel,
    app = document.getElementById("app"),
    modal = document.getElementById("modal");
  const isDemo = document.body.dataset.demo === "true";
  const KEY = isDemo ? "narrative-map-mentor-demo-v1" : "narrative-map-hifi-v2",
    history = [],
    future = [];
  let library = M.libraryFrom(M.initial());
  let data = library.projects[0].data,
    storageOk = true,
    startupNotice = "",
    selected = "b02",
    view = "plan",
    boardView = "cards",
    compareLeft = "example-a",
    compareRight = "example-b",
    differencesOnly = false;
  let toastTimer,
    modalReturn = null,
    speakerDraft = [],
    session = null,
    timerInterval = null;
  try {
    const storage = isDemo ? sessionStorage : localStorage;
    if (isDemo && new URLSearchParams(location.search).has("fresh")) {
      storage.removeItem(KEY);
      window.history.replaceState(null, "", location.pathname);
    }
    const saved = storage.getItem(KEY);
    if (saved) {
      const value = JSON.parse(saved);
      const restored = M.libraryFrom(value);
      if (restored) {
        library = restored;
        data = library.projects.find(p => p.id === library.activeProjectId).data;
      }
      else
        startupNotice =
          "The saved workspace could not be read. The sample is open; import a valid backup to restore your work.";
    }
  } catch {
    storageOk = false;
    startupNotice =
      "Browser storage is unavailable. Export a backup before closing this page.";
  }
  const icon = window.NarrativeIcons.icon;
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmt = M.format,
    byId = (id) => data.plan.blocks.find((b) => b.id === id);
  const uid = (prefix) =>
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 7);
  function button(label, action, opts = {}) {
    return (
      '<button type="button" class="btn ' +
      (opts.class || "") +
      '" data-action="' +
      action +
      '"' +
      (opts.id ? ' data-id="' + esc(opts.id) + '"' : "") +
      (opts.disabled ? " disabled" : "") +
      (opts.label ? ' aria-label="' + esc(opts.label) + '"' : "") +
      (opts.title ? ' title="' + esc(opts.title) + '"' : "") +
      ">" +
      (opts.icon ? icon(opts.icon, opts.size || 15) : "") +
      label +
      "</button>"
    );
  }
  function announce(message) {
    document.getElementById("announcer").textContent = message;
  }
  function toast(message, undo = false) {
    clearTimeout(toastTimer);
    const node = document.getElementById("toast");
    node.innerHTML =
      "<span>" +
      esc(message) +
      "</span>" +
      (undo ? '<button data-action="undo">Undo</button>' : "") +
      '<button class="dismiss-toast" data-action="dismiss-toast" aria-label="Dismiss notification">' +
      icon("close", 13) +
      "</button>";
    node.hidden = false;
    toastTimer = setTimeout(() => {
      node.hidden = true;
    }, 6500);
  }
  const currentProject = () => library.projects.find(p => p.id === library.activeProjectId);
  function syncProject() {
    currentProject().data = data;
    currentProject().name = data.plan.title;
  }
  function persist() {
    syncProject();
    try {
      (isDemo ? sessionStorage : localStorage).setItem(
        KEY,
        JSON.stringify(library),
      );
      storageOk = true;
    } catch {
      storageOk = false;
    }
    return storageOk;
  }
  function saveProject() {
    const field = document.getElementById("quick-duration");
    if (field && field.value !== fmt(byId(selected).seconds)) {
      const seconds = M.parseDuration(field.value);
      submitForm(field.form);
      if (seconds === null || byId(selected).seconds !== seconds) return;
    }
    const saved = persist();
    render();
    toast(saved
      ? (isDemo ? "Project saved in this demo tab." : "Project saved in this browser.") + " Saved versions stay unchanged."
      : "Could not save in this browser. Export a backup to keep your work.");
  }
  function openProject(id) {
    const project = library.projects.find(p => p.id === id);
    if (!project) return;
    clearTimeout(toastTimer);
    document.getElementById("toast").hidden = true;
    syncProject();
    if (id !== library.activeProjectId) { history.length = 0; future.length = 0; }
    library.activeProjectId = id;
    data = project.data;
    selected = data.plan.blocks[0]?.id || null;
    session = null; clearInterval(timerInterval);
    compareLeft = data.versions[1]?.id || "working";
    compareRight = data.versions[2]?.id || data.versions[0]?.id || "working";
    view = "plan";
    persist(); render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function focusKey(el = document.activeElement) {
    if (!el || el === document.body) return null;
    return el.id
      ? { id: el.id }
      : el.dataset.action
        ? {
            action: el.dataset.action,
            idValue: el.dataset.id || "",
            navigation: !!el.closest(".main-nav"),
          }
        : null;
  }
  function restoreFocus(key) {
    if (!key) return;
    const el = key.id
      ? document.getElementById(key.id)
      : [...document.querySelectorAll("[data-action]")].find(
          (x) =>
            x.dataset.action === key.action &&
            (x.dataset.id || "") === key.idValue &&
            !!x.closest(".main-nav") === !!key.navigation,
        );
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }
  function commit(change, message) {
    if (session && !session.finished) {
      toast("Finish or discard the rehearsal before editing the plan.");
      return false;
    }
    const next = M.clone(data);
    change(next);
    if (
      next.activeVersionId &&
      !next.versions.some(
        (v) =>
          v.id === next.activeVersionId &&
          JSON.stringify(v.plan) === JSON.stringify(next.plan),
      )
    )
      next.activeVersionId = null;
    if (!M.validBackup(next)) {
      toast("That change would create an invalid plan. Nothing was changed.");
      return false;
    }
    if (JSON.stringify(next) === JSON.stringify(data)) return false;
    history.push(M.clone(data));
    if (history.length > 50) history.shift();
    future.length = 0;
    data = next;
    persist();
    render();
    if (message) toast(storageOk ? message : "Changes are only in this tab. Export a backup before leaving.", true);
    return true;
  }
  function undo() {
    if (session && !session.finished) {
      toast("Finish or discard the rehearsal first.");
      return;
    }
    if (!history.length) return;
    future.push(M.clone(data));
    data = history.pop();
    persist();
    render();
    toast("Previous change undone.");
    announce("Previous change undone.");
  }
  function redo() {
    if (!future.length || (session && !session.finished)) return;
    history.push(M.clone(data));
    data = future.pop();
    persist();
    render();
    toast("Change restored.");
  }
  function uniqueName(base) {
    base = base.slice(0, 70);
    let value = base,
      n = 2;
    while (
      data.versions.some((v) => v.name.toLowerCase() === value.toLowerCase())
    )
      value = base.slice(0, 60) + " " + n++;
    return value;
  }
  function status(plan) {
    const a = M.analyze(plan);
    return (
      '<span class="badge ' +
      (a.ready ? "good" : "warn") +
      '">' +
      icon(a.ready ? "check" : "edit", 11) +
      (a.ready ? "Ready to rehearse" : "Draft") +
      "</span>"
    );
  }
  function matchingVersion() {
    const matches = data.versions.filter(
      (v) => JSON.stringify(v.plan) === JSON.stringify(data.plan),
    );
    return (
      matches.find((v) => v.id === data.activeVersionId) ||
      matches
        .slice()
        .reverse()
        .find((v) => !v.example) ||
      matches[0]
    );
  }
  function header() {
    return (
      '<header class="topbar"><a href="#" class="brand" data-action="projects"><img src="' + (isDemo ? '../mark.svg' : 'mark.svg') + '" alt="">Narrative Map</a><nav class="main-nav" aria-label="Main navigation">' +
      [
        ["plan", "Speaking plan", "grid"],
        ["rehearse", "Rehearse", "play"],
        ["versions", "Versions", "compare"],
      ]
        .map(
          ([id, label, ic]) =>
            '<button class="nav-link" data-action="' +
            id +
            '"' +
            (view === id ? ' aria-current="page"' : "") +
            ">" +
            icon(ic, 14) +
            label +
            (id === "rehearse" && session && !session.finished
              ? '<span class="save-dot"></span>'
              : "") +
            "</button>",
        )
        .join("") +
      '</nav><div class="top-actions"><span class="local-save"><i class="save-dot"></i>' +
      (storageOk
        ? isDemo
          ? "Autosaved in this tab"
          : "Autosaved in this browser"
        : "Export to keep your work") +
      "</span>" +
      button("", "help", {
        class: "ghost icon-btn",
        icon: "help",
        label: "How Narrative Map works",
      }) +
      "</div></header>"
    );
  }
  function workspaceNav() {
    return '<div class="workspace-nav">' +
      button("All projects", "projects", { icon: "left", class: "ghost" }) +
      '<div class="workspace-save">' +
      button("", "undo", { icon: "undo", class: "icon-btn", label: "Undo last change", disabled: !history.length }) +
      button("", "redo", { icon: "redo", class: "icon-btn", label: "Redo last change", disabled: !future.length }) +
      button("Save", "save-project", { icon: "save", title: "Save the current project without creating a version (⌘/Ctrl S)" }) +
      '</div></div>';
  }
  function projectsPage() {
    return '<div class="project-header"><div><h1>All projects</h1><p class="project-subtitle">Each project keeps its own working plan and saved versions.</p></div>' +
      button("New project", "new-presentation", { icon: "plus", class: "primary" }) +
      '</div><div class="projects-grid">' + library.projects.map(project => {
        const a = M.analyze(project.data.plan), active = project.id === library.activeProjectId;
        return '<article class="panel project-card" data-project-id="' + esc(project.id) + '"><div class="project-card-top"><span class="project-glyph" aria-hidden="true">' + icon("grid", 20) + '</span>' +
          (active ? '<span class="badge">Current project</span>' : '') + '</div><h2>' + esc(project.name) + '</h2><p class="muted">' +
          project.data.plan.speakers.length + ' speaker' + (project.data.plan.speakers.length === 1 ? '' : 's') + ' · ' + project.data.plan.blocks.length + ' block' + (project.data.plan.blocks.length === 1 ? '' : 's') + ' · ' + project.data.versions.length + ' saved version' + (project.data.versions.length === 1 ? '' : 's') + '</p><div class="project-card-bottom"><div><strong class="num">' + fmt(a.total) + '</strong><span class="muted"> / ' + fmt(project.data.plan.target) + '</span></div>' +
          button(active ? "Continue" : "Open project", "open-project", {id:project.id, icon:"arrow"}) + '</div></article>';
      }).join('') + '</div><p class="library-help">Projects are saved in this ' + (isDemo ? 'demo tab' : 'browser') + '. Export a backup to move them to another device.</p>';
  }
  function projectHeader() {
    const version = matchingVersion();
    return (
      '<div class="project-header"><div><div class="project-title"><h1>' +
      esc(data.plan.title) +
      "</h1>" +
      button("", "settings", {
        class: "ghost icon-btn",
        icon: "edit",
        label: "Edit presentation settings",
      }) +
      '</div><p class="project-subtitle">' +
      (version?.example
        ? 'Example plan <span aria-hidden="true">·</span> '
        : "") +
      esc(version ? version.name : "Working draft") +
      ' <span aria-hidden="true">·</span> ' +
      data.plan.speakers.length +
      " speaker" +
      (data.plan.speakers.length === 1 ? "" : "s") +
      ' <span aria-hidden="true">·</span> ' +
      data.plan.blocks.length +
      " content block" +
      (data.plan.blocks.length === 1 ? "" : "s") +
      '</p></div><div class="header-actions">' +
      button("Add block", "add-block", { icon: "plus" }) +
      button("Save version", "save-version", {
        icon: "plus",
        class: "primary",
      }) +
      "</div></div>"
    );
  }
  function legend(plan) {
    return (
      '<div class="speaker-legend">' +
      M.analyze(plan)
        .bySpeaker.map(
          (s) =>
            '<span data-color="' +
            s.color +
            '"><i class="color-dot"></i>' +
            esc(s.name) +
            ' <b class="num">' +
            fmt(s.seconds) +
            "</b></span>",
        )
        .join("") +
      "</div>"
    );
  }
  function timePanel() {
    const a = M.analyze(data.plan),
      max = Math.max(a.total, data.plan.target),
      pct = (data.plan.target / max) * 100;
    const timeMessage =
      a.difference > 0
        ? fmt(a.difference) + " over limit"
        : a.difference < 0
          ? fmt(-a.difference) + " to spare"
          : "Exactly on time";
    return (
      '<section class="time-panel" aria-label="Presentation timing"><div class="time-top"><div class="time-summary"><div class="time-value">' +
      fmt(a.total) +
      "<small>/ " +
      fmt(data.plan.target) +
      '</small></div><p class="time-description">Planned duration · min:sec</p></div><div class="time-right">' +
      status(data.plan) +
      button("Edit limit", "settings", {
        class: "ghost small-btn",
        label: "Edit presentation time limit",
      }) +
      '</div></div><div class="time-state"><strong class="' +
      (a.difference > 0 ? "over-limit" : "within-limit") +
      '">' +
      timeMessage +
      "</strong><span>" +
      (a.issues.length
        ? a.issues.length +
          " prerequisite issue" +
          (a.issues.length > 1 ? "s" : "")
        : a.included.length
          ? a.included.some((b) => b.requires.length)
            ? "Marked prerequisites in order"
            : "No prerequisites marked"
          : "Add a block to begin") +
      "</span></div>" +
      '<div class="budget-wrap" role="img" aria-label="' +
      esc(
        "Planned " +
          fmt(a.total) +
          ", limit " +
          fmt(data.plan.target) +
          ", " +
          timeMessage,
      ) +
      '"><div class="budget-track">' +
      a.bySpeaker
        .map(
          (s) =>
            '<span class="budget-segment" data-color="' +
            s.color +
            '" style="width:' +
            (s.seconds / max) * 100 +
            '%;background:var(--speaker)"></span>',
        )
        .join("") +
      '</div><div class="target-marker" style="left:' +
      pct +
      '%"></div><span class="target-label" style="left:clamp(0px,calc(' +
      pct +
      '% - 82px),calc(100% - 82px))">LIMIT ' +
      fmt(data.plan.target) +
      '</span><span class="axis-start">0:00</span><span class="axis-end">' +
      fmt(max) +
      "</span>" +
      "</div>" +
      legend(data.plan) +
      "</section>"
    );
  }
  function issuesBanner() {
    const a = M.analyze(data.plan);
    if (!a.issues.length) return "";
    return (
      '<section class="alert" aria-label="Prerequisites needing attention">' +
      icon("alert", 18) +
      '<div class="alert-content"><strong>' +
      a.issues.length +
      " prerequisite" +
      (a.issues.length > 1 ? "s need" : " needs") +
      " attention</strong>" +
      a.issues
        .map((issue) => {
          const b = byId(issue.block),
            p = byId(issue.prerequisite);
          return (
            "<p><b>" +
            esc(b.title) +
            "</b> " +
            (issue.kind === "missing" ? "needs " : "must come after ") +
            esc(p.title) +
            (issue.kind === "missing" ? ", which is set aside." : ".") +
            '</p><div class="alert-actions">' +
            button(
              issue.kind === "missing"
                ? "Restore " + esc(p.title)
                : "Review speaking order",
              issue.kind === "missing" ? "restore" : "review-order",
              {
                id: issue.prerequisite,
                class: "small-btn",
                icon: issue.kind === "missing" ? "restore" : "timeline",
              },
            ) +
            button("Review link", "edit-block", {
              id: b.id,
              class: "small-btn",
            }) +
            "</div>"
          );
        })
        .join("") +
      "</div></section>"
    );
  }
  function card(b, index, a) {
    const speaker = data.plan.speakers.find((s) => s.id === b.speaker),
      issue = a.issues.find((x) => x.block === b.id);
    const used = data.plan.blocks.filter(
      (x) => x.included && x.requires.includes(b.id),
    );
    return (
      '<article class="block-card ' +
      (selected === b.id ? "selected " : "") +
      (issue ? "has-issue" : "") +
      '" data-color="' +
      speaker.color +
      '" data-block="' +
      b.id +
      '" draggable="true" aria-label="' +
      esc(b.title) +
      ' content block">' +
      '<button class="block-main" data-action="select-block" data-id="' +
      b.id +
      '" aria-label="Edit ' +
      esc(b.title) +
      '" aria-pressed="' +
      (selected === b.id) +
      '"><span class="block-top"><span>' +
      String(index + 1).padStart(2, "0") +
      '</span><span class="grip" title="Drag to reorder">' +
      icon("grip", 12) +
      '</span></span><span class="block-title">' +
      esc(b.title) +
      '</span><span class="block-bottom"><span class="block-duration num">' +
      fmt(b.seconds) +
      "</span>" +
      (issue
        ? '<span class="badge warn">Check link</span>'
        : b.optional
          ? '<span class="badge neutral">Optional</span>'
          : used.length
            ? '<span class="block-link">' +
              icon("link", 12) +
              "Needed later</span>"
            : b.requires.length
              ? '<span class="block-link">' + icon("link", 12) + "Linked</span>"
              : "") +
      "</span></button>" +
      '<div class="block-footer"><span>' +
      (used.length
        ? "Needed by " +
          esc(used[0].title) +
          (used.length > 1 ? " +" + (used.length - 1) : "")
        : b.requires.length
          ? "Requires " +
            esc(byId(b.requires[0]).title) +
            (b.requires.length > 1 ? " +" + (b.requires.length - 1) : "")
          : "") +
      '</span><button class="cut-btn" data-action="set-aside" data-id="' +
      b.id +
      '" aria-label="Set aside ' +
      esc(b.title) +
      '">' +
      icon("cut", 11) +
      "Set aside</button></div></article>"
    );
  }
  function board() {
    const a = M.analyze(data.plan),
      ordered = M.ordered(data.plan);
    return (
      '<section class="panel"><div class="panel-header"><div><h2>Speaking plan</h2><p>Keep the order clear. Keep the story connected.</p></div><div class="segmented" aria-label="Plan view">' +
      '<button data-action="cards-view" aria-pressed="' +
      (boardView === "cards") +
      '">' +
      icon("grid", 12) +
      'Cards</button><button data-action="timeline-view" aria-pressed="' +
      (boardView === "timeline") +
      '">' +
      icon("timeline", 12) +
      "Timeline</button></div></div>" +
      (boardView === "cards"
        ? data.plan.speakers
            .map((s) => {
              const blocks = ordered.filter(
                  (b) => b.speaker === s.id && b.included,
                ),
                total = blocks.reduce((v, b) => v + b.seconds, 0);
              return (
                '<div class="speaker-row" data-color="' +
                s.color +
                '" data-speaker-drop="' +
                s.id +
                '"><div class="speaker-label"><span class="speaker-avatar">' +
                esc(s.name.slice(0, 1).toUpperCase()) +
                "</span><strong>" +
                esc(s.name) +
                '</strong><span class="num">' +
                fmt(total) +
                '</span></div><div class="cards">' +
                (blocks.length
                  ? blocks.map((b) => card(b, ordered.indexOf(b), a)).join("")
                  : '<div class="row-empty">No blocks in this section. ' +
                    button("Add one", "add-block", {
                      id: s.id,
                      class: "ghost small-btn",
                      icon: "plus",
                    }) +
                    "</div>") +
                "</div></div>"
              );
            })
            .join("")
        : timeline()) +
      '<div class="board-footer"><span>' +
      icon("grip", 12) +
      "Drag to reorder. Move controls are in block details.</span>" +
      button("Speakers", "settings", {
        icon: "users",
        class: "ghost small-btn",
      }) +
      "</div></section>"
    );
  }
  function timeline() {
    const a = M.analyze(data.plan),
      max = Math.max(data.plan.target, a.total, 60),
      ticks = Array.from({ length: 7 }, (_, i) => ({
        pct: (i / 6) * 100,
        time: Math.round((max * i) / 6),
      }));
    const positions = {};
    const rows = data.plan.speakers
      .map((s, si) => {
        const blocks = a.included.filter((b) => b.speaker === s.id);
        return (
          '<div class="timeline-row" data-color="' +
          s.color +
          '"><div class="speaker-label"><strong title="' +
          esc(s.name) +
          '">' +
          esc(s.name) +
          '</strong><span class="num">' +
          fmt(a.bySpeaker.find((x) => x.id === s.id).seconds) +
          '</span></div><div class="timeline-lane">' +
          blocks
            .map((b) => {
              const t = a.schedule.find((t) => t.id === b.id);
              positions[b.id] = {
                x: ((t.start + b.seconds / 2) / max) * 100,
                y: si * 104 + 28,
              };
              return (
                '<button class="timeline-block ' +
                (selected === b.id ? "selected " : "") +
                (a.issues.some((i) => i.block === b.id) ? "has-issue " : "") +
                (b.seconds / max < 0.045 ? "compact" : "") +
                '" style="left:' +
                (t.start / max) * 100 +
                "%;width:calc(" +
                (b.seconds / max) * 100 +
                (b.seconds / max < 0.045
                  ? '%)" title="'
                  : '% - 3px)" title="') +
                esc(b.title + " · " + fmt(b.seconds)) +
                '" data-action="select-block" data-id="' +
                b.id +
                '" aria-label="Edit ' +
                esc(b.title) +
                ", " +
                fmt(t.start) +
                " to " +
                fmt(t.end) +
                '"><strong>' +
                esc(b.title) +
                '</strong><span class="num">' +
                fmt(b.seconds) +
                "</span></button>"
              );
            })
            .join("") +
          "</div></div>"
        );
      })
      .join("");
    const links = a.included
      .flatMap((b) =>
        b.requires
          .filter((id) => positions[id])
          .map((id) => {
            const p = positions[id],
              t = positions[b.id];
            const sourceY = p.y < t.y ? p.y + 54 : p.y;
            return (
              '<path d="M ' +
              p.x +
              " " +
              sourceY +
              " V " +
              (t.y - 12) +
              " H " +
              t.x +
              " V " +
              t.y +
              '" fill="none" stroke="#6678b7" stroke-width="1.2" vector-effect="non-scaling-stroke" opacity=".65"/>'
            );
          }),
      )
      .join("");
    const relationList = data.plan.blocks
      .flatMap((b) =>
        b.requires.map(
          (id) =>
            '<div class="relationship-row">' +
            icon("link", 13) +
            '<button data-action="select-block" data-id="' +
            id +
            '">' +
            esc(byId(id).title) +
            "</button>" +
            icon("arrow", 13) +
            '<button data-action="select-block" data-id="' +
            b.id +
            '">' +
            esc(b.title) +
            "</button>" +
            (!b.included
              ? "<span>Dependent set aside</span>"
              : a.issues.some((i) => i.block === b.id && i.prerequisite === id)
                ? '<span class="badge warn">Needs attention</span>'
                : '<span class="badge good">Connected</span>') +
            "</div>",
        ),
      )
      .join("");
    return (
      '<p class="timeline-hint">' +
      icon("arrow", 13) +
      ' Scroll horizontally to explore the full timeline. Select a block for details.</p><div class="timeline-scroll" tabindex="0" role="region" aria-label="Speaking timeline, scroll horizontally"><div class="timeline-chart"><div class="timeline-head">' +
      ticks
        .map(
          (t) =>
            '<span class="timeline-tick num" style="left:' +
            t.pct +
            '%">' +
            fmt(t.time) +
            "</span>",
        )
        .join("") +
      "</div>" +
      rows +
      '<svg class="timeline-links" viewBox="0 0 100 ' +
      data.plan.speakers.length * 104 +
      '" preserveAspectRatio="none" aria-hidden="true">' +
      links +
      '</svg><div class="timeline-limit" style="left:calc(96px + (100% - 96px) * ' +
      data.plan.target / max +
      ')"></div></div></div><div class="timeline-relationships">' +
      (relationList ||
        "No prerequisites marked yet. Add a link in block details.") +
      '<p class="field-help">Time runs left to right. Lines connect marked prerequisites to the content that needs them.</p></div>'
    );
  }
  function tray() {
    const blocks = M.ordered(data.plan).filter((b) => !b.included);
    return (
      '<section class="tray" data-drop-tray="true" aria-label="Set aside blocks"><div class="tray-title">' +
      icon("cut", 14) +
      "Set aside <span>" +
      blocks.length +
      " block" +
      (blocks.length === 1 ? "" : "s") +
      "</span></div>" +
      (blocks.length
        ? '<div class="tray-list">' +
          blocks
            .map(
              (b) =>
                '<div class="tray-block"><button class="text-btn" data-action="select-block" data-id="' +
                b.id +
                '">' +
                esc(b.title) +
                '</button><span class="num">' +
                fmt(b.seconds) +
                '</span><button class="restore-small" data-action="restore" data-id="' +
                b.id +
                '" aria-label="Restore ' +
                esc(b.title) +
                '">' +
                icon("restore", 13) +
                "</button></div>",
            )
            .join("") +
          "</div>"
        : '<p class="tray-empty">Drag a block here, or choose Set aside. Your content stays available to restore.</p>') +
      "</section>"
    );
  }
  function inspector() {
    const b = byId(selected);
    if (!b)
      return (
        '<aside class="panel inspector"><div class="empty-state">' +
        icon("grid", 26) +
        "<h2>Your next idea starts here.</h2><p>Add a content block to give it a speaker, a rehearsed time, and any prerequisites.</p>" +
        button("Add a block", "add-block", { class: "primary", icon: "plus" }) +
        "</div></aside>"
      );
    const s = data.plan.speakers.find((x) => x.id === b.speaker),
      a = M.analyze(data.plan),
      used = data.plan.blocks.filter((x) => x.requires.includes(b.id));
    const peers = data.plan.blocks.filter((x) => x.speaker === b.speaker),
      index = peers.findIndex((x) => x.id === b.id);
    return (
      '<aside class="panel inspector" id="inspector" aria-labelledby="block-heading"><div class="inspector-top">' +
      button("Back to plan", "back-to-plan", {
        class: "ghost small-btn mobile-back",
        icon: "left",
      }) +
      '<div class="eyebrow">Block details' +
      button("", "edit-block", {
        id: b.id,
        class: "ghost icon-btn",
        icon: "edit",
        label: "Edit all details for " + b.title,
      }) +
      '</div><h2 id="block-heading" tabindex="-1">' +
      esc(b.title) +
      '</h2><div class="inspector-meta" data-color="' +
      s.color +
      '"><i class="color-dot"></i>' +
      esc(s.name) +
      '<span aria-hidden="true">·</span><span>' +
      (b.included ? "Included in talk" : "Set aside") +
      "</span></div></div>" +
      '<div class="inspector-content"><form data-form="quick-time" novalidate><div class="field"><label class="field-label" for="quick-duration">Rehearsed duration</label><div class="inline-field"><input id="quick-duration" name="duration" value="' +
      fmt(b.seconds) +
      '" inputmode="text" autocomplete="off" aria-describedby="duration-help duration-error"><button type="submit" class="btn">Update</button></div><p class="field-help" id="duration-help">Minutes:seconds, measured in rehearsal.</p><p id="duration-error" class="error" role="alert" hidden></p></div></form>' +
      '<div class="connection ' +
      (a.issues.some((i) => i.block === b.id) ? "warning" : "good") +
      '"><div class="connection-header">' +
      icon("link", 13) +
      "Required before this block</div>" +
      (b.requires.length
        ? b.requires
            .map(
              (id) =>
                '<button class="connection-link" data-action="select-block" data-id="' +
                id +
                '">' +
                esc(byId(id).title) +
                (byId(id).included ? "" : " · set aside") +
                "</button>",
            )
            .join("")
        : '<p class="small muted">No prerequisites marked</p>') +
      '<button class="text-btn small" data-action="edit-block" data-id="' +
      b.id +
      '" style="font-size:10px;margin-top:6px">Edit links</button></div>' +
      (used.length
        ? '<div class="connection"><div class="connection-header">' +
          icon("arrow", 13) +
          "Needed by</div>" +
          used
            .map(
              (x) =>
                '<button class="connection-link" data-action="select-block" data-id="' +
                x.id +
                '">' +
                esc(x.title) +
                (x.included ? "" : " · set aside") +
                "</button>",
            )
            .join("") +
          "</div>"
        : "") +
      (b.notes ? '<p class="inspector-note">' + esc(b.notes) + "</p>" : "") +
      button(
        b.included ? "Set aside this block" : "Restore to talk",
        b.included ? "set-aside" : "restore",
        {
          id: b.id,
          class: "inspector-cta " + (b.included ? "" : "primary"),
          icon: b.included ? "cut" : "restore",
        },
      ) +
      '<p class="field-help">' +
      (b.included
        ? "Keeps the content, removes its time from this plan."
        : "Restores its duration and place in the speaking order.") +
      '</p><div class="inspector-divider"></div><div class="move-controls">' +
      button("Move earlier", "move-earlier", {
        id: b.id,
        icon: "left",
        disabled: index === 0,
      }) +
      button("Move later", "move-later", {
        id: b.id,
        icon: "arrow",
        disabled: index === peers.length - 1,
      }) +
      '</div><p class="field-help">Within ' +
      esc(s.name) +
      "’s section. Change speaker in Edit details.</p></div></aside>"
    );
  }
  function planPage() {
    return (
      projectHeader() +
      timePanel() +
      (session && !session.finished
        ? '<div class="alert info">' +
          icon("clock", 18) +
          '<div class="alert-content"><strong>Rehearsal in progress</strong><p>Finish or discard it before changing this plan.</p></div>' +
          button("Return to rehearsal", "rehearse") +
          "</div>"
        : "") +
      issuesBanner() +
      '<div class="content-layout"><div class="plan-board" id="board">' +
      board() +
      tray() +
      "</div>" +
      inspector() +
      "</div>"
    );
  }
  function chosenPlan(id) {
    return id === "working"
      ? {
          id: "working",
          name: "Working draft",
          description: "Your current presentation plan.",
          example: false,
          plan: data.plan,
        }
      : data.versions.find((v) => v.id === id);
  }
  function versionOptions(id) {
    return (
      '<option value="working"' +
      (id === "working" ? " selected" : "") +
      ">Working draft</option>" +
      data.versions
        .map(
          (v) =>
            '<option value="' +
            v.id +
            '"' +
            (id === v.id ? " selected" : "") +
            ">" +
            esc(v.name) +
            (v.example ? " · example" : "") +
            "</option>",
        )
        .join("")
    );
  }
  function versionCard(id, side) {
    const v = chosenPlan(id),
      a = M.analyze(v.plan);
    return (
      '<section class="panel version-card"><div class="version-card-head"><label class="field-label" for="compare-' +
      side +
      '">' +
      (side === "left" ? "First" : "Second") +
      ' comparison</label><select class="control" aria-label="' +
      (side === "left" ? "Left" : "Right") +
      ' comparison plan" title="' +
      esc(v.name) +
      '" id="compare-' +
      side +
      '" data-compare="' +
      side +
      '">' +
      versionOptions(id) +
      '</select></div><div class="version-summary"><div class="version-time"><strong>' +
      fmt(a.total) +
      "</strong><span>of " +
      fmt(v.plan.target) +
      "<br>" +
      (a.difference > 0
        ? fmt(a.difference) + " over"
        : a.difference < 0
          ? fmt(-a.difference) + " to spare"
          : "On time") +
      "</span></div>" +
      status(v.plan) +
      '</div><div class="mini-bar" aria-hidden="true">' +
      a.bySpeaker
        .map(
          (s) =>
            '<span data-color="' +
            s.color +
            '" style="width:' +
            (a.total ? (s.seconds / a.total) * 100 : 0) +
            '%"></span>',
        )
        .join("") +
      "</div>" +
      legend(v.plan) +
      "<p>" +
      esc(v.description) +
      '</p><div class="version-actions">' +
      (id === "working"
        ? button("Edit working draft", "plan", {
            class: "secondary",
            icon: "edit",
          })
        : button("Use this plan", "open-version", {
            id,
            icon: "arrow",
            class: "secondary",
          })) +
      "</div></section>"
    );
  }
  function versionLibrary() {
    return '<section class="panel version-library" aria-label="Saved versions"><div class="library-heading"><h2>Saved versions <span class="count-pill">' + data.versions.length + '</span></h2><p class="muted">Each version is a separate snapshot. Compare any two below.</p></div>' +
      (data.versions.length ? '<div class="saved-version-list">' + data.versions.map(v => {
        const a = M.analyze(v.plan);
        return '<article class="saved-version-row" data-version-id="' + esc(v.id) + '"><div class="saved-version-info"><h3>' + esc(v.name) + '</h3><p class="muted"><span class="num">' + fmt(a.total) + '</span> / ' + fmt(v.plan.target) + ' · ' + a.included.length + ' included blocks' + (v.example ? ' · Example' : '') + '</p>' +
          (v.description ? '<p class="version-description">' + esc(v.description) + '</p>' : '') + '</div><div class="saved-version-actions">' +
          button("Open", "open-version", {id:v.id, icon:"arrow"}) + button("Duplicate", "duplicate-version", {id:v.id, icon:"copy"}) +
          button("Rename", "rename-version", {id:v.id, class:"ghost"}) + button("Delete", "delete-version", {id:v.id, class:"ghost danger-text", icon:"trash"}) + '</div></article>';
      }).join('') + '</div>' : '<div class="empty-state"><h3>No saved versions yet</h3><p>Your working plan is autosaved. Choose Save version to keep your first alternative.</p></div>') + '</section>';
  }
  function versionsPage() {
    const left = chosenPlan(compareLeft),
      right = chosenPlan(compareRight),
      rows = M.compare(left.plan, right.plan),
      changed = rows.filter((r) => r.changed);
    const cell = (plan, b, details = {}) => {
      if (!b) return '<span class="cut-value">Not in this plan</span>';
      const speaker = plan.speakers.find((s) => s.id === b.speaker),
        requires = b.requires
          .map((id) => plan.blocks.find((x) => x.id === id)?.title)
          .join(", ");
      return (
        (b.included
          ? '<span class="num">' + fmt(b.seconds) + "</span>"
          : '<span class="cut-value">Set aside</span>') +
        "<small>" +
        esc(speaker.name) +
        (requires ? " · Requires " + esc(requires) : "") +
        "</small>" +
        (details.order
          ? "<small>Block order " +
            (M.ordered(plan).findIndex((x) => x.id === b.id) + 1) +
            "</small>"
          : "") +
        (details.optional
          ? "<small>" +
            (b.optional ? "Optional content" : "Not marked optional") +
            "</small>"
          : "") +
        (details.notes
          ? '<details class="compare-notes"><summary>Speaking notes changed</summary><p>' +
            esc(b.notes || "No notes") +
            "</p></details>"
          : "")
      );
    };
    const intro = '<div class="project-header"><div><h1>Versions</h1><p class="project-subtitle">' + esc(currentProject().name) + ' · Save alternatives without changing earlier versions.</p></div>' +
      button("Save version", "save-version", { class:"primary", icon:"plus" }) + '</div>' + versionLibrary();
    if (!data.versions.length) return intro;
    return (
      intro + '<div class="comparison-intro"><h2>Compare two versions</h2><p class="muted">These are comparison slots, not the full list of saved versions.</p></div><div class="version-grid">' +
      versionCard(compareLeft, "left") +
      versionCard(compareRight, "right") +
      '</div><div class="compare-header"><div><h2>Compare block by block</h2><p>' +
      changed.length +
      " of " +
      rows.length +
      (rows.length === 1 ? " block differs" : " blocks differ") +
      (left.plan.target !== right.plan.target
        ? " · Time limits also differ"
        : "") +
      '.</p></div><label class="toggle-label"><input type="checkbox" id="differences-only"' +
      (differencesOnly ? " checked" : "") +
      '>Differences only</label></div><section class="panel"><div class="table-scroll"><table class="compare-table version-comparison"><thead><tr><th scope="col">CONTENT BLOCK</th><th scope="col">' +
      esc(left.name) +
      '</th><th scope="col">' +
      esc(right.name) +
      "</th></tr></thead><tbody>" +
      rows
        .filter((r) => !differencesOnly || r.changed)
        .map((r) => {
          const details = {
            notes: r.left && r.right && r.left.notes !== r.right.notes,
            optional: r.left && r.right && r.left.optional !== r.right.optional,
            order:
              r.left &&
              r.right &&
              M.ordered(left.plan).findIndex((b) => b.id === r.id) !==
                M.ordered(right.plan).findIndex((b) => b.id === r.id),
          };
          return (
            "<tr" +
            (r.changed ? ' class="changed"' : "") +
            "><td><strong>" +
            esc((r.left || r.right).title) +
            "</strong>" +
            (r.left && r.right && r.left.title !== r.right.title
              ? "<small>Renamed to " + esc(r.right.title) + "</small>"
              : "") +
            '</td><td data-label="' +
            esc(left.name) +
            '">' +
            cell(left.plan, r.left, details) +
            '</td><td data-label="' +
            esc(right.name) +
            '">' +
            cell(right.plan, r.right, details) +
            "</td></tr>"
          );
        })
        .join("") +
      (!rows.length || (differencesOnly && !changed.length)
        ? '<tr><td colspan="3"><div class="empty-state"><h3>' +
          (!rows.length
            ? "No content blocks yet"
            : "These plans have no block differences.") +
          "</h3></div></td></tr>"
        : "") +
      '</tbody></table></div><div class="table-footnote">' +
      icon("compare", 14) +
      "Highlighted rows show differences in content or speaking order.</div></section>"
    );
  }
  function rehearsalPage() {
    const a = M.analyze(data.plan);
    if (!session)
      return (
        '<div class="project-header"><div><h1>Rehearse your presentation</h1><p class="project-subtitle">Time each block, then review the results.</p></div></div>' +
        (!a.ready
          ? '<div class="alert">' +
            icon("alert", 18) +
            '<div class="alert-content"><strong>Your plan is still a draft</strong><p>' +
            (!a.included.length
              ? "Add at least one included block before rehearsing."
              : a.issues.length
                ? "Marked prerequisites need attention. You can rehearse to investigate, or fix the plan first."
                : "You are " +
                  fmt(a.difference) +
                  " over the limit. Rehearse to measure actual delivery.") +
            "</p></div>" +
            button("Review plan", "plan", { class: "small-btn" }) +
            "</div>"
          : "") +
        '<section class="panel rehearsal-intro"><div class="rehearsal-intro-icon">' +
        icon("clock", 40) +
        "</div><div><h2>Time each block as you speak.</h2><p>Start speaking, then tap Next block at each handoff. Pause for discussion. At the end, review the recorded times before updating your plan.</p>" +
        button("Start rehearsal", "start-rehearsal", {
          icon: "play",
          class: "primary",
          disabled: !a.included.length,
        }) +
        '<p class="field-help" style="margin-bottom:0">Times are measured by the timer. No microphone or recording is used.</p></div></section><div style="margin-top:22px">' +
        timePanel() +
        "</div>"
      );
    if (session.finished) return rehearsalResults();
    const b = session.blocks[session.index],
      s = session.plan.speakers.find((s) => s.id === b.speaker),
      done = session.records.reduce((sum, r) => sum + r.actual, 0),
      next = session.blocks[session.index + 1];
    return (
      '<div class="project-header"><div><h1>Rehearsal</h1><p class="project-subtitle">' +
      esc(session.plan.title) +
      " · " +
      session.blocks.length +
      (session.blocks.length === 1 ? " block · " : " blocks · ") +
      fmt(session.plan.target) +
      ' limit</p></div><span class="badge ' +
      (session.running ? "good" : "neutral") +
      '">' +
      (session.running ? "Timer running" : "Paused") +
      '</span></div><div class="rehearsal-layout"><section class="panel rehearsal-stage"><div class="eyebrow" data-color="' +
      s.color +
      '"><i class="color-dot"></i>' +
      esc(s.name) +
      " · BLOCK " +
      (session.index + 1) +
      " OF " +
      session.blocks.length +
      "</div><h2>" +
      esc(b.title) +
      '</h2><div class="timer" id="live-timer" aria-label="Current block elapsed time">' +
      fmt(elapsedSeconds()) +
      '</div><div class="timer-detail"><span>Planned <b class="num">' +
      fmt(b.seconds) +
      '</b></span><span>Total <b class="num" id="live-total">' +
      fmt(done + elapsedSeconds()) +
      '</b></span></div><p class="rehearsal-note">' +
      esc(
        b.notes ||
          "Speak naturally. Move to the next block when you finish this section.",
      ) +
      '</p><div class="rehearsal-controls">' +
      button(
        session.running ? "Pause" : "Resume",
        session.running ? "pause-rehearsal" : "resume-rehearsal",
        { icon: session.running ? "pause" : "play" },
      ) +
      button(next ? "Next block" : "Finish rehearsal", "next-rehearsal", {
        icon: next ? "arrow" : "check",
        class: "primary",
      }) +
      '</div><div class="rehearsal-bottom"><span>' +
      (next
        ? "Up next: " +
          esc(next.title) +
          " · " +
          esc(session.plan.speakers.find((s) => s.id === next.speaker).name)
        : "This is the final block.") +
      '</span><button class="text-btn" data-action="finish-early">Finish early</button></div><button class="text-btn small" data-action="discard-rehearsal" style="margin-top:14px;color:var(--muted);font-size:10px">Discard rehearsal</button></section><aside class="panel rehearsal-queue"><h3>Speaking order</h3>' +
      session.blocks
        .map(
          (x, i) =>
            '<div class="queue-item ' +
            (i === session.index ? "current" : "") +
            '"><span class="queue-number">' +
            (i < session.index
              ? icon("check", 13)
              : String(i + 1).padStart(2, "0")) +
            '</span><span class="queue-copy"><strong>' +
            esc(x.title) +
            "</strong><small>" +
            esc(session.plan.speakers.find((s) => s.id === x.speaker).name) +
            '</small></span><span class="num">' +
            fmt(x.seconds) +
            "</span></div>",
        )
        .join("") +
      "</aside></div>"
    );
  }
  function rehearsalResults() {
    session.applied =
      !!session.appliedIds?.length &&
      session.appliedIds.every(
        (id) =>
          data.plan.blocks.find((b) => b.id === id)?.seconds ===
          session.records.find((r) => r.id === id)?.actual,
      );
    const total = session.records.reduce((sum, r) => sum + r.actual, 0),
      planned = session.records.reduce((sum, r) => sum + r.planned, 0),
      partial = session.records.length < session.blocks.length;
    return (
      '<div class="project-header"><div><h1>Review rehearsal</h1><p class="project-subtitle">' +
      (partial ? "Partial rehearsal" : "Rehearsal complete") +
      " · " +
      session.records.length +
      " of " +
      session.blocks.length +
      (session.blocks.length === 1
        ? " block timed</p></div>"
        : " blocks timed</p></div>") +
      button("Back to plan", "plan", { icon: "left" }) +
      '</div><section class="panel rehearsal-summary"><div><h2>Review before you update.</h2><p>' +
      (session.applied
        ? "Recorded times have been applied to your working plan."
        : "Choose the measured times you want to use. Untimed blocks keep their current duration.") +
      '</p></div><div class="summary-numbers"><div><strong>' +
      fmt(total) +
      "</strong><span>Recorded" +
      (partial ? " portion" : " total") +
      "</span></div><div><strong>" +
      fmt(planned) +
      "</strong><span>Planned" +
      (partial ? " portion" : " total") +
      '</span></div></div></section><section class="panel"><form data-form="rehearsal-results"><div class="table-scroll"><table class="compare-table results-table"><thead><tr><th>CONTENT BLOCK</th><th>PLANNED</th><th>RECORDED</th><th>USE TIME</th></tr></thead><tbody>' +
      session.records
        .map(
          (r) =>
            "<tr><td><strong>" +
            esc(r.title) +
            '</strong></td><td class="num" data-label="Planned">' +
            fmt(r.planned) +
            '</td><td class="num" data-label="Recorded">' +
            fmt(r.actual) +
            "<small>" +
            (r.actual === r.planned
              ? ""
              : r.actual - r.planned > 0
                ? "+"
                : "−") +
            fmt(Math.abs(r.actual - r.planned)) +
            '</small></td><td data-label="Use time"><input type="checkbox" name="record" value="' +
            r.id +
            '" checked ' +
            (session.applied ? "disabled" : "") +
            ' aria-label="Use recorded time for ' +
            esc(r.title) +
            '"></td></tr>',
        )
        .join("") +
      '</tbody></table></div><div class="modal-actions">' +
      button("New rehearsal", "new-rehearsal", { icon: "play" }) +
      '<button type="submit" class="btn primary"' +
      (session.applied ? " disabled" : "") +
      ">" +
      icon("check", 15) +
      (session.applied ? "Times applied" : "Use selected times") +
      "</button></div></form></section>"
    );
  }
  function footer() {
    return (
      '<footer class="page-footer"><span>' +
      (isDemo
        ? "Demo workspace. Changes stay in this tab; Reset demo restores the sample."
        : "Made for a shared rehearsal. Changes and saved plans stay in this browser.") +
      '</span><div class="footer-links"><button class="text-btn" data-action="export">' +
      icon("download", 12) +
      ' Export backup</button><button class="text-btn" data-action="import">' +
      icon("upload", 12) +
      ' Import backup</button></div></footer>'
    );
  }
  function render() {
    const key = focusKey();
    if (!byId(selected)) selected = data.plan.blocks[0]?.id || null;
    if (!chosenPlan(compareLeft))
      compareLeft = data.versions[0]?.id || "working";
    if (!chosenPlan(compareRight))
      compareRight = data.versions.find(v => v.id !== compareLeft)?.id || "working";
    app.innerHTML =
      (isDemo
        ? '<div class="demo-notice"><span>Demo workspace · separate from your saved plans</span><div><a href="index.html">Review hub</a><a href="demo.html?fresh=1">Reset demo</a></div></div>'
        : "") +
      header() +
      (!storageOk
        ? '<div class="storage-warning" role="alert">Browser storage is unavailable. Export a backup to keep your changes.</div>'
        : "") +
      '<main id="main" class="workspace">' +
      (view === "projects" ? projectsPage() : workspaceNav() + (view === "plan"
        ? planPage()
        : view === "versions"
          ? versionsPage()
          : rehearsalPage())) +
      footer() +
      "</main>";
    restoreFocus(key);
    updateTimerDisplay();
  }
  function selectBlock(id) {
    selected = id;
    view = "plan";
    render();
    if (matchMedia("(max-width:900px)").matches) {
      document
        .getElementById("inspector")
        .scrollIntoView({ behavior: "instant", block: "start" });
      document.getElementById("block-heading")?.focus({ preventScroll: true });
    }
  }
  function toggleBlock(id, included) {
    const b = byId(id);
    if (!b) return;
    selected = id;
    commit(
      (next) => {
        next.plan.blocks.find((b) => b.id === id).included = included;
      },
      b.title +
        (included ? " restored to the talk." : " set aside. Content is kept."),
    );
    const count = M.analyze(data.plan).issues.length;
    announce(
      fmt(M.analyze(data.plan).total) +
        " planned. " +
        count +
        " prerequisite issue" +
        (count === 1 ? "" : "s") +
        ".",
    );
  }
  function openVersion(id) {
    const version = data.versions.find((v) => v.id === id);
    if (!version) return;
    if (!matchingVersion() && data.versions.length >= 100) {
      toast("Delete an unused version to make room for your current draft before opening another. No work was changed.");
      return;
    }
    const oldName = uniqueName("Draft before switching");
    commit(
      (next) => {
        if (!matchingVersion() && next.versions.length < 100)
          next.versions.push({
            id: uid("draft"),
            name: oldName,
            description: "Working draft kept before opening another plan.",
            example: false,
            plan: M.clone(next.plan),
          });
        next.plan = M.clone(version.plan);
        next.plan.title = currentProject().name;
        next.activeVersionId = id;
      },
      "Opened " + version.name + ". Your previous work is kept.",
    );
    session = null; clearInterval(timerInterval);
    view = "plan";
    render();
    document.getElementById("main").scrollIntoView({ behavior: "instant" });
  }
  function modalShell(title, body, actions, form) {
    modalReturn = focusKey();
    modal.innerHTML =
      '<div class="modal-head"><h2 id="modal-title">' +
      esc(title) +
      "</h2>" +
      button("", "close-modal", {
        icon: "close",
        class: "ghost icon-btn",
        label: "Close dialog",
      }) +
      "</div>" +
      (form
        ? '<form data-form="' + form + '" class="dialog-form" novalidate>'
        : "") +
      '<div class="modal-body">' +
      body +
      '</div><p class="modal-error" id="modal-error" role="alert" hidden></p><div class="modal-actions">' +
      actions +
      "</div>" +
      (form ? "</form>" : "");
    if (!modal.open) modal.showModal();
  }
  function closeModal() {
    modal.close();
    restoreFocus(modalReturn);
  }
  const cancelButton = () => button("Cancel", "close-modal");
  function formError(message, field) {
    const el = document.getElementById("modal-error");
    el.textContent = message;
    el.hidden = false;
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
  }
  function blockDialog(id, speakerId) {
    const b = byId(id) || {
      id: "",
      title: "",
      speaker: speakerId || data.plan.speakers[0].id,
      seconds: 60,
      notes: "",
      optional: false,
      requires: [],
    };
    modalShell(
      b.id ? "Edit block" : "Add a content block",
      '<input type="hidden" name="block-id" value="' +
        b.id +
        '"><div class="field"><label class="field-label" for="block-title">Block title</label><input id="block-title" name="title" value="' +
        esc(b.title) +
        '" maxlength="80" placeholder="What will you talk about?" required autofocus></div><div class="form-row"><div class="field"><label class="field-label" for="block-speaker">Speaker</label><select id="block-speaker" name="speaker">' +
        data.plan.speakers
          .map(
            (s) =>
              '<option value="' +
              s.id +
              '"' +
              (b.speaker === s.id ? " selected" : "") +
              ">" +
              esc(s.name) +
              "</option>",
          )
          .join("") +
        '</select></div><div class="field"><label class="field-label" for="block-duration">Rehearsed duration</label><input id="block-duration" name="duration" value="' +
        fmt(b.seconds) +
        '" autocomplete="off"><p class="field-help">Minutes:seconds, for example 1:30.</p></div></div><div class="field"><label class="field-label" for="block-notes">Speaking notes <span class="muted">(optional)</span></label><textarea id="block-notes" name="notes" maxlength="2000" placeholder="The point you want to make.">' +
        esc(b.notes) +
        '</textarea></div><div class="field"><span class="field-label" id="prerequisites-label">Required before this block</span><div class="dependency-list" role="group" aria-labelledby="prerequisites-label">' +
        data.plan.blocks
          .filter((x) => x.id !== b.id)
          .map(
            (x) =>
              '<label><input type="checkbox" name="requires" value="' +
              x.id +
              '"' +
              (b.requires.includes(x.id) ? " checked" : "") +
              '><span class="dependency-title">' +
              esc(x.title) +
              "</span><small>" +
              esc(data.plan.speakers.find((s) => s.id === x.speaker).name) +
              "</small></label>",
          )
          .join("") +
        (!data.plan.blocks.filter((x) => x.id !== b.id).length
          ? '<p class="small muted" style="padding:8px">Add another block before creating a link.</p>'
          : "") +
        '</div><p class="field-help">Mark only what the audience needs first. Circular links are not allowed.</p></div><label class="check-row"><input type="checkbox" name="optional"' +
        (b.optional ? " checked" : "") +
        ">Optional content · a possible cut</label>",
      (b.id
        ? button("Remove block", "remove-block", {
            id: b.id,
            class: "ghost danger",
            icon: "trash",
          }) + '<span style="flex:1"></span>'
        : "") +
        cancelButton() +
        '<button class="btn primary" type="submit">' +
        (b.id ? "Save changes" : "Add block") +
        "</button>",
      "block",
    );
  }
  function versionDialog(kind, id) {
    const v = data.versions.find((v) => v.id === id),
      name =
        kind === "save"
          ? uniqueName("Version " + (data.versions.filter(x => !x.example).length + 1))
          : kind === "duplicate"
            ? uniqueName((v?.name || "Working draft") + " copy")
            : v.name;
    modalShell(
      kind === "rename"
        ? "Rename saved version"
        : kind === "duplicate"
          ? "Duplicate version"
          : "Save this version",
      '<input type="hidden" name="version-kind" value="' +
        kind +
        '"><input type="hidden" name="version-id" value="' +
        esc(id || "") +
        '"><p>A saved version keeps its own content, timings, and prerequisites. You can compare it with another plan later.</p><div class="field"><label class="field-label" for="version-name">Version name</label><input id="version-name" name="name" maxlength="70" value="' +
        esc(name) +
        '" required autofocus></div><div class="field"><label class="field-label" for="version-note">What is different? <span class="muted">(optional)</span></label><textarea id="version-note" name="description" maxlength="240" placeholder="For example: keep the definition, cut the extra detail.">' +
        esc(v?.description || "") +
        "</textarea></div>",
      cancelButton() +
        '<button class="btn primary" type="submit">' +
        (kind === "rename" ? "Rename version" : kind === "duplicate" ? "Create copy" : "Save version") +
        "</button>",
      "version",
    );
  }
  function speakerRows() {
    return speakerDraft
      .map(
        (s, i) =>
          '<div class="speaker-settings-row" data-color="' +
          s.color +
          '"><span class="speaker-avatar">' +
          (i + 1) +
          '</span><input class="control" name="speaker-name" data-speaker-id="' +
          s.id +
          '" value="' +
          esc(s.name) +
          '" maxlength="40" aria-label="Speaker ' +
          (i + 1) +
          ' name">' +
          button("", "speaker-up", {
            id: s.id,
            icon: "up",
            class: "icon-btn",
            disabled: i === 0,
            label: "Move " + (s.name || "speaker") + " earlier",
          }) +
          button("", "speaker-down", {
            id: s.id,
            icon: "down",
            class: "icon-btn",
            disabled: i === speakerDraft.length - 1,
            label: "Move " + (s.name || "speaker") + " later",
          }) +
          "</div>",
      )
      .join("");
  }
  function settingsDialog() {
    speakerDraft = M.clone(data.plan.speakers);
    modalShell(
      "Presentation settings",
      '<div class="field"><label class="field-label" for="presentation-title">Presentation name</label><input id="presentation-title" name="title" value="' +
        esc(data.plan.title) +
        '" maxlength="100" autofocus></div><div class="field"><label class="field-label" for="time-limit">Time limit</label><input id="time-limit" name="target" value="' +
        fmt(data.plan.target) +
        '"><p class="field-help">Minutes:seconds. This is the full talk’s limit.</p></div><div class="field"><span class="field-label">Speakers, in speaking order</span><div id="speaker-fields">' +
        speakerRows() +
        "</div>" +
        button("Add speaker", "add-speaker", {
          class: "ghost small-btn",
          icon: "plus",
        }) +
        '<p class="field-help">Moving a speaker moves their entire section. Dependencies are checked again.</p></div>',
      cancelButton() +
        '<button class="btn primary" type="submit">Save settings</button>',
      "settings",
    );
  }
  function freshDialog() {
    modalShell(
      "New project",
      '<p>Each project has its own plan and versions. Your other projects stay in All projects.</p><div class="field"><label class="field-label" for="new-title">Project name</label><input id="new-title" name="title" maxlength="100" placeholder="My presentation" autofocus></div><div class="field"><label class="field-label" for="new-limit">Time limit</label><input id="new-limit" name="target" value="10:00"></div><div class="field"><label class="field-label" for="new-speakers">Speakers</label><input id="new-speakers" name="speakers" placeholder="Alex, Priya, Leo"><p class="field-help">Separate names with commas. One speaker is fine too.</p></div>',
      cancelButton() +
        '<button class="btn primary" type="submit">Create project</button>',
      "new",
    );
  }
  function helpDialog() {
    modalShell(
      "How Narrative Map works",
      '<ol class="help-steps"><li><strong>1. Map what you will say.</strong>Add blocks in speaking order. Enter times from rehearsal and mark what each block requires first.</li><li><strong>2. Try a cut and check its impact.</strong>Set aside a block to remove its time. A warning appears when later content loses a marked prerequisite. Restore it, or explicitly revise the link.</li><li><strong>3. Save alternatives, then compare.</strong>Keep snapshots of different cuts. Versions shows time, speaker allocation, and individual block differences.</li><li><strong>4. Rehearse and measure.</strong>Use the per-block timer, then choose which measured times to apply to your plan.</li></ol><p>Ready to rehearse means the current plan fits the limit and its marked prerequisites are included in order. It does not guarantee the live talk will fit or assess the meaning of your content.</p><div class="help-shortcuts"><span><kbd>⌘/Ctrl S</kbd> Save project</span><span><kbd>⌘/Ctrl Z</kbd> Undo</span><span><kbd>⌘/Ctrl Shift Z</kbd> Redo</span><span><kbd>Esc</kbd> Close a dialog</span></div><p><strong>Save</strong> saves the current project; edits also autosave. <strong>Save version</strong> keeps a separate snapshot. In Versions, use the full list to open, duplicate, rename, or delete a snapshot. <strong>All projects</strong> keeps different presentations separate. Export a backup to move all projects to another browser.</p>',
      button("Got it", "close-modal", { class: "primary" }),
    );
  }
  function elapsedSeconds() {
    if (!session || session.finished) return 0;
    return Math.max(
      0,
      Math.floor(
        (session.elapsed +
          (session.running ? performance.now() - session.started : 0)) /
          1000,
      ),
    );
  }
  function updateTimerDisplay() {
    if (!session || session.finished) return;
    const seconds = elapsedSeconds(),
      timer = document.getElementById("live-timer"),
      total = document.getElementById("live-total");
    if (timer) {
      timer.textContent = fmt(seconds);
      timer.classList.toggle(
        "over",
        seconds > session.blocks[session.index].seconds,
      );
    }
    if (total)
      total.textContent = fmt(
        session.records.reduce((sum, r) => sum + r.actual, 0) + seconds,
      );
  }
  function startRehearsal() {
    const blocks = M.ordered(data.plan, true);
    if (!blocks.length) return;
    session = {
      plan: M.clone(data.plan),
      blocks: M.clone(blocks),
      index: 0,
      records: [],
      elapsed: 0,
      started: performance.now(),
      running: true,
      finished: false,
      applied: false,
    };
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 200);
    view = "rehearse";
    render();
  }
  function finishBlock(early = false) {
    if (!session || session.finished) return;
    const actual = elapsedSeconds();
    if (actual < 1) {
      toast("Speak for at least one second before recording this block.");
      return;
    }
    const b = session.blocks[session.index];
    session.records.push({
      id: b.id,
      title: b.title,
      planned: b.seconds,
      actual,
    });
    if (early || session.index === session.blocks.length - 1) {
      session.finished = true;
      session.running = false;
      clearInterval(timerInterval);
    } else {
      session.index++;
      session.elapsed = 0;
      session.started = performance.now();
    }
    render();
  }
  function downloadBackup() {
    syncProject();
    const blob = new Blob([JSON.stringify(library, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "narrative-map-backup.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast(
      "Backup exported. It includes every project, working plan, and saved version.",
    );
  }
  function readSpeakerFields() {
    document.querySelectorAll("[data-speaker-id]").forEach((el) => {
      const s = speakerDraft.find((s) => s.id === el.dataset.speakerId);
      if (s) s.name = el.value;
    });
  }
  const actions = {
    projects: () => { syncProject(); view = "projects"; render(); window.scrollTo({top:0, behavior:"instant"}); },
    "open-project": openProject,
    "save-project": saveProject,
    "delete-version": id => {
      const version = data.versions.find(v => v.id === id);
      if (!version) return;
      modalShell("Delete this version?", '<p><strong>' + esc(version.name) + '</strong> will be removed from this project. Your current working plan stays unchanged. Undo can restore the version.</p>', cancelButton() + button("Delete version", "confirm-delete-version", {id, class:"danger"}));
    },
    "confirm-delete-version": id => {
      if (commit(next => { next.versions = next.versions.filter(v => v.id !== id); }, "Version deleted. Your working plan is unchanged.")) closeModal();
    },
    plan: () => {
      view = "plan";
      render();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    },
    rehearse: () => {
      view = "rehearse";
      render();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    },
    versions: () => {
      view = "versions";
      render();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    },
    "cards-view": () => {
      boardView = "cards";
      render();
    },
    "timeline-view": () => {
      boardView = "timeline";
      render();
    },
    "select-block": (id) => selectBlock(id),
    "set-aside": (id) => toggleBlock(id, false),
    restore: (id) => toggleBlock(id, true),
    "review-order": (id) => {
      selected = id;
      boardView = "timeline";
      view = "plan";
      render();
    },
    "edit-block": (id) => blockDialog(id),
    "add-block": (speaker) => blockDialog(null, speaker),
    "move-earlier": (id) => moveWithin(id, -1),
    "move-later": (id) => moveWithin(id, 1),
    "back-to-plan": () => {
      document.getElementById("board")?.scrollIntoView({ behavior: "instant" });
      document
        .querySelector(
          '[data-action="select-block"][data-id="' + selected + '"]',
        )
        ?.focus({ preventScroll: true });
    },
    undo,
    redo,
    settings: settingsDialog,
    help: helpDialog,
    "close-modal": closeModal,
    "save-version": () => versionDialog("save"),
    "duplicate-version": (id) => versionDialog("duplicate", id),
    "rename-version": (id) => versionDialog("rename", id),
    "open-version": openVersion,
    "new-presentation": freshDialog,
    export: downloadBackup,
    import: () => document.getElementById("import-file").click(),
    "dismiss-toast": () => {
      document.getElementById("toast").hidden = true;
    },
    "add-speaker": () => {
      readSpeakerFields();
      if (speakerDraft.length >= 12) {
        formError("Use up to 12 speakers.");
        return;
      }
      speakerDraft.push({
        id: uid("speaker"),
        name: "",
        color: M.colors[speakerDraft.length % M.colors.length],
      });
      document.getElementById("speaker-fields").innerHTML = speakerRows();
      document
        .querySelectorAll("[data-speaker-id]")
        [speakerDraft.length - 1].focus();
    },
    "speaker-up": (id) => reorderSpeaker(id, -1),
    "speaker-down": (id) => reorderSpeaker(id, 1),
    "start-rehearsal": startRehearsal,
    "pause-rehearsal": () => {
      if (session?.running) {
        session.elapsed += performance.now() - session.started;
        session.running = false;
        render();
      }
    },
    "resume-rehearsal": () => {
      if (session && !session.finished) {
        session.started = performance.now();
        session.running = true;
        render();
      }
    },
    "next-rehearsal": () => finishBlock(),
    "finish-early": () => finishBlock(true),
    "discard-rehearsal": () =>
      modalShell(
        "Discard this rehearsal?",
        "<p>Recorded times from this run will be discarded. Your presentation plan will stay unchanged.</p>",
        cancelButton() +
          button("Discard rehearsal", "confirm-discard", { class: "danger" }),
      ),
    "confirm-discard": () => {
      clearInterval(timerInterval);
      session = null;
      closeModal();
      render();
    },
    "new-rehearsal": () => {
      session = null;
      render();
    },
    "remove-block": (id) => {
      const b = byId(id),
        used = data.plan.blocks.filter((x) => x.requires.includes(id));
      if (used.length) {
        formError(
          "This block is required by " +
            used.map((x) => x.title).join(", ") +
            ". Set it aside, or remove those links before deleting it.",
        );
        return;
      }
      modalShell(
        "Remove " + b.title + "?",
        "<p>This removes the block from the working plan. Saved versions keep their copies, and Undo can restore this change.</p>",
        cancelButton() +
          button("Remove block", "confirm-remove", { id, class: "danger" }),
      );
    },
    "confirm-remove": (id) => {
      if (
        commit((next) => {
          next.plan.blocks = next.plan.blocks.filter((b) => b.id !== id);
        }, "Block removed.")
      )
        closeModal();
    },
  };
  function moveWithin(id, delta) {
    const b = byId(id),
      peers = data.plan.blocks.filter((x) => x.speaker === b.speaker),
      index = peers.findIndex((x) => x.id === id),
      target = peers[index + delta];
    if (target)
      commit(
        (next) => M.moveBlock(next.plan, id, target.id),
        b.title + " moved " + (delta < 0 ? "earlier." : "later."),
      );
  }
  function reorderSpeaker(id, delta) {
    readSpeakerFields();
    const i = speakerDraft.findIndex((s) => s.id === id),
      j = i + delta;
    if (j < 0 || j >= speakerDraft.length) return;
    [speakerDraft[i], speakerDraft[j]] = [speakerDraft[j], speakerDraft[i]];
    document.getElementById("speaker-fields").innerHTML = speakerRows();
  }
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger || trigger.disabled) return;
    const action = trigger.dataset.action;
    if (!actions[action]) return;
    if (
      session &&
      !session.finished &&
      [
        "edit-block",
        "add-block",
        "settings",
        "set-aside",
        "restore",
        "move-earlier",
        "move-later",
        "save-version",
        "duplicate-version",
        "rename-version",
        "open-version",
        "open-project",
        "delete-version",
        "confirm-delete-version",
        "new-presentation",
        "import",
        "undo",
        "redo",
      ].includes(action)
    ) {
      event.preventDefault();
      toast("Finish or discard the rehearsal before editing the plan.");
      return;
    }
    event.preventDefault();
    actions[action](trigger.dataset.id);
  });
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form.dataset.form) return;
    event.preventDefault();
    submitForm(form);
  });
  document.addEventListener("change", (event) => {
    if (event.target.dataset.compare) {
      if (event.target.dataset.compare === "left")
        compareLeft = event.target.value;
      else compareRight = event.target.value;
      render();
    }
    if (event.target.id === "differences-only") {
      differencesOnly = event.target.checked;
      render();
    }
  });
  document.addEventListener("keydown", (event) => {
    document.body.classList.add("keyboard-mode");
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (modal.open) modal.querySelector("form")?.requestSubmit();
      else if (view !== "projects") saveProject();
      return;
    }
    const editing = /INPUT|TEXTAREA|SELECT/.test(
      document.activeElement?.tagName,
    );
    if (
      !editing &&
      !modal.open &&
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "z"
    ) {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
  });
  document.addEventListener("pointerdown", () =>
    document.body.classList.remove("keyboard-mode"),
  );
  modal.addEventListener("close", () => restoreFocus(modalReturn));
  document
    .getElementById("import-file")
    .addEventListener("change", async (event) => {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;
      try {
        if (file.size > 20000000)
          throw new Error("Use a backup smaller than 20 MB.");
        const imported = M.libraryFrom(JSON.parse(await file.text()));
        if (!imported)
          throw new Error(
            "Use a valid Narrative Map Hi-Fi backup. Nothing was changed.",
          );
        syncProject();
        const merged = M.mergeLibraries(library, imported);
        const added = merged.projects.length - library.projects.length;
        library = merged;
        data = currentProject().data;
        persist(); view = "projects"; render();
        toast(storageOk ? (added ? added + " project" + (added === 1 ? "" : "s") + " imported. Existing projects were kept." : "These projects are already in your library. Nothing was replaced.") : "Imported in this tab only. Export a backup before leaving.");
      } catch (error) {
        toast(
          error instanceof SyntaxError
            ? "This file is not valid JSON. Nothing was changed."
            : error.message,
        );
      }
    });
  let dragged = null;
  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-block]");
    if (!card) return;
    dragged = card.dataset.block;
    event.dataTransfer.setData("text/plain", dragged);
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  document.addEventListener("dragover", (event) => {
    if (!dragged) return;
    const target = event.target.closest(
      "[data-block],[data-drop-tray],[data-speaker-drop]",
    );
    if (target) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      target.classList.add("drag-over");
    }
  });
  document.addEventListener("dragleave", (event) => {
    const target = event.target.closest(".drag-over");
    if (target && !target.contains(event.relatedTarget))
      target.classList.remove("drag-over");
  });
  document.addEventListener("drop", (event) => {
    if (!dragged) return;
    event.preventDefault();
    const id = dragged;
    dragged = null;
    const trayTarget = event.target.closest("[data-drop-tray]"),
      card = event.target.closest("[data-block]"),
      row = event.target.closest("[data-speaker-drop]");
    if (trayTarget) toggleBlock(id, false);
    else if (card && card.dataset.block !== id)
      commit(
        (next) => M.moveBlock(next.plan, id, card.dataset.block),
        "Block moved. Prerequisites checked again.",
      );
    else if (row && byId(id).speaker !== row.dataset.speakerDrop)
      commit((next) => {
        next.plan.blocks.find((b) => b.id === id).speaker =
          row.dataset.speakerDrop;
      }, "Block moved to another speaker.");
    document
      .querySelectorAll(".drag-over,.dragging")
      .forEach((x) => x.classList.remove("drag-over", "dragging"));
  });
  document.addEventListener("dragend", () => {
    dragged = null;
    document
      .querySelectorAll(".drag-over,.dragging")
      .forEach((x) => x.classList.remove("drag-over", "dragging"));
  });
  document
    .getElementById("toast")
    .addEventListener("mouseenter", () => clearTimeout(toastTimer));
  document
    .getElementById("toast")
    .addEventListener("focusin", () => clearTimeout(toastTimer));
  window.addEventListener("beforeunload", (event) => {
    if (session && !session.finished) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  function submitForm(form) {
    const values = new FormData(form),
      kind = form.dataset.form;
    if (kind === "quick-time") {
      const field = form.elements.duration,
        seconds = M.parseDuration(field.value),
        error = document.getElementById("duration-error");
      if (seconds === null) {
        field.setAttribute("aria-invalid", "true");
        error.hidden = false;
        error.textContent =
          "Enter a positive time such as 1:30. Seconds must be 00–59.";
        field.focus();
        return;
      }
      field.removeAttribute("aria-invalid");
      error.hidden = true;
      const b = byId(selected);
      if (seconds === b.seconds) {
        field.value = fmt(seconds);
        toast("Duration is already " + fmt(seconds) + ".");
        return;
      }
      commit(
        (next) => {
          next.plan.blocks.find((x) => x.id === b.id).seconds = seconds;
        },
        b.title + " updated to " + fmt(seconds) + ".",
      );
    } else if (kind === "block") {
      const title = String(values.get("title")).trim(),
        seconds = M.parseDuration(values.get("duration")),
        id = values.get("block-id");
      if (!title) {
        formError("Give this block a title.", form.elements.title);
        return;
      }
      if (seconds === null) {
        formError(
          "Enter a positive duration, such as 1:30.",
          form.elements.duration,
        );
        return;
      }
      if (!id && data.plan.blocks.length >= 120) {
        formError("This presentation already has 120 blocks.");
        return;
      }
      const block = {
        id: id || uid("block"),
        title,
        speaker: values.get("speaker"),
        seconds,
        notes: String(values.get("notes")).trim(),
        requires: values.getAll("requires"),
        optional: values.has("optional"),
        included: id ? byId(id).included : true,
      };
      const test = M.clone(data.plan);
      if (id) test.blocks[test.blocks.findIndex((b) => b.id === id)] = block;
      else test.blocks.push(block);
      if (M.cycle(test)) {
        formError(
          "These links create a circle. Remove a prerequisite so each block can come first in a clear order.",
        );
        return;
      }
      selected = block.id;
      if (
        commit(
          (next) => {
            next.plan = test;
          },
          id ? "Block updated." : "Content block added.",
        )
      )
        closeModal();
      else if (JSON.stringify(test) === JSON.stringify(data.plan)) closeModal();
    } else if (kind === "version") {
      const name = String(values.get("name")).trim(),
        description = String(values.get("description")).trim(),
        mode = values.get("version-kind"),
        id = values.get("version-id");
      if (!name) {
        formError("Give this version a name.", form.elements.name);
        return;
      }
      if (
        data.versions.some(
          (v) =>
            v.name.toLowerCase() === name.toLowerCase() &&
            !(mode === "rename" && v.id === id),
        )
      ) {
        formError(
          "That name is already in use. Choose a distinct name.",
          form.elements.name,
        );
        return;
      }
      if (mode !== "rename" && data.versions.length >= 100) {
        formError(
          "This project has 100 saved versions. Delete an unused version to make room.",
        );
        return;
      }
      const newId = uid("version");
      if (
        commit(
          (next) => {
            if (mode === "rename") {
              const v = next.versions.find((v) => v.id === id);
              v.name = name;
              v.description = description;
              v.example = false;
            } else {
              const plan =
                mode === "duplicate" && id !== "working"
                  ? next.versions.find((v) => v.id === id).plan
                  : next.plan;
              next.versions.push({
                id: newId,
                name,
                description,
                example: false,
                plan: M.clone(plan),
              });
              if (mode === "save") next.activeVersionId = newId;
            }
          },
          name + " " + (mode === "rename" ? "renamed." : "saved."),
        )
      ) {
        if (data.versions.length === 1 && mode !== "rename") { compareLeft = "working"; compareRight = newId; }
        closeModal();
        render();
        if (view === "versions" && mode !== "rename") document.querySelector('[data-version-id="' + newId + '"]')?.scrollIntoView({block:"nearest", behavior:"instant"});
      }
    } else if (kind === "settings") {
      const title = String(values.get("title")).trim(),
        target = M.parseDuration(values.get("target"));
      readSpeakerFields();
      if (!title) {
        formError("Enter a presentation name.", form.elements.title);
        return;
      }
      if (target === null) {
        formError(
          "Enter a positive time limit, such as 10:00.",
          form.elements.target,
        );
        return;
      }
      if (library.projects.some(p => p.id !== library.activeProjectId && p.name.toLowerCase() === title.toLowerCase())) {
        formError("Another project already uses this name.", form.elements.title); return;
      }
      const names = speakerDraft.map((s) => s.name.trim().toLowerCase());
      if (names.some((x) => !x) || new Set(names).size !== names.length) {
        formError("Give each speaker a distinct, nonempty name.");
        return;
      }
      const speakers = speakerDraft.map((s) => ({ ...s, name: s.name.trim() }));
      if (
        commit((next) => {
          next.plan.title = title;
          next.plan.target = target;
          next.plan.speakers = speakers;
        }, "Presentation settings updated.")
      )
        closeModal();
      else if (
        title === data.plan.title &&
        target === data.plan.target &&
        JSON.stringify(speakers) === JSON.stringify(data.plan.speakers)
      )
        closeModal();
    } else if (kind === "new") {
      const title = String(values.get("title")).trim(),
        target = M.parseDuration(values.get("target")),
        names = String(values.get("speakers"))
          .split(",")
          .map((x) => x.trim());
      if (!title) {
        formError("Enter a presentation name.", form.elements.title);
        return;
      }
      if (target === null) {
        formError("Enter a positive time limit.", form.elements.target);
        return;
      }
      if (
        !names.length ||
        names.length > 12 ||
        names.some((n) => !n || n.length > 40) ||
        new Set(names.map((n) => n.toLowerCase())).size !== names.length
      ) {
        formError(
          "Enter 1–12 distinct speaker names, separated by commas.",
          form.elements.speakers,
        );
        return;
      }
      if (library.projects.some(p => p.name.toLowerCase() === title.toLowerCase())) {
        formError("Another project already uses this name.", form.elements.title); return;
      }
      const workspace = { schema: 2, activeVersionId: null, versions: [], plan: {
        title, target, speakers: names.map((name, i) => ({id:uid("speaker"), name, color:M.colors[i % M.colors.length]})), blocks: []
      }};
      try {
        syncProject();
        const projectId = uid("project");
        library = M.addProject(library, projectId, workspace);
        data = currentProject().data;
        history.length = 0; future.length = 0;
        selected = null; session = null; clearInterval(timerInterval);
        compareLeft = "working"; compareRight = "working";
        view = "plan"; persist(); closeModal(); render();
        toast(storageOk ? "Project created. Find all your projects in All projects." : "Project created in this tab only. Export a backup before leaving.");
      } catch (error) { formError(error.message); }
    } else if (kind === "rehearsal-results") {
      const ids = values.getAll("record");
      if (!ids.length) {
        toast("Select at least one recorded time to apply.");
        return;
      }
      const existingIds = ids.filter((id) =>
        data.plan.blocks.some((b) => b.id === id),
      );
      if (!existingIds.length) {
        toast(
          "Those content blocks are no longer in the working plan. Open the matching plan first.",
        );
        return;
      }
      const same = existingIds.every(
        (id) =>
          byId(id).seconds === session.records.find((r) => r.id === id).actual,
      );
      if (
        commit(
          (next) =>
            session.records
              .filter((r) => existingIds.includes(r.id))
              .forEach((r) => {
                next.plan.blocks.find((b) => b.id === r.id).seconds = r.actual;
              }),
          "Recorded times applied to the working plan.",
        ) ||
        same
      ) {
        session.appliedIds = existingIds;
        render();
      }
    }
  }
  if (!startupNotice) persist();
  render();
  if (startupNotice) toast(startupNotice);
})();
