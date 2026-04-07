import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import {
  fetchFollowedProjects,
  projectSlug,
  getRecentProjects,
  removeRecentProject,
} from "../api.js";
import { useSpinner } from "../hooks/useSpinner.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import type { FollowedProject } from "../types.js";

interface ProjectPickerProps {
  isActive: boolean;
  onSelect: (slug: string) => void;
  onChangeToken: () => void;
  onQuit: () => void;
}

interface ListItem {
  slug: string;
  defaultBranch?: string;
  isRecent: boolean;
}

export function ProjectPicker({
  isActive,
  onSelect,
  onChangeToken,
  onQuit,
}: ProjectPickerProps) {
  const [projects, setProjects] = useState<FollowedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState(0);
  const spinner = useSpinner(loading);
  const { rows } = useTerminalSize();
  const [recent, setRecent] = useState(getRecentProjects);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchFollowedProjects();
        if (!cancelled) {
          setProjects(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build combined list: recent projects first, then followed projects
  const items: ListItem[] = [];
  const seen = new Set<string>();

  // Add recent projects first
  for (const slug of recent) {
    if (filter && !slug.toLowerCase().includes(filter.toLowerCase())) continue;
    items.push({ slug, isRecent: true });
    seen.add(slug);
  }

  // Add followed projects (excluding already-shown recent ones)
  for (const p of projects) {
    const slug = projectSlug(p);
    if (seen.has(slug)) continue;
    if (filter && !slug.toLowerCase().includes(filter.toLowerCase())) continue;
    items.push({ slug, defaultBranch: p.default_branch, isRecent: false });
    seen.add(slug);
  }

  const maxVisible = Math.max(1, rows - 12);
  const visible = items.slice(0, maxVisible);

  useInput(
    (input, key) => {
      if (input === "q" && !filter) {
        onQuit();
        return;
      }
      if (input === "t" && !filter) {
        onChangeToken();
        return;
      }
      if (input === "d" && !filter && visible[cursor]?.isRecent) {
        removeRecentProject(visible[cursor].slug);
        setRecent(getRecentProjects());
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.escape) {
        if (filter) {
          setFilter("");
          setCursor(0);
        } else {
          onQuit();
        }
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
          onSelect(visible[cursor].slug);
        } else if (filter.includes("/")) {
          onSelect(filter);
        }
        return;
      }
      if (input && !key.ctrl && !key.meta) {
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
          Select a CircleCI Project
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Filter: </Text>
        <Text color="yellow">{filter}</Text>
        <Text color="yellow">█</Text>
      </Box>

      {loading && (
        <Box>
          <Text color="yellow">{spinner} Loading projects...</Text>
        </Box>
      )}

      {error && (
        <Box flexDirection="column">
          <Text color="red">Error: {error}</Text>
          <Text dimColor>
            Press t to re-enter your token, or type a project slug directly
            (e.g., gh/org/repo) and press Enter
          </Text>
        </Box>
      )}

      {!loading && !error && items.length === 0 && (
        <Box>
          <Text dimColor>
            {filter
              ? `No projects match "${filter}". Type a full slug and press Enter.`
              : "No followed projects found."}
          </Text>
        </Box>
      )}

      {visible.map((item, i) => {
        const selected = i === cursor;
        return (
          <Box key={item.slug} paddingX={1}>
            <Text inverse={selected} color={selected ? "cyan" : undefined}>
              {selected ? "▸ " : "  "}
              {item.slug}
            </Text>
            {item.isRecent && (
              <Text color="yellow"> ★</Text>
            )}
            {item.defaultBranch && (
              <Text dimColor>
                {"  "}
                {item.defaultBranch}
              </Text>
            )}
          </Box>
        );
      })}

      {items.length > maxVisible && (
        <Box paddingX={1} marginTop={1}>
          <Text dimColor>
            ... and {items.length - maxVisible} more (type to filter)
          </Text>
        </Box>
      )}
    </Box>
  );
}
