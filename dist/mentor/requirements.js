/* Generated from requirements.json. */
window.MentorRequirements = {
  "title": "Narrative Map",
  "subtitle": "Technical requirements for mentor review",
  "scope": "A browser tool for students planning and rehearsing a timed group presentation together. The primary target is a laptop browser; tablet-width layouts and explicit move controls are also supported. The proposed implementation uses JavaScript, native HTML/DOM, CSS, inline SVG, and browser storage. No UI framework, runtime AI, microphone, or external API is required.",
  "boundary": "The current scope is one browser workspace with portable backups, not simultaneous editing across devices. Prerequisites are marked by people. Ready means the plan is nonempty, fits the limit, and every marked prerequisite is included and comes first; it does not certify the quality or actual delivery time of the talk.",
  "requirements": [
    {
      "id": "R1",
      "name": "Hello world",
      "feature": "Run the chosen implementation stack on the intended device.",
      "observe": "Open the minimal page on the presentation laptop. It must display Hello world. Activating the button must change its count immediately, demonstrating JavaScript and native DOM interaction. Reload and repeat without an error.",
      "implementation": "A standalone HTML page using the same CSS and JavaScript approach as the product.",
      "link": "hello.html",
      "linkLabel": "Open Hello world"
    },
    {
      "id": "R2",
      "name": "Hello styles",
      "feature": "Render every chosen font style, color, and icon consistently.",
      "observe": "Open the style specimen. Verify the font stack and all used weights, semantic colors, all six speaker palettes, every production icon, and the product mark. Exercise buttons, a checkbox, a select, validation, and keyboard focus; their styles must match the product.",
      "implementation": "Loads the production stylesheet and shared SVG icon set. The supplementary color inventory is generated from the production CSS.",
      "link": "styles.html",
      "linkLabel": "Open Hello styles"
    },
    {
      "id": "R3",
      "name": "Editing and timing calculations",
      "feature": "Keep the plan, included content, total duration, and speaker allocations in sync.",
      "observe": "Start at 12:00 with Alex 4:00, Priya 5:00, and Leo 3:00. Set aside Extra detail to get 10:00. Independently, set aside Example and change Intro from 1:30 to 1:00 to get 10:00. Add, edit, restore, and move content; all views must agree. Reject 0:00 and 1:60 without changing the plan.",
      "implementation": "One validated data model; totals are derived from included blocks after each edit.",
      "link": "demo.html?fresh=1",
      "linkLabel": "Open a fresh demo"
    },
    {
      "id": "R4",
      "name": "Prerequisites and timeline rendering",
      "feature": "Expose missing setup and incorrect order in both card and proportional timeline views.",
      "observe": "Set aside Definition metric: show 11:00 and a warning that Interpretation needs it. Restore the definition: remove that warning. Place a prerequisite after its dependent: identify the order problem. Reject circular links. Empty, over-limit, or dependency-invalid plans must never be Ready. Timeline bars must reflect time and links must remain selectable through their labels.",
      "implementation": "Directed prerequisite validation and native SVG/HTML timeline rendering; users mark the links.",
      "link": "demo.html",
      "linkLabel": "Inspect the timeline"
    },
    {
      "id": "R5",
      "name": "Projects, versions, and recovery",
      "feature": "Keep presentations separate, save current work, and preserve independent alternatives.",
      "observe": "Create and switch between two projects; each retains its draft and versions. Save must persist without adding a version. Save at least three versions; duplicate without replacement; delete and Undo. Editing a draft must leave snapshots unchanged. Compare the two 10:00 examples: only Intro, Example, and Extra detail differ. Reload, export/import a backup without overwriting work, and reject malformed input.",
      "implementation": "A validated project library with independent snapshots, localStorage, legacy-data migration, JSON backup merging, and session Undo/Redo. The demo uses separate sessionStorage.",
      "link": "../index.html",
      "linkLabel": "Open the main workspace"
    },
    {
      "id": "R6",
      "name": "Rehearsal timing",
      "feature": "Measure actual elapsed time and let users choose what to apply.",
      "observe": "Start, pause, wait, and resume; paused time must not accumulate. Advance to another block, then finish early. Review the measured blocks, deselect one, and apply the other. Only selected measurements may change the plan; untimed blocks keep their durations. Undo must restore the prior plan. No microphone permission is requested.",
      "implementation": "An elapsed-time clock with explicit block handoffs and a results review step.",
      "link": "demo.html",
      "linkLabel": "Try a rehearsal"
    },
    {
      "id": "R7",
      "name": "Usable input and responsive delivery",
      "feature": "Keep essential actions reachable across supported browser layouts and input methods.",
      "observe": "Use explicit move controls and keyboard-operated forms to complete the scenario. Exercise desktop drag with a pointer. At widths from 320 to 1440 px, verify that titles, actions, dialogs, comparisons, and results do not overlap or disappear. Timeline scrolling is intentional and labeled. Try invalid input and an empty plan; feedback must be clear and state must stay valid.",
      "implementation": "Responsive CSS, native controls/dialogs, SVG, HTML drag-and-drop, and explicit move alternatives.",
      "link": "demo.html",
      "linkLabel": "Explore freely"
    }
  ]
};
