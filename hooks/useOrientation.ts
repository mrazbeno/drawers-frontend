import { useState, useEffect } from "react";

export function useOrientation(): "portrait" | "landscape" {
  const getOrientation = (): "portrait" | "landscape" =>
    window.innerHeight >= window.innerWidth ? "portrait" : "landscape";

  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    typeof window === "undefined" ? "portrait" : getOrientation()
  );

  useEffect(() => {
    const handleResize = () => setOrientation(getOrientation());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return orientation;
}
