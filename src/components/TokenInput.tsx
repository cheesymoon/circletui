import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { validateToken } from "../api.js";
import { useSpinner } from "../hooks/useSpinner.js";

interface TokenInputProps {
  isActive: boolean;
  onSubmit: (token: string) => void;
  onQuit: () => void;
}

export function TokenInput({ isActive, onSubmit, onQuit }: TokenInputProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const spinner = useSpinner(validating);

  useInput(
    (input, key) => {
      if (validating) return;

      if (key.escape || (input === "q" && !token)) {
        onQuit();
        return;
      }
      if (key.return) {
        const trimmed = token.trim();
        if (!trimmed) {
          setError("Token cannot be empty");
          return;
        }
        setValidating(true);
        setError(null);
        validateToken(trimmed).then((valid) => {
          setValidating(false);
          if (valid) {
            onSubmit(trimmed);
          } else {
            setError("Invalid token — authentication failed. Check your token and try again.");
          }
        });
        return;
      }
      if (key.backspace || key.delete) {
        setToken((t) => t.slice(0, -1));
        setError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.tab) {
        setToken((t) => t + input);
        setError(null);
      }
    },
    { isActive }
  );

  const masked = token.length > 0 ? "*".repeat(token.length) : "";

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
          CircleCI Token Setup
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text>
          A CircleCI personal API token is required to use this tool.
        </Text>
        <Text dimColor>
          Generate one at: https://app.circleci.com/settings/user/tokens
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text dimColor>
          The token will be saved to ~/.config/circleci-tui/token
        </Text>
        <Text dimColor>
          You can also set the CIRCLECI_TOKEN environment variable instead.
        </Text>
      </Box>

      <Box>
        <Text>Token: </Text>
        <Text color="yellow">{masked}</Text>
        {!validating && <Text color="yellow">█</Text>}
      </Box>

      {validating && (
        <Box marginTop={1}>
          <Text color="yellow">{spinner} Validating token...</Text>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
