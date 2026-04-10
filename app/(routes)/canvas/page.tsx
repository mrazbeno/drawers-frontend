import { Metadata } from "next";
import CanvasClient from "./CanvasClient";

export default function CanvasPage() {
    return (
        <CanvasClient/>
    );
}

export const metadata: Metadata = {
  title: "Canvas",
  description: "Canvas view for collaborative drawing.",
  alternates: { canonical: "/canvas" },
};
