"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const NOTICE_DURATION_MS = 5000;

export function useTimedNotice(duration = NOTICE_DURATION_MS) {
  const [notice, updateNotice] = useState("");
  const timer = useRef(null);

  const setNotice = useCallback(
    (message) => {
      clearTimeout(timer.current);
      updateNotice(message);
      // Restart the countdown even when consecutive actions return the same message.
      timer.current = message
        ? setTimeout(() => updateNotice(""), duration)
        : null;
    },
    [duration],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return [notice, setNotice];
}
