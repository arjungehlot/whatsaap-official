import { useCallback, useEffect, useRef } from "react";

/**
 * Only lets the newest request in a UI scope update state. This prevents a
 * slower response for a previous route, filter, or selected record winning a race.
 */
export function useRequestFence() {
  const mountedRef = useRef(true);
  const versionRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      versionRef.current += 1;
    };
  }, []);

  return useCallback(() => {
    const version = ++versionRef.current;
    return () => mountedRef.current && version === versionRef.current;
  }, []);
}
