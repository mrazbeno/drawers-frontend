import React from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOrientation } from "@/hooks/useOrientation";

export function useResponsive() {
  const [mounted, setMounted] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const orientation = useOrientation();

  React.useEffect(() => setMounted(true), []);

  return mounted ? { isMobile, orientation } : { isMobile: false, orientation: "portrait" as const };
}
