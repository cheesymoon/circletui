import React from "react";
import { Box, Text } from "ink";
import { useSpinner } from "../hooks/useSpinner.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { timeAgo } from "../utils.js";

interface HeaderProps {
  project: string;
  branch: string | null;
  lastUpdated: Date | null;
  intervalSeconds: number;
  loading: boolean;
}

export function Header({
  project,
  branch,
  lastUpdated,
  intervalSeconds,
  loading,
}: HeaderProps) {
  const spinner = useSpinner(loading);
  const { columns } = useTerminalSize();
  const compact = columns < 100;

  const updatedText = lastUpdated ? timeAgo(lastUpdated.toISOString()) : "—";

  const displayProject = compact
    ? project.split("/").pop() ?? project
    : project;

  return (
    <Box
      borderStyle="single"
      borderColor="cyan"
      borderBottom={false}
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      <Box gap={1}>
        {!compact && (
          <>
            <Text bold color="cyan">
              cci
            </Text>
            <Text dimColor>│</Text>
          </>
        )}
        <Text bold wrap="truncate">{displayProject}</Text>
        {branch && (
          <>
            <Text dimColor>│</Text>
            <Text color="yellow" wrap="truncate">{branch}</Text>
          </>
        )}
      </Box>
      <Box gap={1} flexShrink={0}>
        <Text dimColor>
          {loading ? (
            <Text color="yellow">{spinner}</Text>
          ) : (
            `↻ ${updatedText}`
          )}
        </Text>
        {!compact && <Text dimColor>({intervalSeconds}s)</Text>}
      </Box>
    </Box>
  );
}
