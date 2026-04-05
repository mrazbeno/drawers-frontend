import CanvasClient from "./CanvasClient";

export default function CanvasPage() {
   
    return (
        <CanvasClient/>
    );
}

export async function generateMetadata() {
  const title = "Drawers — Canvas";
  const description = "Canvas view for collaborative drawing.";
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${base}/canvas`

  return {
    title,
    description,
    alternates: { canonical: url || "/" },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "Drawers",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
