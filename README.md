# Narrative Map

Plan a group presentation, shorten it to fit the time limit, and keep the ideas that later sections depend on.

[Live app](https://narrative-map-presentation-studio.lfcsteven-m.chatgpt.site/) · [Try the demo](https://narrative-map-presentation-studio.lfcsteven-m.chatgpt.site/mentor/demo.html?fresh=1)

## What it does

- Organize content by speaker in card and timeline views.
- Edit durations and see the total and each speaker’s allocation update.
- Mark prerequisites and identify missing setup or incorrect order.
- Set content aside and restore it without deleting it.
- Save separate projects and compare independent plan versions.
- Time rehearsals and selectively apply measured durations.
- Export and import project backups.

## Run locally

No build step or package installation is required. From the repository root:

```sh
python3 -m http.server 8000 --directory dist
```

Open [localhost:8000](http://localhost:8000). The [review page](http://localhost:8000/mentor/) includes the technical requirements, Hello world, and the style specimen.

## Tests

With Node.js installed:

```sh
node tests/model.test.js
node tests/projects.test.js
```

## Scope

Built with HTML, CSS, JavaScript, and SVG. Projects are saved in the current browser; they do not sync between users or devices. Export a backup to transfer work. The demo uses a separate, resettable workspace. Prerequisites are entered by people; the app does not analyze speech or infer dependencies.

## Team

Advith Akula · Eric Bi · Chuyue Wang  
CIS 4120/5120, University of Pennsylvania
