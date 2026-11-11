/* Narrative Map. Implementation assistance: OpenAI ChatGPT. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NarrativeModel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const colors = ["blue", "green", "ochre", "violet", "rose", "slate"];
  const format = (seconds) =>
    Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  function parseDuration(value) {
    const s = String(value).trim();
    if (!/^\d{1,3}(:[0-5]\d)?$/.test(s)) return null;
    const parts = s.split(":").map(Number);
    const seconds =
      parts.length === 1 ? parts[0] * 60 : parts[0] * 60 + parts[1];
    return seconds > 0 && seconds <= 35999 ? seconds : null;
  }
  function sample() {
    return {
      title: "Class presentation",
      target: 600,
      speakers: [
        { id: "alex", name: "Alex", color: "blue" },
        { id: "priya", name: "Priya", color: "green" },
        { id: "leo", name: "Leo", color: "ochre" },
      ],
      blocks: [
        {
          id: "b01",
          title: "Intro",
          speaker: "alex",
          seconds: 90,
          included: true,
          optional: false,
          requires: [],
          notes: "Introduce the question and the main point of our talk.",
        },
        {
          id: "b02",
          title: "Definition metric",
          speaker: "alex",
          seconds: 60,
          included: true,
          optional: false,
          requires: [],
          notes: "Define the metric before Leo interprets the results.",
        },
        {
          id: "b03",
          title: "Example",
          speaker: "alex",
          seconds: 90,
          included: true,
          optional: false,
          requires: [],
          notes: "Walk through one concrete example of the metric.",
        },
        {
          id: "b04",
          title: "Background",
          speaker: "priya",
          seconds: 90,
          included: true,
          optional: false,
          requires: [],
          notes:
            "Give the audience the context needed to understand our study.",
        },
        {
          id: "b05",
          title: "Method",
          speaker: "priya",
          seconds: 90,
          included: true,
          optional: false,
          requires: [],
          notes: "Explain how we collected and compared the observations.",
        },
        {
          id: "b06",
          title: "Extra detail",
          speaker: "priya",
          seconds: 120,
          included: true,
          optional: true,
          requires: [],
          notes: "An optional detail we can set aside if the talk runs long.",
        },
        {
          id: "b07",
          title: "Results",
          speaker: "leo",
          seconds: 90,
          included: true,
          optional: false,
          requires: [],
          notes: "Show the main results.",
        },
        {
          id: "b08",
          title: "Interpretation",
          speaker: "leo",
          seconds: 90,
          included: true,
          optional: false,
          requires: ["b02"],
          notes: "Explain what the results mean using the metric Alex defined.",
        },
      ],
    };
  }
  function ordered(plan, includedOnly = false) {
    return plan.speakers.flatMap((s) =>
      plan.blocks.filter(
        (b) => b.speaker === s.id && (!includedOnly || b.included),
      ),
    );
  }
  function cycle(plan) {
    const map = new Map(plan.blocks.map((b) => [b.id, b]));
    const visiting = new Set(),
      visited = new Set();
    function visit(id) {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      for (const dep of map.get(id)?.requires || [])
        if (visit(dep)) return true;
      visiting.delete(id);
      visited.add(id);
      return false;
    }
    return plan.blocks.some((b) => visit(b.id));
  }
  function validate(plan) {
    if (
      !plan ||
      typeof plan !== "object" ||
      typeof plan.title !== "string" ||
      !plan.title.trim() ||
      plan.title.length > 100
    )
      return false;
    if (
      !Number.isInteger(plan.target) ||
      plan.target < 1 ||
      plan.target > 35999
    )
      return false;
    if (
      !Array.isArray(plan.speakers) ||
      !plan.speakers.length ||
      plan.speakers.length > 12 ||
      !Array.isArray(plan.blocks) ||
      plan.blocks.length > 120
    )
      return false;
    const sids = new Set(),
      names = new Set();
    for (const s of plan.speakers) {
      if (
        !s ||
        typeof s.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(s.id) ||
        sids.has(s.id) ||
        typeof s.name !== "string" ||
        !s.name.trim() ||
        s.name.length > 40 ||
        names.has(s.name.trim().toLowerCase()) ||
        !colors.includes(s.color)
      )
        return false;
      sids.add(s.id);
      names.add(s.name.trim().toLowerCase());
    }
    const ids = new Set();
    for (const b of plan.blocks) {
      if (
        !b ||
        typeof b.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(b.id) ||
        ids.has(b.id) ||
        typeof b.title !== "string" ||
        !b.title.trim() ||
        b.title.length > 80 ||
        !sids.has(b.speaker) ||
        !Number.isInteger(b.seconds) ||
        b.seconds < 1 ||
        b.seconds > 35999 ||
        typeof b.included !== "boolean" ||
        typeof b.optional !== "boolean" ||
        typeof b.notes !== "string" ||
        b.notes.length > 2000 ||
        !Array.isArray(b.requires) ||
        b.requires.some((id) => typeof id !== "string") ||
        new Set(b.requires).size !== b.requires.length
      )
        return false;
      ids.add(b.id);
    }
    if (
      plan.blocks.some((b) =>
        b.requires.some((id) => id === b.id || !ids.has(id)),
      )
    )
      return false;
    return !cycle(plan);
  }
  function analyze(plan) {
    const all = ordered(plan),
      included = all.filter((b) => b.included);
    const positions = new Map(all.map((b, i) => [b.id, i]));
    const map = new Map(all.map((b) => [b.id, b])),
      issues = [];
    included.forEach((b) =>
      b.requires.forEach((id) => {
        const prerequisite = map.get(id);
        if (!prerequisite?.included)
          issues.push({ kind: "missing", block: b.id, prerequisite: id });
        else if (positions.get(id) >= positions.get(b.id))
          issues.push({ kind: "order", block: b.id, prerequisite: id });
      }),
    );
    const total = included.reduce((sum, b) => sum + b.seconds, 0);
    let offset = 0;
    const schedule = included.map((b) => {
      const row = { id: b.id, start: offset, end: offset + b.seconds };
      offset += b.seconds;
      return row;
    });
    return {
      total,
      included,
      issues,
      schedule,
      difference: total - plan.target,
      ready: included.length > 0 && total <= plan.target && !issues.length,
      bySpeaker: plan.speakers.map((s) => ({
        ...s,
        seconds: included
          .filter((b) => b.speaker === s.id)
          .reduce((sum, b) => sum + b.seconds, 0),
      })),
    };
  }
  function moveBlock(plan, id, targetId) {
    const moving = plan.blocks.find((b) => b.id === id),
      target = plan.blocks.find((b) => b.id === targetId);
    if (!moving || !target || id === targetId) return false;
    const from = plan.blocks.indexOf(moving),
      to = plan.blocks.indexOf(target);
    plan.blocks.splice(from, 1);
    moving.speaker = target.speaker;
    plan.blocks.splice(
      plan.blocks.indexOf(target) + (from < to ? 1 : 0),
      0,
      moving,
    );
    return true;
  }
  function initial() {
    const baseline = sample(),
      a = clone(baseline),
      b = clone(baseline);
    a.blocks.find((x) => x.id === "b06").included = false;
    b.blocks.find((x) => x.id === "b03").included = false;
    b.blocks.find((x) => x.id === "b01").seconds = 60;
    return {
      schema: 2,
      plan: baseline,
      activeVersionId: "baseline",
      versions: [
        {
          id: "baseline",
          name: "Original rehearsal",
          description: "All eight blocks before making cuts.",
          example: true,
          plan: clone(baseline),
        },
        {
          id: "example-a",
          name: "Keep the example",
          description: "Set aside Extra detail; keep the worked example.",
          example: true,
          plan: a,
        },
        {
          id: "example-b",
          name: "Keep the extra detail",
          description: "Set aside Example; shorten Intro by 0:30.",
          example: true,
          plan: b,
        },
      ],
    };
  }
  function validBackup(value) {
    if (
      !value ||
      value.schema !== 2 ||
      !validate(value.plan) ||
      !Array.isArray(value.versions) ||
      value.versions.length > 100
    )
      return false;
    const ids = new Set(),
      names = new Set();
    for (const v of value.versions) {
      if (
        !v ||
        typeof v.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(v.id) ||
        ids.has(v.id) ||
        typeof v.name !== "string" ||
        !v.name.trim() ||
        v.name.length > 70 ||
        names.has(v.name.trim().toLowerCase()) ||
        typeof v.description !== "string" ||
        v.description.length > 240 ||
        typeof v.example !== "boolean" ||
        !validate(v.plan)
      )
        return false;
      ids.add(v.id);
      names.add(v.name.trim().toLowerCase());
    }
    if (
      value.activeVersionId != null &&
      (!ids.has(value.activeVersionId) ||
        JSON.stringify(
          value.versions.find((v) => v.id === value.activeVersionId).plan,
        ) !== JSON.stringify(value.plan))
    )
      return false;
    return true;
  }
  function mergeVersions(existing, incoming) {
    const result = clone(existing),
      ids = new Set(result.map((v) => v.id)),
      names = new Set(result.map((v) => v.name.trim().toLowerCase()));
    for (const version of incoming) {
      if (
        result.some(
          (v) =>
            v.id === version.id &&
            v.name === version.name &&
            JSON.stringify(v.plan) === JSON.stringify(version.plan),
        )
      )
        continue;
      const next = clone(version);
      let i = 1;
      while (ids.has(next.id))
        next.id = version.id.slice(0, 80) + "-import-" + i++;
      i = 1;
      while (names.has(next.name.trim().toLowerCase()))
        next.name = version.name.slice(0, 52) + " (imported " + i++ + ")";
      result.push(next);
      ids.add(next.id);
      names.add(next.name.trim().toLowerCase());
    }
    if (result.length > 100)
      throw new Error(
        "This would exceed 100 saved plans. Import a smaller backup.",
      );
    return result;
  }
  function validLibrary(value) {
    if (!value || value.schema !== 3 || !Array.isArray(value.projects) ||
        !value.projects.length || value.projects.length > 100) return false;
    const ids = new Set(), names = new Set();
    for (const p of value.projects) {
      if (!p || typeof p.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(p.id) ||
          ids.has(p.id) || typeof p.name !== "string" || !p.name.trim() ||
          p.name.length > 100 || names.has(p.name.trim().toLowerCase()) ||
          !validBackup(p.data) || p.name !== p.data.plan.title) return false;
      ids.add(p.id); names.add(p.name.trim().toLowerCase());
    }
    return ids.has(value.activeProjectId);
  }
  function libraryFrom(value) {
    if (validLibrary(value)) return clone(value);
    if (!validBackup(value)) return null;
    return {
      schema: 3, activeProjectId: "first-project",
      projects: [{ id: "first-project", name: value.plan.title, data: clone(value) }],
    };
  }
  function addProject(library, id, workspace) {
    const next = clone(library);
    next.projects.push({ id, name: workspace.plan.title, data: clone(workspace) });
    next.activeProjectId = id;
    if (!validLibrary(next)) throw new Error("Use a distinct project name. Up to 100 projects can be kept in this browser.");
    return next;
  }
  function mergeLibraries(existing, incoming) {
    if (!validLibrary(existing) || !validLibrary(incoming)) throw new Error("Use a valid Narrative Map backup.");
    const next = clone(existing);
    const ids = new Set(next.projects.map(p => p.id));
    const names = new Set(next.projects.map(p => p.name.trim().toLowerCase()));
    for (const project of incoming.projects) {
      const alreadyImported = next.projects.some(p => {
        if (p.name === project.name) return JSON.stringify(p.data) === JSON.stringify(project.data);
        // A prior collision only changed the project title and active snapshot marker.
        // Recognize that exact copy so importing the same file remains idempotent.
        const prefix = project.name.slice(0, 75) + " (imported ";
        if (!p.name.startsWith(prefix) || !/^[1-9]\d*\)$/.test(p.name.slice(prefix.length))) return false;
        const renamed = clone(project.data);
        renamed.plan.title = p.name;
        renamed.activeVersionId = null;
        return JSON.stringify(p.data) === JSON.stringify(renamed);
      });
      if (alreadyImported) continue;
      const copy = clone(project);
      let n = 1;
      while (ids.has(copy.id)) copy.id = project.id.slice(0, 75) + "-import-" + n++;
      n = 1;
      while (names.has(copy.name.trim().toLowerCase())) copy.name = project.name.slice(0, 75) + " (imported " + n++ + ")";
      copy.data.plan.title = copy.name;
      if (copy.name !== project.name) copy.data.activeVersionId = null;
      next.projects.push(copy);
      ids.add(copy.id); names.add(copy.name.trim().toLowerCase());
    }
    if (!validLibrary(next)) throw new Error("This import would exceed 100 projects. Nothing was changed.");
    return next;
  }
  function compare(left, right) {
    const ids = [
      ...new Set([
        ...ordered(left).map((b) => b.id),
        ...ordered(right).map((b) => b.id),
      ]),
    ];
    return ids.map((id) => {
      const a = left.blocks.find((b) => b.id === id),
        b = right.blocks.find((b) => b.id === id);
      const speaker = (p, block) =>
        block ? p.speakers.find((s) => s.id === block.speaker)?.name : "";
      const signature = (p, x) =>
        x
          ? JSON.stringify([
              x.title,
              x.included,
              x.seconds,
              speaker(p, x),
              x.requires,
              x.optional,
              x.notes,
              ordered(p).findIndex((t) => t.id === x.id),
            ])
          : "";
      return {
        id,
        left: a,
        right: b,
        changed: signature(left, a) !== signature(right, b),
        leftSpeaker: speaker(left, a),
        rightSpeaker: speaker(right, b),
      };
    });
  }
  return {
    clone,
    colors,
    format,
    parseDuration,
    sample,
    ordered,
    cycle,
    validate,
    analyze,
    moveBlock,
    initial,
    validBackup,
    mergeVersions,
    validLibrary,
    libraryFrom,
    addProject,
    mergeLibraries,
    compare,
  };
});
