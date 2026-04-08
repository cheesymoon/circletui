import React from "react";
import { render } from "ink";
import meow from "meow";
import { App } from "./App.js";
import { clearConfig } from "./api.js";

const cli = meow(
  `
  Usage
    $ cci [--project gh/org/repo]

  Options
    --project, -p   CircleCI project slug (e.g., gh/myorg/myrepo)
                    If omitted, shows an interactive project picker.
    --branch, -b    Filter pipelines by branch
    --interval, -i  Polling interval in seconds (default: 5)
    --clean         Clear saved token and projects, start fresh

  Examples
    $ cci
    $ cci --project gh/acme/api
    $ cci --project gh/acme/api --branch main
    $ cci --project gh/acme/api --interval 10
`,
  {
    importMeta: import.meta,
    flags: {
      project: {
        type: "string",
        shortFlag: "p",
      },
      branch: {
        type: "string",
        shortFlag: "b",
      },
      interval: {
        type: "number",
        shortFlag: "i",
        default: 5,
      },
      clean: {
        type: "boolean",
        default: false,
      },
    },
  }
);

if (cli.flags.clean) {
  clearConfig();
  console.log("Saved token and projects cleared. Run again to start fresh.");
  process.exit(0);
}

// Enter alternate screen buffer (fullscreen, like vim/htop)
process.stdout.write("\x1b[?1049h");
process.stdout.write("\x1b[H");

function exitFullscreen() {
  process.stdout.write("\x1b[?1049l");
}

const { waitUntilExit } = render(
  <App
    initialProject={cli.flags.project}
    branch={cli.flags.branch}
    interval={cli.flags.interval}
    exit={() => {
      exitFullscreen();
      process.exit(0);
    }}
  />,
  { exitOnCtrlC: false }
);

// Restore screen on Ctrl+C
process.on("SIGINT", () => {
  exitFullscreen();
  process.exit(0);
});

// Swallow render errors from terminal resize — Ink may throw when
// stdout dimensions shrink below what the layout requires. The app
// recovers on the next render once the terminal is large enough.
process.on("uncaughtException", (err) => {
  if (
    err instanceof RangeError ||
    (err.message && /out of range|Invalid array length|Invalid count value/i.test(err.message))
  ) {
    // Ignore — React/Ink will re-render when the terminal resizes back
    return;
  }
  exitFullscreen();
  console.error(err);
  process.exit(1);
});

// Restore screen on exit
process.on("exit", exitFullscreen);

waitUntilExit().then(() => {
  exitFullscreen();
  process.exit(0);
});
