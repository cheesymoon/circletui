import React from "react";
import { Box, Text } from "ink";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import type { AppView } from "../types.js";

interface StatusBarProps {
  view: AppView;
}

export function StatusBar({ view }: StatusBarProps) {
  const { columns } = useTerminalSize();
  const compact = columns < 100;

  let keys: string;
  switch (view.type) {
    case "tokenInput":
      keys = "Paste or type your token · Enter submit · q quit";
      break;
    case "projectPicker":
      keys = compact
        ? "↑↓ nav · type filter · Enter · d fav · t token · q"
        : "↑↓ navigate · type to filter · Enter select · d remove ★ · t token · q quit";
      break;
    case "branchPicker":
      keys = compact
        ? "↑↓ nav · type filter · Enter · Esc cancel"
        : "↑↓ navigate · type to filter · Enter select · Esc cancel";
      break;
    case "logs":
      keys = compact
        ? "↑↓ PgUp/Dn · / search · n/N · w wrap · Esc · q"
        : "↑↓ scroll · PgUp/PgDn page · / search · n/N next/prev · w wrap · Esc back · q quit";
      break;
    case "dashboard":
      keys = compact
        ? "Tab · ↑↓ PgUp/Dn · Enter · b branch · p proj · r · q"
        : "Tab panel · ←→ switch · ↑↓ PgUp/PgDn · Enter select · b branch · p project · t token · r refresh · q quit";
      break;
  }

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="center"
    >
      <Text dimColor wrap="truncate">{keys}</Text>
    </Box>
  );
}
