import type { WorkflowStatus, JobStatus } from "./types.js";

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDuration(
  startedAt: string | null,
  stoppedAt: string | null
): string {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  const end = stoppedAt ? new Date(stoppedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function statusIcon(status: WorkflowStatus | JobStatus): string {
  switch (status) {
    case "success":
      return "✔";
    case "failed":
    case "error":
    case "infrastructure_fail":
    case "timedout":
      return "✖";
    case "running":
    case "failing":
      return "◌";
    case "not_run":
    case "canceled":
    case "unauthorized":
      return "⊘";
    case "on_hold":
    case "blocked":
    case "queued":
      return "○";
    default:
      return "?";
  }
}

export function statusColor(status: WorkflowStatus | JobStatus): string {
  switch (status) {
    case "success":
      return "green";
    case "failed":
    case "error":
    case "infrastructure_fail":
    case "timedout":
      return "red";
    case "running":
    case "failing":
      return "yellow";
    case "not_run":
    case "canceled":
    case "on_hold":
    case "blocked":
    case "queued":
    case "unauthorized":
      return "gray";
    default:
      return "white";
  }
}

export function pipelineStatusColor(state: string): string {
  switch (state) {
    case "created":
    case "setup":
      return "yellow";
    case "errored":
      return "red";
    default:
      return "white";
  }
}
