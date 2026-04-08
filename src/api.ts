import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  PipelineListResponse,
  WorkflowListResponse,
  JobListResponse,
  JobDetail,
  FollowedProject,
  ArtifactListResponse,
  TestListResponse,
} from "./types.js";

const BASE_URL = "https://circleci.com/api/v2";
const BASE_URL_V1 = "https://circleci.com/api/v1.1";

const CONFIG_DIR = join(homedir(), ".config", "circleci-tui");
const TOKEN_FILE = join(CONFIG_DIR, "token");
const RECENT_FILE = join(CONFIG_DIR, "recent-projects.json");
const MAX_RECENT = 10;

let _token: string | null = null;

function readTokenFile(): string | null {
  try {
    const content = readFileSync(TOKEN_FILE, "utf-8").trim();
    return content || null;
  } catch {
    return null;
  }
}

export function hasToken(): boolean {
  return !!(_token || process.env.CIRCLECI_TOKEN || readTokenFile());
}

export function setToken(token: string): void {
  _token = token;
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  } catch {
    // If we can't persist, the in-memory token still works for this session
  }
}

export function clearConfig(): void {
  _token = null;
  try {
    unlinkSync(TOKEN_FILE);
  } catch {
    // File may not exist
  }
  try {
    unlinkSync(RECENT_FILE);
  } catch {
    // File may not exist
  }
}

export function getRecentProjects(): string[] {
  try {
    const content = readFileSync(RECENT_FILE, "utf-8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSlug(slug: string): string {
  const parts = slug.split("/");
  if (parts[0] === "github") return `gh/${parts[1]}/${parts[2]}`;
  if (parts[0] === "bitbucket") return `bb/${parts[1]}/${parts[2]}`;
  return slug;
}

export function addRecentProject(slug: string): void {
  try {
    const normalized = normalizeSlug(slug);
    const recent = getRecentProjects()
      .map(normalizeSlug)
      .filter((s) => s !== normalized);
    recent.unshift(normalized);
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(
      RECENT_FILE,
      JSON.stringify(recent.slice(0, MAX_RECENT), null, 2)
    );
  } catch {
    // Non-critical
  }
}

export function removeRecentProject(slug: string): void {
  try {
    const normalized = normalizeSlug(slug);
    const recent = getRecentProjects()
      .map(normalizeSlug)
      .filter((s) => s !== normalized);
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(RECENT_FILE, JSON.stringify(recent, null, 2));
  } catch {
    // Non-critical
  }
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: {
        "Circle-Token": token,
        "Content-Type": "application/json",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function getToken(): string {
  const token = _token || process.env.CIRCLECI_TOKEN || readTokenFile();
  if (!token) {
    throw new Error("No CircleCI token available");
  }
  return token;
}

async function request<T>(path: string, baseUrl = BASE_URL): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Circle-Token": getToken(),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CircleCI API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchFollowedProjects(): Promise<FollowedProject[]> {
  return request<FollowedProject[]>("/projects", BASE_URL_V1);
}

export function projectSlug(p: FollowedProject): string {
  const prefix = p.vcs_type === "github" ? "gh" : "bb";
  return `${prefix}/${p.username}/${p.reponame}`;
}

export async function fetchPipelines(
  projectSlug: string,
  branch?: string | null,
  pageToken?: string | null
): Promise<PipelineListResponse> {
  const params = new URLSearchParams();
  if (branch) params.set("branch", branch);
  if (pageToken) params.set("page-token", pageToken);
  const qs = params.toString();
  return request<PipelineListResponse>(
    `/project/${projectSlug}/pipeline${qs ? `?${qs}` : ""}`
  );
}

export async function fetchWorkflows(
  pipelineId: string
): Promise<WorkflowListResponse> {
  return request<WorkflowListResponse>(`/pipeline/${pipelineId}/workflow`);
}

export async function fetchJobs(
  workflowId: string
): Promise<JobListResponse> {
  const first = await request<JobListResponse>(`/workflow/${workflowId}/job`);
  const items = [...first.items];
  let pageToken = first.next_page_token;
  while (pageToken) {
    const resp = await request<JobListResponse>(
      `/workflow/${workflowId}/job?page-token=${encodeURIComponent(pageToken)}`
    );
    items.push(...resp.items);
    pageToken = resp.next_page_token;
  }
  return { items, next_page_token: null };
}

export async function fetchJobDetail(
  projectSlug: string,
  jobNumber: number
): Promise<JobDetail> {
  return request<JobDetail>(`/project/${projectSlug}/job/${jobNumber}`);
}

function toV1Slug(slug: string): string {
  const parts = slug.split("/");
  const prefix = parts[0];
  // Already in v1.1 format (github/bitbucket)
  if (prefix === "github" || prefix === "bitbucket") {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  // Convert gh/bb shorthand
  const vcsType = prefix === "gh" ? "github" : "bitbucket";
  return `${vcsType}/${parts[1]}/${parts[2]}`;
}

// v1.1 fallback — returns richer step/output data
export async function fetchJobDetailV1(
  projectSlug: string,
  jobNumber: number
): Promise<JobDetail> {
  const v1Slug = toV1Slug(projectSlug);
  return request<JobDetail>(`/project/${v1Slug}/${jobNumber}`, BASE_URL_V1);
}

export async function fetchJobArtifacts(
  projectSlug: string,
  jobNumber: number
): Promise<ArtifactListResponse> {
  return request<ArtifactListResponse>(
    `/project/${projectSlug}/${jobNumber}/artifacts`
  );
}

export async function fetchJobTests(
  projectSlug: string,
  jobNumber: number
): Promise<TestListResponse> {
  return request<TestListResponse>(
    `/project/${projectSlug}/job/${jobNumber}/tests`
  );
}

export async function fetchStepOutput(
  projectSlug: string,
  jobNumber: number,
  stepIndex: number,
  actionIndex: number
): Promise<string> {
  const v1Slug = toV1Slug(projectSlug);
  const url = `${BASE_URL_V1}/project/${v1Slug}/${jobNumber}/output/${stepIndex}/${actionIndex}`;
  return fetchLogOutput(url);
}

export async function fetchLogOutput(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "Circle-Token": getToken(),
    },
  });

  if (!res.ok) {
    return "";
  }

  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      return data.map((entry: { message: string }) => entry.message).join("");
    }
    return String(data);
  } catch {
    return text;
  }
}
