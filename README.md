# circleci-tui

An interactive terminal UI dashboard for monitoring CircleCI pipelines, built with Node.js, TypeScript, and [Ink](https://github.com/vadimdemedes/ink). Inspired by [btop](https://github.com/aristocratos/btop).

![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)

## Features

- **Split-pane dashboard** — pipelines and workflow/job details side by side
- **Interactive project picker** — browse followed CircleCI projects, type to filter
- **Branch picker** — switch branch filter on the fly
- **Real-time polling** — auto-refresh with configurable interval, spinner for running jobs
- **Pipeline pagination** — scroll past the initial page to load more pipelines automatically
- **Job log viewer** — scrollable step-by-step output with search and line wrap
- **Keyboard-driven** — full navigation without a mouse

## Quick start

```bash
npx circleci-tui
```

That's it. No install needed — just Node.js 22+. On first run, you'll be prompted to enter your [CircleCI API token](https://app.circleci.com/settings/user/tokens) directly in the TUI. The token is saved to `~/.config/circleci-tui/token` so you only need to do this once.

You can also set the token via environment variable if you prefer:

```bash
export CIRCLECI_TOKEN=your_token_here
```

## Install

### npx (no install)

```bash
npx circleci-tui
```

### Global install

```bash
npm install -g circleci-tui
cci
```

After installing globally, both `cci` and `circleci-tui` commands are available.

### From source

```bash
git clone https://github.com/your-org/circleci-tui.git
cd circleci-tui
npm install
npm run dev
```

## Usage

```bash
# Interactive — pick a project from your followed list
cci

# Direct — skip the picker
cci --project gh/myorg/myrepo

# Filter by branch
cci --project gh/myorg/myrepo --branch main

# Custom polling interval
cci --project gh/myorg/myrepo --interval 10
```

### CLI options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project` | `-p` | CircleCI project slug | interactive picker |
| `--branch` | `-b` | Filter pipelines by branch | all branches |
| `--interval` | `-i` | Polling interval in seconds | `5` |

## Keyboard shortcuts

### Dashboard

| Key | Action |
|-----|--------|
| `Tab` / `←` `→` | Switch between pipeline and detail panels |
| `↑` / `↓` | Navigate within active panel |
| `PgUp` / `PgDn` | Scroll by page |
| `Enter` | Select pipeline / view job logs |
| `Esc` | Focus back to pipeline panel |
| `b` | Open branch picker |
| `p` | Open project picker |
| `t` | Change API token |
| `r` | Force refresh |
| `q` | Quit |

### Project picker

| Key | Action |
|-----|--------|
| Type | Filter list |
| `↑` / `↓` | Navigate |
| `Enter` | Select |
| `d` | Remove from favorites |
| `t` | Change API token |
| `q` | Quit |

### Branch picker

| Key | Action |
|-----|--------|
| Type | Filter list |
| `↑` / `↓` | Navigate |
| `Enter` | Select |
| `Esc` | Cancel / clear filter |

### Log viewer

| Key | Action |
|-----|--------|
| `↑` / `↓` | Scroll line by line |
| `PgUp` / `PgDn` | Scroll by page |
| `/` | Search |
| `n` / `N` | Next / previous match |
| `w` | Toggle line wrap |
| `Esc` | Back to dashboard |
| `q` | Quit |

## Views

### Project picker

Browse all your followed CircleCI projects. Type to filter the list. You can also type a project slug directly (e.g., `gh/org/repo`) and press Enter.

### Dashboard (split-pane)

```
╭─ circleci-tui ── gh/org/repo ── main ── ✔12 ✖2 ◌1 ── ↻ 3s ago (5s) ──╮
├─ Pipelines (20+) ─────────────┬─ build-and-test ✔ ──────────────────────┤
│ ▸ #1234 main       2m ago     │  ✔ checkout                        3s  │
│   #1233 main       15m ago    │  ✔ install-deps                   45s  │
│   #1232 feat/x     20m ago    │  ✖ test                         2m 13s │
│   #1231 main       1h ago     │  ⊘ deploy                              │
╰───────────────────────────────┴─────────────────────────────────────────╯
 Tab panel · ←→ switch · ↑↓ navigate · PgUp/PgDn page · Enter select · b branch · ...

```

Left panel shows pipelines, right panel shows workflows and jobs for the selected pipeline. Active panel is highlighted with a cyan border.

### Status icons

| Icon | Meaning |
|------|---------|
| ✔ | Success |
| ✖ | Failed / error |
| ◌ | Running |
| ○ | On hold / queued |
| ⊘ | Not run / canceled |

Colors: green = success, red = failed, yellow = running, dim = skipped/not run.

### Branch picker

Press `b` to open. Lists all branches found in recent pipelines. Select "All branches" to clear the filter.

### Job logs

Full-screen scrollable output of all steps in a job, fetched from the CircleCI API.

## CI/CD

The project uses CircleCI for builds and npm publishing.

- **Every push**: type-check + build
- **Tag push** (`v*`): build + publish to npm

To release a new version:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

CircleCI will automatically publish to npm. Requires an `NPM_TOKEN` environment variable set in the CircleCI project settings.

## Project structure

```
circleci-tui/
├── .circleci/
│   └── config.yml             # CI/CD pipeline
├── package.json
├── tsconfig.json
├── bin/
│   └── cci.ts                 # Shebang entry point
└── src/
    ├── index.tsx               # CLI entry, arg parsing
    ├── App.tsx                 # View state machine
    ├── api.ts                  # CircleCI API client (v2 + v1.1)
    ├── types.ts                # TypeScript types
    ├── utils.ts                # Shared helpers (timeAgo, statusIcon, etc.)
    ├── hooks/
    │   ├── usePolling.ts       # Generic polling hook
    │   └── useSpinner.ts       # Braille spinner animation
    └── components/
        ├── Header.tsx          # Top bar with project/branch/stats
        ├── StatusBar.tsx       # Bottom bar with keybindings
        ├── ProjectPicker.tsx   # Interactive project selection
        ├── BranchPicker.tsx    # Branch filter selection
        ├── Dashboard.tsx       # Split-pane dashboard (core)
        └── LogViewer.tsx       # Job log viewer
```

## CircleCI API endpoints used

| Endpoint | Purpose |
|----------|---------|
| `GET /projects` (v1.1) | List followed projects |
| `GET /project/{slug}/pipeline` | List pipelines |
| `GET /project/{slug}/pipeline?branch={branch}` | Filter by branch |
| `GET /pipeline/{id}/workflow` | Workflows in a pipeline |
| `GET /workflow/{id}/job` | Jobs in a workflow |
| `GET /project/{slug}/{job-number}` | Job detail with steps |

## License

MIT
