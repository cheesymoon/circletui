import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import {
  fetchJobDetailV1,
  fetchLogOutput,
} from "../api.js";
import { useSpinner } from "../hooks/useSpinner.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import type { JobStep } from "../types.js";

interface LogViewerProps {
  project: string;
  jobNumber: number;
  jobName: string;
  isActive: boolean;
  onBack: () => void;
  onQuit: () => void;
}

interface LogLine {
  text: string;
  type: "header" | "header-fail" | "content" | "content-fail" | "status" | "status-fail";
}

function scrollbarChar(
  lineIndex: number,
  totalLines: number,
  scrollOffset: number,
  viewHeight: number
): string {
  if (totalLines <= viewHeight) return " ";
  const thumbSize = Math.max(1, Math.round((viewHeight / totalLines) * viewHeight));
  const thumbStart = Math.round((scrollOffset / totalLines) * viewHeight);
  if (lineIndex >= thumbStart && lineIndex < thumbStart + thumbSize) return "┃";
  return "│";
}

export function LogViewer({
  project,
  jobNumber,
  jobName,
  isActive,
  onBack,
  onQuit,
}: LogViewerProps) {
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [jobFailed, setJobFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [wrap, setWrap] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const spinner = useSpinner(loading);
  const { columns, rows } = useTerminalSize();
  const viewHeight = Math.max(1, rows - 6);
  const maxLineWidth = Math.max(1, columns - 8);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const detail = await fetchJobDetailV1(project, jobNumber);
        if (cancelled) return;

        const steps: JobStep[] = detail.steps ?? [];
        if (steps.length === 0) {
          setLogLines([{ text: "No step output available for this job.", type: "content" }]);
          return;
        }

        const lines: LogLine[] = [];
        let anyFailed = false;

        for (const step of steps) {
          const actions = step.actions ?? [];
          const stepFailed = actions.some(
            (a) => a.status === "failed" || a.status === "timedout" || a.failed
          );
          if (stepFailed) anyFailed = true;

          lines.push({
            text: stepFailed
              ? `━━━ ✖ ${step.name} (FAILED) ━━━`
              : `━━━ ${step.name} ━━━`,
            type: stepFailed ? "header-fail" : "header",
          });

          let hasContent = false;
          const lineType = stepFailed ? "content-fail" as const : "content" as const;

          for (const action of actions) {
            if (action.output && action.output.length > 0) {
              const text = action.output.map((o) => o.message).join("");
              if (text.trim()) {
                lines.push({ text, type: lineType });
                hasContent = true;
              }
              continue;
            }

            if (action.output_url) {
              const text = await fetchLogOutput(action.output_url);
              if (cancelled) return;
              if (text.trim()) {
                lines.push({ text, type: lineType });
                hasContent = true;
              }
            }
          }

          if (!hasContent) {
            const dur = actions
              .filter((a) => a.run_time_millis != null)
              .reduce((sum, a) => sum + (a.run_time_millis ?? 0), 0);
            const status = actions[0]?.status ?? "unknown";
            const durStr = dur > 0 ? ` (${Math.round(dur / 1000)}s)` : "";
            const icon = stepFailed ? "✖" : "✓";
            lines.push({
              text: `  ${icon} ${status}${durStr}`,
              type: stepFailed ? "status-fail" : "status",
            });
          }

          lines.push({ text: "", type: "content" });
        }

        if (!cancelled) {
          setLogLines(lines);
          setJobFailed(anyFailed);
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
  }, [project, jobNumber]);

  const allLines: LogLine[] = useMemo(() => logLines.flatMap((entry) => {
    const cleaned = entry.text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => {
        const parts = l.split("\r");
        const cleaned = parts[parts.length - 1] ?? "";
        return cleaned
          .replace(
            // eslint-disable-next-line no-control-regex
            /\x1b\[[0-9;]*[a-zA-Z]/g,
            ""
          )
          .replace(/\t/g, "  ")
          .replace(
            // eslint-disable-next-line no-control-regex
            /[\x00-\x08\x0b\x0c\x0e-\x1f]/g,
            ""
          );
      });

    if (!wrap) {
      return cleaned.map((text) => ({ text, type: entry.type }));
    }

    const wrapped: LogLine[] = [];
    for (const text of cleaned) {
      if (text.length <= maxLineWidth) {
        wrapped.push({ text, type: entry.type });
      } else {
        for (let i = 0; i < text.length; i += maxLineWidth) {
          wrapped.push({
            text: text.slice(i, i + maxLineWidth),
            type: entry.type,
          });
        }
      }
    }
    return wrapped;
  }), [logLines, wrap, maxLineWidth]);

  // Search: find matching line indices
  const matchedLines = useMemo(() => {
    if (!activeQuery) return [];
    const q = activeQuery.toLowerCase();
    const matches: number[] = [];
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].text.toLowerCase().includes(q)) {
        matches.push(i);
      }
    }
    return matches;
  }, [allLines, activeQuery]);

  const matchSet = useMemo(
    () => new Set(matchedLines),
    [matchedLines]
  );

  const maxScroll = Math.max(0, allLines.length - viewHeight);

  // Jump to match when matchIndex changes
  useEffect(() => {
    if (matchedLines.length > 0 && matchedLines[matchIndex] != null) {
      const target = matchedLines[matchIndex];
      // Center the match in the viewport
      setScrollOffset(Math.min(maxScroll, Math.max(0, target - Math.floor(viewHeight / 2))));
    }
  }, [matchIndex, matchedLines, maxScroll, viewHeight]);

  useInput(
    (input, key) => {
      // Search mode input
      if (searchMode) {
        if (key.escape) {
          setSearchMode(false);
          return;
        }
        if (key.return) {
          setSearchMode(false);
          setActiveQuery(searchQuery);
          setMatchIndex(0);
          return;
        }
        if (key.backspace || key.delete) {
          setSearchQuery((q) => q.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta && !key.tab) {
          setSearchQuery((q) => q + input);
        }
        return;
      }

      // Normal mode
      if (input === "q") {
        onQuit();
        return;
      }
      if (key.escape) {
        if (activeQuery) {
          setActiveQuery("");
          setSearchQuery("");
          setMatchIndex(0);
          return;
        }
        onBack();
        return;
      }
      if (input === "/") {
        setSearchMode(true);
        setSearchQuery("");
        return;
      }
      if (input === "n" && activeQuery) {
        setMatchIndex((i) =>
          matchedLines.length > 0 ? (i + 1) % matchedLines.length : 0
        );
        return;
      }
      if (input === "N" && activeQuery) {
        setMatchIndex((i) =>
          matchedLines.length > 0
            ? (i - 1 + matchedLines.length) % matchedLines.length
            : 0
        );
        return;
      }
      if (input === "w") {
        setWrap((w) => !w);
        setScrollOffset(0);
        return;
      }
      if (key.upArrow) {
        setScrollOffset((o) => Math.max(0, o - 1));
      }
      if (key.downArrow) {
        setScrollOffset((o) => Math.min(maxScroll, o + 1));
      }
      if (key.pageDown) {
        setScrollOffset((o) => Math.min(maxScroll, o + viewHeight));
      }
      if (key.pageUp) {
        setScrollOffset((o) => Math.max(0, o - viewHeight));
      }
    },
    { isActive }
  );

  const visibleLines = allLines.slice(
    scrollOffset,
    scrollOffset + viewHeight
  );

  // Pad to fixed height
  while (visibleLines.length < viewHeight) {
    visibleLines.push({ text: "", type: "content" });
  }

  const hasScroll = allLines.length > viewHeight;
  const scrollPct = allLines.length > 0
    ? Math.round((scrollOffset / Math.max(1, maxScroll)) * 100)
    : 0;

  function lineColor(type: LogLine["type"]): string | undefined {
    switch (type) {
      case "header":
        return "cyan";
      case "header-fail":
        return "red";
      case "content-fail":
        return "red";
      case "status-fail":
        return "red";
      case "status":
        return "green";
      default:
        return undefined;
    }
  }

  // Highlight search matches in a line
  function renderLine(line: LogLine, globalIndex: number) {
    const isHeader = line.type === "header" || line.type === "header-fail";
    const isCurrentMatch =
      activeQuery && matchedLines[matchIndex] === globalIndex;
    const isMatch = activeQuery && matchSet.has(globalIndex);

    let displayText = line.text;
    if (displayText.length > maxLineWidth) {
      displayText = wrap
        ? displayText.slice(0, maxLineWidth)
        : displayText.slice(0, maxLineWidth - 1) + "…";
    }

    if (!activeQuery || !displayText) {
      return (
        <Text
          color={lineColor(line.type)}
          bold={isHeader}
          wrap="truncate"
        >
          {displayText || " "}
        </Text>
      );
    }

    // Split text around search matches and highlight them
    const parts: React.ReactNode[] = [];
    const q = activeQuery.toLowerCase();
    const lower = displayText.toLowerCase();
    let lastEnd = 0;

    while (true) {
      const idx = lower.indexOf(q, lastEnd);
      if (idx === -1) break;

      if (idx > lastEnd) {
        parts.push(
          <Text key={`t${lastEnd}`} color={lineColor(line.type)} bold={isHeader}>
            {displayText.slice(lastEnd, idx)}
          </Text>
        );
      }
      parts.push(
        <Text
          key={`m${idx}`}
          backgroundColor={isCurrentMatch ? "yellow" : "white"}
          color="black"
          bold
        >
          {displayText.slice(idx, idx + q.length)}
        </Text>
      );
      lastEnd = idx + q.length;
    }

    if (lastEnd < displayText.length) {
      parts.push(
        <Text key={`t${lastEnd}`} color={lineColor(line.type)} bold={isHeader}>
          {displayText.slice(lastEnd)}
        </Text>
      );
    }

    return (
      <Text
        backgroundColor={isCurrentMatch ? "#3a3a00" : isMatch ? "#1a1a2e" : undefined}
        wrap="truncate"
      >
        {isMatch && !isCurrentMatch ? (
          <Text color="yellow">{"▸ "}</Text>
        ) : isCurrentMatch ? (
          <Text color="yellow" bold>{"▸ "}</Text>
        ) : null}
        {parts}
      </Text>
    );
  }

  return (
    <Box
      display={isActive ? "flex" : "none"}
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor={jobFailed ? "red" : "cyan"}
      overflow="hidden"
    >
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color={jobFailed ? "red" : "cyan"}>
          {jobFailed ? "✖ " : ""}{jobName} (#{jobNumber})
          {jobFailed ? " — FAILED" : ""}
        </Text>
        {loading ? (
          <Text color="yellow">{spinner} Loading logs...</Text>
        ) : (
          <Box gap={1}>
            {wrap && <Text color="yellow">WRAP</Text>}
            {activeQuery && (
              <Text color="yellow">
                [{matchedLines.length > 0 ? `${matchIndex + 1}/${matchedLines.length}` : "no match"}]
              </Text>
            )}
            {hasScroll && (
              <Text dimColor>
                {scrollOffset === 0
                  ? "TOP"
                  : scrollOffset >= maxScroll
                    ? "END"
                    : `${scrollPct}%`}
              </Text>
            )}
            <Text dimColor>
              {allLines.length > 0
                ? `${scrollOffset + 1}-${Math.min(scrollOffset + viewHeight, allLines.length)}/${allLines.length}`
                : ""}
            </Text>
          </Box>
        )}
      </Box>

      {searchMode && (
        <Box paddingX={1}>
          <Text color="yellow">/</Text>
          <Text>{searchQuery}</Text>
          <Text color="yellow">█</Text>
        </Box>
      )}

      {error && (
        <Box paddingX={1} flexDirection="column">
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      <Box flexDirection="row" height={searchMode ? viewHeight - 1 : viewHeight} overflow="hidden">
        <Box flexDirection="column" flexGrow={1} paddingLeft={1} overflow="hidden" height={searchMode ? viewHeight - 1 : viewHeight}>
          {visibleLines.map((line, i) => (
            <Box key={scrollOffset + i}>
              {renderLine(line, scrollOffset + i)}
            </Box>
          ))}
        </Box>
        {hasScroll && (
          <Box flexDirection="column" width={1} height={searchMode ? viewHeight - 1 : viewHeight}>
            {visibleLines.map((_, i) => (
              <Text key={i} dimColor>
                {scrollbarChar(i, allLines.length, scrollOffset, searchMode ? viewHeight - 1 : viewHeight)}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
