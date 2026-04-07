export interface Pipeline {
  id: string;
  number: number;
  state: string;
  created_at: string;
  trigger: {
    type: string;
    received_at: string;
    actor: {
      login: string;
      avatar_url: string;
    };
  };
  vcs: {
    branch?: string;
    tag?: string;
    revision: string;
    origin_repository_url: string;
  };
}

export interface PipelineListResponse {
  items: Pipeline[];
  next_page_token: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  status: WorkflowStatus;
  created_at: string;
  stopped_at: string | null;
  pipeline_id: string;
  pipeline_number: number;
}

export type WorkflowStatus =
  | "success"
  | "failed"
  | "error"
  | "canceled"
  | "running"
  | "on_hold"
  | "not_run"
  | "failing"
  | "unauthorized";

export interface WorkflowListResponse {
  items: Workflow[];
  next_page_token: string | null;
}

export interface Job {
  id: string;
  name: string;
  type: string;
  status: JobStatus;
  job_number?: number;
  started_at: string | null;
  stopped_at: string | null;
  dependencies: string[];
}

export type JobStatus =
  | "success"
  | "failed"
  | "canceled"
  | "running"
  | "not_run"
  | "infrastructure_fail"
  | "timedout"
  | "on_hold"
  | "blocked"
  | "queued"
  | "retried"
  | "unauthorized";

export interface JobListResponse {
  items: Job[];
  next_page_token: string | null;
}

export interface JobDetail {
  web_url: string;
  name: string;
  steps: JobStep[];
}

export interface Artifact {
  path: string;
  url: string;
  node_index: number;
}

export interface ArtifactListResponse {
  items: Artifact[];
  next_page_token: string | null;
}

export interface TestResult {
  message: string;
  source: string;
  run_time: number;
  file: string;
  result: string;
  name: string;
  classname: string;
}

export interface TestListResponse {
  items: TestResult[];
  next_page_token: string | null;
}

export interface JobStep {
  name: string;
  actions: StepAction[];
}

export interface StepAction {
  name: string;
  status: string;
  index: number;
  step: number;
  output_url?: string;
  end_time: string | null;
  start_time: string | null;
  run_time_millis: number | null;
  has_output: boolean;
  truncated: boolean;
  // v1.1 returns output inline
  output?: Array<{ type: string; message: string }>;
  // v1.1 failure flag
  failed?: boolean;
}

export interface FollowedProject {
  vcs_type: string;
  username: string;
  reponame: string;
  default_branch: string;
  vcs_url: string;
}

export type AppView =
  | { type: "tokenInput" }
  | { type: "projectPicker" }
  | { type: "dashboard" }
  | { type: "branchPicker" }
  | { type: "logs"; jobNumber: number; jobName: string };

export type DashboardPanel = "pipelines" | "detail";
