import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  timeAgo,
  formatDuration,
  statusIcon,
  statusColor,
  pipelineStatusColor,
} from "./utils.js";

describe("timeAgo", () => {
  it("returns seconds for < 60s", () => {
    const date = new Date(Date.now() - 30_000).toISOString();
    assert.equal(timeAgo(date), "30s ago");
  });

  it("returns minutes for < 60m", () => {
    const date = new Date(Date.now() - 5 * 60_000).toISOString();
    assert.equal(timeAgo(date), "5m ago");
  });

  it("returns hours for < 24h", () => {
    const date = new Date(Date.now() - 3 * 3_600_000).toISOString();
    assert.equal(timeAgo(date), "3h ago");
  });

  it("returns days for >= 24h", () => {
    const date = new Date(Date.now() - 2 * 86_400_000).toISOString();
    assert.equal(timeAgo(date), "2d ago");
  });
});

describe("formatDuration", () => {
  it("returns empty string when startedAt is null", () => {
    assert.equal(formatDuration(null, null), "");
  });

  it("formats seconds only", () => {
    const start = "2024-01-01T00:00:00Z";
    const stop = "2024-01-01T00:00:45Z";
    assert.equal(formatDuration(start, stop), "45s");
  });

  it("formats minutes and seconds", () => {
    const start = "2024-01-01T00:00:00Z";
    const stop = "2024-01-01T00:02:13Z";
    assert.equal(formatDuration(start, stop), "2m 13s");
  });

  it("formats hours and minutes", () => {
    const start = "2024-01-01T00:00:00Z";
    const stop = "2024-01-01T01:30:00Z";
    assert.equal(formatDuration(start, stop), "1h 30m");
  });

  it("handles zero duration", () => {
    const ts = "2024-01-01T00:00:00Z";
    assert.equal(formatDuration(ts, ts), "0s");
  });
});

describe("statusIcon", () => {
  it("returns check for success", () => {
    assert.equal(statusIcon("success"), "✔");
  });

  it("returns cross for failure statuses", () => {
    for (const s of ["failed", "error", "infrastructure_fail", "timedout"] as const) {
      assert.equal(statusIcon(s), "✖", `expected ✖ for ${s}`);
    }
  });

  it("returns running icon for running/failing", () => {
    assert.equal(statusIcon("running"), "◌");
    assert.equal(statusIcon("failing"), "◌");
  });

  it("returns cancel icon for not_run/canceled/unauthorized", () => {
    for (const s of ["not_run", "canceled", "unauthorized"] as const) {
      assert.equal(statusIcon(s), "⊘", `expected ⊘ for ${s}`);
    }
  });

  it("returns hold icon for on_hold/blocked/queued", () => {
    for (const s of ["on_hold", "blocked", "queued"] as const) {
      assert.equal(statusIcon(s), "○", `expected ○ for ${s}`);
    }
  });

  it("returns ? for unknown status", () => {
    assert.equal(statusIcon("something_else" as unknown as Parameters<typeof statusIcon>[0]), "?");
  });
});

describe("statusColor", () => {
  it("returns green for success", () => {
    assert.equal(statusColor("success"), "green");
  });

  it("returns red for failure statuses", () => {
    for (const s of ["failed", "error", "infrastructure_fail", "timedout"] as const) {
      assert.equal(statusColor(s), "red", `expected red for ${s}`);
    }
  });

  it("returns yellow for running/failing", () => {
    assert.equal(statusColor("running"), "yellow");
    assert.equal(statusColor("failing"), "yellow");
  });

  it("returns gray for inactive statuses", () => {
    for (const s of ["not_run", "canceled", "on_hold", "blocked", "queued", "unauthorized"] as const) {
      assert.equal(statusColor(s), "gray", `expected gray for ${s}`);
    }
  });

  it("returns white for unknown", () => {
    assert.equal(statusColor("unknown" as unknown as Parameters<typeof statusColor>[0]), "white");
  });
});

describe("pipelineStatusColor", () => {
  it("returns yellow for created/setup", () => {
    assert.equal(pipelineStatusColor("created"), "yellow");
    assert.equal(pipelineStatusColor("setup"), "yellow");
  });

  it("returns red for errored", () => {
    assert.equal(pipelineStatusColor("errored"), "red");
  });

  it("returns white for other states", () => {
    assert.equal(pipelineStatusColor("completed"), "white");
    assert.equal(pipelineStatusColor(""), "white");
  });
});
