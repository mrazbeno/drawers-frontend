
import type { Metadata } from "next";
import CanvasPageClient from "./page.client";

export const metadata: Metadata = {
  title: "Canvas",
  description: "Canvas view for collaborative drawing.",
  alternates: { canonical: "/canvas" },
};

export default function CanvasPage() {
  return <CanvasPageClient />;
}