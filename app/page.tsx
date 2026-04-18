import { Metadata } from "next";
import HomeMenu from "./HomeMenu";
import { Suspense } from "react";

export default function HomePage() {

  return (
    <Suspense fallback={null}>
        <HomeMenu />
    </Suspense>
  );
};

export async function generateMetadata(): Promise<Metadata> {
  const description =
    "Collaborate live with friends and draw together on a canvas.";

  return {
    description,
    alternates: { canonical: "/" },
    openGraph: {
      url: "/",
      description,
      type: "website",
      siteName: "Drawers",
      locale: "en_US",
      images: ["/seo/og-main.jpeg"],
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: ["/seo/og-main.jpeg"],
    },
  };
}
