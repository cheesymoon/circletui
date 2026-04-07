import { useState, useEffect } from "react";

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function useSpinner(enabled: boolean = true): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(
      () => setFrame((f) => (f + 1) % frames.length),
      80
    );
    return () => clearInterval(timer);
  }, [enabled]);

  return enabled ? frames[frame]! : "";
}
