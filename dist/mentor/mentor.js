/* Mentor review interface. Implementation assistance: OpenAI ChatGPT. */
(() => {
  "use strict";
  const content = window.MentorRequirements;
  const list = document.getElementById("requirements-list");
  if (content && list) {
    document.getElementById("technical-scope").textContent = content.scope;
    for (const r of content.requirements) {
      const detail = document.createElement("details");
      detail.className = "requirement";
      detail.id = r.id;
      const summary = document.createElement("summary");
      const number = document.createElement("span");
      number.className = "req-number";
      number.textContent = r.id;
      const title = document.createElement("span");
      title.textContent = r.name;
      summary.append(number, title);
      const body = document.createElement("div");
      body.className = "requirement-body";
      for (const [name, value] of [
        ["Feature", r.feature],
        ["What we must observe", r.observe],
        ["Implementation", r.implementation],
      ]) {
        const heading = document.createElement("h3");
        heading.textContent = name;
        const p = document.createElement("p");
        p.textContent = value;
        body.append(heading, p);
      }
      const a = document.createElement("a");
      a.href = r.link;
      a.className = "btn";
      a.textContent = r.linkLabel;
      body.append(a);
      detail.append(summary, body);
      list.append(detail);
    }
  }
  const form = document.getElementById("meeting-record");
  if (!form) return;
  const key = "narrative-map-mentor-notes-v1";
  const status = document.getElementById("notes-status");
  function read() {
    return Object.fromEntries(new FormData(form));
  }
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved && typeof saved === "object") {
      for (const name of ["meeting", "feedback", "decision"])
        if (typeof saved[name] === "string")
          form.elements[name].value = saved[name];
      status.textContent = "Your notes were restored from this browser.";
    }
  } catch {
    status.textContent =
      "Browser saving is unavailable. Download your notes before leaving.";
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", () => {
    try {
      localStorage.setItem(key, JSON.stringify(read()));
      status.textContent = "Notes saved in this browser.";
    } catch {
      status.textContent =
        "Could not save in this browser. Download your notes before leaving.";
    }
  });
  document.getElementById("download-notes").addEventListener("click", () => {
    const n = read();
    const text =
      "Narrative Map | Team meeting record\n\nMeeting time and attendees\n" +
      (n.meeting || "Not recorded") +
      "\n\nCritique feedback and intended changes\n" +
      (n.feedback || "Not recorded") +
      "\n\nMentor decision and remaining work\n" +
      (n.decision || "Not recorded") +
      "\n";
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Narrative_Map_Meeting_Notes.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "Notes downloaded. No message was sent.";
  });
})();
