// useMediaQuery.ts
import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQueryList = window.matchMedia(query);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Safari support for older versions
    mediaQueryList.addEventListener
      ? mediaQueryList.addEventListener("change", listener)
      : mediaQueryList.addListener(listener);

    setMatches(mediaQueryList.matches);

    return () => {
      mediaQueryList.removeEventListener
        ? mediaQueryList.removeEventListener("change", listener)
        : mediaQueryList.removeListener(listener);
    };
  }, [query]);

  return matches;
}
