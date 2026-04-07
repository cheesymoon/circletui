import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { useTerminalSize } from "./hooks/useTerminalSize.js";
import { hasToken, setToken as saveToken, addRecentProject } from "./api.js";
import { TokenInput } from "./components/TokenInput.js";
import { ProjectPicker } from "./components/ProjectPicker.js";
import { BranchPicker } from "./components/BranchPicker.js";
import { Dashboard } from "./components/Dashboard.js";
import { LogViewer } from "./components/LogViewer.js";
import { StatusBar } from "./components/StatusBar.js";
import type { AppView } from "./types.js";

interface AppProps {
  initialProject?: string;
  branch?: string;
  interval: number;
  exit: () => void;
}

function initialView(initialProject?: string): AppView {
  if (!hasToken()) return { type: "tokenInput" };
  if (initialProject) return { type: "dashboard" };
  return { type: "projectPicker" };
}

export function App({ initialProject, branch: initialBranch, interval, exit }: AppProps) {
  const { columns, rows } = useTerminalSize();
  const [project, setProject] = useState<string | null>(initialProject ?? null);
  const [branch, setBranch] = useState<string | null>(initialBranch ?? null);
  const [view, setView] = useState<AppView>(() => initialView(initialProject));
  const [branchPickerBranches, setBranchPickerBranches] = useState<string[]>(
    []
  );
  const [tokenVersion, setTokenVersion] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const requestQuit = useCallback(() => {
    setConfirmQuit(true);
  }, []);

  useInput(
    (input) => {
      if (input === "y" || input === "Y") {
        exit();
      } else {
        setConfirmQuit(false);
      }
    },
    { isActive: confirmQuit }
  );

  // Token handler
  const handleTokenSubmit = useCallback(
    (token: string) => {
      saveToken(token);
      setTokenVersion((v) => v + 1);
      setView(initialProject ? { type: "dashboard" } : { type: "projectPicker" });
    },
    [initialProject]
  );

  // Token change handler
  const handleChangeToken = useCallback(() => {
    setView({ type: "tokenInput" });
  }, []);

  // Project picker handlers
  const handleSelectProject = useCallback((slug: string) => {
    addRecentProject(slug);
    setProject(slug);
    setBranch(null);
    setView({ type: "dashboard" });
  }, []);

  const handleOpenProjectPicker = useCallback(() => {
    setView({ type: "projectPicker" });
  }, []);

  // Branch picker handlers
  const handleOpenBranchPicker = useCallback((branches: string[]) => {
    setBranchPickerBranches(branches);
    setView({ type: "branchPicker" });
  }, []);

  const handleSelectBranch = useCallback((b: string | null) => {
    setBranch(b);
    setView({ type: "dashboard" });
  }, []);

  const handleCancelBranch = useCallback(() => {
    setView({ type: "dashboard" });
  }, []);

  // Log viewer handlers
  const handleOpenLogs = useCallback((jobNumber: number, jobName: string) => {
    setView({ type: "logs", jobNumber, jobName });
  }, []);

  const handleCloseLogs = useCallback(() => {
    setView({ type: "dashboard" });
  }, []);

  const MIN_COLS = 63;
  const MIN_ROWS = 8;
  const tooSmall = columns < MIN_COLS || rows < MIN_ROWS;

  // Keep input handler alive even when showing the "too small" screen
  useInput(
    (input) => {
      if (input === "q") exit();
    },
    { isActive: tooSmall }
  );

  if (tooSmall) {
    return (
      <Box
        flexDirection="column"
        width={columns}
        height={rows}
        alignItems="center"
        justifyContent="center"
      >
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="yellow"
          paddingX={2}
          paddingY={1}
          alignItems="center"
        >
          <Text bold color="yellow">
            Terminal too small
          </Text>
          <Text>
            Current: {columns}x{rows}
          </Text>
          <Text>
            Minimum: {MIN_COLS}x{MIN_ROWS}
          </Text>
          <Text dimColor>Resize your terminal to continue</Text>
        </Box>
      </Box>
    );
  }

  if (confirmQuit) {
    return (
      <Box
        flexDirection="column"
        width={columns}
        height={rows}
        alignItems="center"
        justifyContent="center"
      >
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="red"
          paddingX={2}
          paddingY={1}
          alignItems="center"
        >
          <Text bold color="red">
            Quit?
          </Text>
          <Text>Press y to confirm, any other key to cancel</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box flexGrow={1} flexDirection="column">
        <TokenInput
          isActive={view.type === "tokenInput"}
          onSubmit={handleTokenSubmit}
          onQuit={requestQuit}
        />

        <ProjectPicker
          key={`picker-${tokenVersion}`}
          isActive={view.type === "projectPicker"}
          onSelect={handleSelectProject}
          onChangeToken={handleChangeToken}
          onQuit={requestQuit}
        />

        {project && (
          <Dashboard
            key={project}
            project={project}
            branch={branch}
            interval={interval}
            isActive={view.type === "dashboard"}
            onOpenProjectPicker={handleOpenProjectPicker}
            onOpenBranchPicker={handleOpenBranchPicker}
            onOpenLogs={handleOpenLogs}
            onChangeToken={handleChangeToken}
            onQuit={requestQuit}
          />
        )}

        {view.type === "branchPicker" && (
          <BranchPicker
            branches={branchPickerBranches}
            currentBranch={branch}
            isActive={true}
            onSelect={handleSelectBranch}
            onCancel={handleCancelBranch}
          />
        )}

        {view.type === "logs" && project && (
          <LogViewer
            project={project}
            jobNumber={view.jobNumber}
            jobName={view.jobName}
            isActive={true}
            onBack={handleCloseLogs}
            onQuit={requestQuit}
          />
        )}
      </Box>
      <StatusBar view={view} />
    </Box>
  );
}
