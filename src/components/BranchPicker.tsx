import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTerminalSize } from "../hooks/useTerminalSize.js";

interface BranchPickerProps {
  branches: string[];
  currentBranch: string | null;
  isActive: boolean;
  onSelect: (branch: string | null) => void;
  onCancel: () => void;
}

export function BranchPicker({
  branches,
  currentBranch,
  isActive,
  onSelect,
  onCancel,
}: BranchPickerProps) {
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState(0);
  const { rows } = useTerminalSize();

  const filtered = branches.filter((b) =>
    b.toLowerCase().includes(filter.toLowerCase())
  );
  const options: Array<{ label: string; value: string | null }> = [
    { label: "All branches", value: null },
    ...filtered.map((b) => ({ label: b, value: b })),
  ];

  const maxVisible = Math.max(1, rows - 10);
  const visible = options.slice(0, maxVisible);

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.backspace || key.delete) {
        setFilter((f) => f.slice(0, -1));
        setCursor(0);
        return;
      }
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(visible.length - 1, c + 1));
        return;
      }
      if (key.return) {
        if (visible[cursor]) {
          onSelect(visible[cursor].value);
        }
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.tab) {
        setFilter((f) => f + input);
        setCursor(0);
      }
    },
    { isActive }
  );

  return (
    <Box
      display={isActive ? "flex" : "none"}
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1} justifyContent="center">
        <Text bold color="cyan">
          Select Branch
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Filter: </Text>
        <Text color="yellow">{filter}</Text>
        <Text color="yellow">█</Text>
      </Box>

      {visible.map((opt, i) => {
        const selected = i === cursor;
        const isCurrent = opt.value === currentBranch;
        return (
          <Box key={opt.label} paddingX={1}>
            <Text inverse={selected} color={selected ? "cyan" : undefined}>
              {selected ? "▸ " : "  "}
              {opt.label}
              {isCurrent ? " ●" : ""}
            </Text>
          </Box>
        );
      })}

      {options.length > maxVisible && (
        <Box paddingX={1} marginTop={1}>
          <Text dimColor>
            ... and {options.length - maxVisible} more (type to filter)
          </Text>
        </Box>
      )}
    </Box>
  );
}
