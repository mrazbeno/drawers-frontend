import HomeMenu from "./HomeMenu";

export default function HomePage() {
    
    return (
        <HomeMenu/>
    );
};

export async function generateMetadata() {
  const title = "Drawers — Collab drawing";
  const description = "Collaborate live with friends and draw together on a canvas.";
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";

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
