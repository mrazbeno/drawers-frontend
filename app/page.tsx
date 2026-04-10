import { Metadata } from "next";
import HomeMenu from "./HomeMenu";

export default function HomePage() {

  return (
    <HomeMenu />
  );
};

export async function generateMetadata(): Promise<Metadata> {
  const title = "Collab drawing";
  const description =
    "Collaborate live with friends and draw together on a canvas.";

  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: {
      url: "/",
      title,
      description,
      type: "website",
      siteName: "Drawers",
      locale: "en_US",
      images: ["/seo/og-main.jpeg"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/seo/og-main.jpeg"],
    },
  };
}
