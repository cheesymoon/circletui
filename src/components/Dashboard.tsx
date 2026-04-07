import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { useSpinner } from "../hooks/useSpinner.js";
import { fetchPipelines, fetchWorkflows, fetchJobs } from "../api.js";
import {
  timeAgo,
  statusIcon,
  statusColor,
  pipelineStatusColor,
  formatDuration,
} from "../utils.js";
import { Header } from "./Header.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import type {
  Pipeline,
  Workflow,
  Job,
  JobStatus,
  DashboardPanel,
} from "../types.js";

const NON_ACTIONABLE_STATUSES: Set<JobStatus> = new Set([
  "not_run",
  "blocked",
  "queued",
  "on_hold",
  "unauthorized",
]);

function isJobActionable(status: JobStatus): boolean {
  return !NON_ACTIONABLE_STATUSES.has(status);
}

interface DashboardProps {
  project: string;
  branch: string | null;
  interval: number;
  isActive: boolean;
  onOpenProjectPicker: () => void;
  onOpenBranchPicker: (branches: string[]) => void;
  onOpenLogs: (jobNumber: number, jobName: string) => void;
  onChangeToken: () => void;
  onQuit: () => void;
}

interface WorkflowWithJobs {
  workflow: Workflow;
  jobs: Job[];
}

type DetailItem =
  | { kind: "workflow"; workflow: Workflow }
  | { kind: "job"; job: Job };

export function Dashboard({
  project,
  branch,
  interval,
  isActive,
  onOpenProjectPicker,
  onOpenBranchPicker,
  onOpenLogs,
  onChangeToken,
  onQuit,
}: DashboardProps) {
  const [activePanel, setActivePanel] = useState<DashboardPanel>("pipelines");
  const [pipelineCursor, setPipelineCursor] = useState(0);
  const [detailCursor, setDetailCursor] = useState(0);
  const [pipelineScroll, setPipelineScroll] = useState(0);
  const [detailScroll, setDetailScroll] = useState(0);
  const [workflowData, setWorkflowData] = useState<WorkflowWithJobs[]>([]);
  const [wfLoading, setWfLoading] = useState(false);

  // Pipeline data with pagination
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastFirstPageJson = useRef("");
  const hasExtraPages = useRef(false);

  // Fetch first page (+ poll)
  const fetchFirstPage = useCallback(async () => {
    try {
      const resp = await fetchPipelines(project, branch);
      const json = JSON.stringify(resp.items);
      if (json !== lastFirstPageJson.current) {
        lastFirstPageJson.current = json;
        // First page changed (new pipelines) — reset pagination so user
        // can scroll to load fresh subsequent pages
        hasExtraPages.current = false;
        // Merge: replace first-page items, keep any extra pages appended
        setPipelines((prev) => {
          const firstPageIds = new Set(resp.items.map((p) => p.id));
          const extra = prev.filter((p) => !firstPageIds.has(p.id));
          return [...resp.items, ...extra];
        });
        setNextPageToken(resp.next_page_token);
        setLastUpdated(new Date());
      } else if (!hasExtraPages.current) {
        // No change and no extra pages — keep token in sync
        setNextPageToken(resp.next_page_token);
      }
      setPipelineError((prev) => (prev === null ? prev : null));
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : String(err));
    } finally {
      setPipelineLoading(false);
    }
  }, [project, branch]);

  // Reset pipeline data when project/branch changes (fetchFirstPage identity changes)
  const prevFetcher = useRef(fetchFirstPage);
  if (fetchFirstPage !== prevFetcher.current) {
    prevFetcher.current = fetchFirstPage;
    lastFirstPageJson.current = "";
    hasExtraPages.current = false;
    setPipelines([]);
    setPipelineLoading(true);
    setNextPageToken(null);
  }

  useEffect(() => {
    if (!isActive) return;
    fetchFirstPage();
    const timer = setInterval(fetchFirstPage, interval * 1000);
    return () => clearInterval(timer);
  }, [fetchFirstPage, interval, isActive]);

  const refreshPipelines = fetchFirstPage;

  // Load next page
  const loadMorePipelines = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const resp = await fetchPipelines(project, branch, nextPageToken);
      setPipelines((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = resp.items.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
      hasExtraPages.current = true;
      setNextPageToken(resp.next_page_token);
    } catch {
      // silently ignore — user can retry by scrolling down again
    } finally {
      setLoadingMore(false);
    }
  }, [project, branch, nextPageToken, loadingMore]);

  // Reset cursor when branch changes
  useEffect(() => {
    setPipelineCursor(0);
    setPipelineScroll(0);
  }, [branch]);

  // Extract branches from pipeline data
  const branches = useMemo(() => {
    const set = new Set<string>();
    for (const p of pipelines) {
      if (p.vcs?.branch) set.add(p.vcs.branch);
    }
    return [...set].sort();
  }, [pipelines]);


  // Selected pipeline
  const selectedPipeline = pipelines[pipelineCursor] as Pipeline | undefined;

  // Track which pipeline the workflow data belongs to
  const wfPipelineId = useRef<string | undefined>(undefined);

  // Reset detail panel state immediately during render when pipeline changes
  if (selectedPipeline?.id !== wfPipelineId.current) {
    wfPipelineId.current = selectedPipeline?.id;
    if (workflowData.length > 0) setWorkflowData([]);
    if (detailCursor !== 0) setDetailCursor(0);
    if (detailScroll !== 0) setDetailScroll(0);
  }

  // Fetch workflows for selected pipeline
  useEffect(() => {
    if (!selectedPipeline?.id || !isActive) {
      return;
    }

    const id = selectedPipeline.id;
    let cancelled = false;
    let initialDone = false;
    let lastJson = "";

    async function load() {
      if (!initialDone) setWfLoading(true);
      try {
        const wfResp = await fetchWorkflows(id);
        const results = await Promise.all(
          wfResp.items.map(async (wf) => {
            const jobResp = await fetchJobs(wf.id);
            return { workflow: wf, jobs: jobResp.items };
          })
        );
        if (!cancelled) {
          const json = JSON.stringify(results, (key, value) =>
            key === "next_page_token" ? undefined : value
          );
          if (json !== lastJson) {
            lastJson = json;
            setWorkflowData(results);
          }
        }
      } catch {
        // Silently handle — detail panel shows empty
      } finally {
        if (!cancelled && !initialDone) {
          initialDone = true;
          setWfLoading(false);
        }
      }
    }

    load();
    const timer = setInterval(load, interval * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedPipeline?.id, interval, isActive]);

  // Flatten workflow + job items for detail panel
  const detailItems: DetailItem[] = useMemo(() => {
    const items: DetailItem[] = [];
    for (const wj of workflowData) {
      items.push({ kind: "workflow", workflow: wj.workflow });
      for (const job of wj.jobs) {
        items.push({ kind: "job", job });
      }
    }
    return items;
  }, [workflowData]);

  const { columns, rows } = useTerminalSize();
  const compact = columns < 100;
  const panelHeight = Math.max(1, rows - 7);

  function adjustScroll(
    cursor: number,
    scroll: number,
    setScroll: (s: number) => void
  ) {
    if (cursor < scroll) setScroll(cursor);
    else if (cursor >= scroll + panelHeight) setScroll(cursor - panelHeight + 1);
  }

  // Spinner for running items
  const hasRunning = workflowData.some(
    (wj) =>
      wj.workflow.status === "running" ||
      wj.jobs.some((j) => j.status === "running")
  );
  const spinner = useSpinner(hasRunning);

  // Input handling — single handler for both panels
  useInput(
    (input, key) => {
      // Global keys
      if (input === "q") {
        onQuit();
        return;
      }
      if (input === "b") {
        onOpenBranchPicker(branches);
        return;
      }
      if (input === "p") {
        onOpenProjectPicker();
        return;
      }
      if (input === "t") {
        onChangeToken();
        return;
      }
      if (input === "r") {
        refreshPipelines();
        return;
      }
      if (key.tab) {
        setActivePanel((p) => (p === "pipelines" ? "detail" : "pipelines"));
        return;
      }

      // Panel switching with arrow keys
      if (key.leftArrow && activePanel === "detail") {
        setActivePanel("pipelines");
        return;
      }
      if (key.rightArrow && activePanel === "pipelines") {
        setActivePanel("detail");
        return;
      }

      // Panel-specific keys
      if (activePanel === "pipelines") {
        if (key.upArrow) {
          const next = Math.max(0, pipelineCursor - 1);
          setPipelineCursor(next);
          adjustScroll(next, pipelineScroll, setPipelineScroll);
        }
        if (key.downArrow) {
          const next = Math.min(pipelines.length - 1, pipelineCursor + 1);
          setPipelineCursor(next);
          adjustScroll(next, pipelineScroll, setPipelineScroll);
          // Load more when near the end
          if (next >= pipelines.length - 5 && nextPageToken && !loadingMore) {
            loadMorePipelines();
          }
        }
        if (key.pageUp) {
          const next = Math.max(0, pipelineCursor - panelHeight);
          setPipelineCursor(next);
          adjustScroll(next, pipelineScroll, setPipelineScroll);
        }
        if (key.pageDown) {
          const next = Math.min(pipelines.length - 1, pipelineCursor + panelHeight);
          setPipelineCursor(next);
          adjustScroll(next, pipelineScroll, setPipelineScroll);
          if (next >= pipelines.length - 5 && nextPageToken && !loadingMore) {
            loadMorePipelines();
          }
        }
        if (key.return && selectedPipeline) {
          setActivePanel("detail");
        }
      } else {
        if (key.escape) {
          setActivePanel("pipelines");
          return;
        }
        if (key.upArrow) {
          const next = Math.max(0, detailCursor - 1);
          setDetailCursor(next);
          adjustScroll(next, detailScroll, setDetailScroll);
        }
        if (key.downArrow) {
          const next = Math.min(detailItems.length - 1, detailCursor + 1);
          setDetailCursor(next);
          adjustScroll(next, detailScroll, setDetailScroll);
        }
        if (key.pageUp) {
          const next = Math.max(0, detailCursor - panelHeight);
          setDetailCursor(next);
          adjustScroll(next, detailScroll, setDetailScroll);
        }
        if (key.pageDown) {
          const next = Math.min(detailItems.length - 1, detailCursor + panelHeight);
          setDetailCursor(next);
          adjustScroll(next, detailScroll, setDetailScroll);
        }
        if (key.return) {
          const item = detailItems[detailCursor];
          if (item?.kind === "job" && item.job.job_number != null && isJobActionable(item.job.status)) {
            onOpenLogs(item.job.job_number, item.job.name);
          }
        }
      }
    },
    { isActive }
  );

  // Visible slices
  const visiblePipelines = pipelines.slice(
    pipelineScroll,
    pipelineScroll + panelHeight
  );
  const visibleDetails = detailItems.slice(
    detailScroll,
    detailScroll + panelHeight
  );

  // Workflow summary for detail panel title (stable reference)
  const detailTitle = useMemo(() => {
    if (workflowData.length === 0) return "Workflows";
    return workflowData
      .map((wj) => `${wj.workflow.name} ${statusIcon(wj.workflow.status)}`)
      .join(" │ ");
  }, [workflowData]);

  return (
    <Box
      display={isActive ? "flex" : "none"}
      flexDirection="column"
      flexGrow={1}
    >
      <Header
        project={project}
        branch={branch}
        lastUpdated={lastUpdated}
        intervalSeconds={interval}
        loading={pipelineLoading}
      />

      <Box flexDirection="row" height={panelHeight + 2} overflow="hidden">
        {/* Left panel: Pipelines */}
        <Box
          flexDirection="column"
          width={compact ? "50%" : "40%"}
          height={panelHeight + 2}
          borderStyle="single"
          borderColor={activePanel === "pipelines" ? "cyan" : "gray"}
          borderTop={false}
          borderRight={false}
          overflow="hidden"
        >
          <Box paddingX={1} height={1} justifyContent="space-between">
            <Text bold color={activePanel === "pipelines" ? "cyan" : "white"}>
              Pipelines{pipelines.length > 0 ? ` (${pipelines.length}${nextPageToken ? "+" : ""})` : ""}
            </Text>
            {pipelines.length > panelHeight && (
              <Text dimColor>
                {pipelineScroll + 1}-
                {Math.min(pipelineScroll + panelHeight, pipelines.length)}
              </Text>
            )}
          </Box>

          {Array.from({ length: panelHeight }, (_, vi) => {
            if (vi === 0 && pipelineError) {
              return <Box key="err" paddingX={1}><Text color="red">Error: {pipelineError}</Text></Box>;
            }
            if (vi === 0 && !pipelineError && pipelines.length === 0 && !pipelineLoading) {
              return <Box key="none" paddingX={1}><Text dimColor>No pipelines found</Text></Box>;
            }
            if (pipelineError || (pipelines.length === 0 && !pipelineLoading)) {
              return <Box key={`empty-${vi}`} paddingX={1}><Text> </Text></Box>;
            }
            const p = visiblePipelines[vi];
            if (!p) {
              if (vi === visiblePipelines.length && loadingMore) {
                return <Box key="loading-more" paddingX={1}><Text dimColor>  Loading more…</Text></Box>;
              }
              if (vi === visiblePipelines.length && nextPageToken && !loadingMore) {
                return <Box key="more-hint" paddingX={1}><Text dimColor>  ↓ keep scrolling for more</Text></Box>;
              }
              return <Box key={`empty-${vi}`} paddingX={1}><Text> </Text></Box>;
            }
            const i = pipelineScroll + vi;
            const selected = i === pipelineCursor;
            const isActive_ =
              activePanel === "pipelines" && selected;
            return (
              <Box key={p.id} paddingX={1}>
                <Text
                  inverse={isActive_}
                  bold={selected}
                  color={
                    isActive_
                      ? undefined
                      : selected
                        ? "cyan"
                        : pipelineStatusColor(p.state)
                  }
                >
                  {selected ? "▸" : " "}{" "}
                  {`#${p.number}`.padEnd(6)}
                  {compact
                    ? (p.vcs?.branch ?? p.vcs?.tag ?? "—").slice(0, 10).padEnd(11)
                    : (p.vcs?.branch ?? p.vcs?.tag ?? "—").slice(0, 18).padEnd(19)
                  }
                  {timeAgo(p.created_at).padEnd(compact ? 7 : 9)}
                  {!compact && (p.trigger?.actor?.login ?? "").slice(0, 10)}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Right panel: Workflow / Jobs */}
        <Box
          flexDirection="column"
          flexGrow={1}
          height={panelHeight + 2}
          borderStyle="single"
          borderColor={activePanel === "detail" ? "cyan" : "gray"}
          borderTop={false}
          borderLeft={false}
          overflow="hidden"
        >
          <Box paddingX={1} height={1} justifyContent="space-between">
            <Text
              bold
              color={activePanel === "detail" ? "cyan" : "white"}
              wrap="truncate"
            >
              {detailTitle}
            </Text>
            {hasRunning && (
              <Text color="yellow">{spinner}</Text>
            )}
          </Box>

          {Array.from({ length: panelHeight }, (_, vi) => {
            // Show status messages in the first row
            if (vi === 0 && wfLoading && workflowData.length === 0) {
              return <Box key="loading" paddingX={1}><Text color="yellow">Loading...</Text></Box>;
            }
            if (vi === 0 && !selectedPipeline) {
              return <Box key="empty" paddingX={1}><Text dimColor>← Select a pipeline</Text></Box>;
            }
            if (!selectedPipeline || (wfLoading && workflowData.length === 0)) {
              return <Box key={`empty-d-${vi}`} paddingX={1}><Text> </Text></Box>;
            }
            const item = visibleDetails[vi];
            if (!item) {
              return <Box key={`empty-d-${vi}`} paddingX={1}><Text> </Text></Box>;
            }
            const i = detailScroll + vi;
            const selected = i === detailCursor && activePanel === "detail";

            if (item.kind === "workflow") {
              const wf = item.workflow;
              return (
                <Box key={`d-${vi}`} paddingX={1} height={1}>
                  <Text
                    bold
                    inverse={selected}
                    color={statusColor(wf.status)}
                    wrap="truncate"
                  >
                    {selected ? "▸" : " "} {statusIcon(wf.status)} {wf.name} (
                    {wf.status})
                  </Text>
                </Box>
              );
            }

            const job = item.job;
            const actionable = isJobActionable(job.status);
            const duration = formatDuration(job.started_at, job.stopped_at);
            const runningIcon =
              job.status === "running" ? spinner : statusIcon(job.status);

            const label = `${selected && actionable ? "  ▸" : "   "} ${runningIcon} ${job.name}${job.job_number ? ` #${job.job_number}` : ""}`;
            const durStr = duration ? ` ${duration}` : "";

            return (
              <Box key={`d-${vi}`} paddingX={1} height={1}>
                <Text inverse={selected && actionable} color={statusColor(job.status)} dimColor={!actionable} wrap="truncate">
                  {label}
                </Text>
                <Text color={selected ? undefined : "white"} dimColor={!selected || !actionable}>
                  {durStr}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
