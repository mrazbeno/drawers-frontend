
import { Geist, Geist_Mono } from "next/font/google"
import "@/app/globals.css";
import {Toaster} from "@/components/ui/sonner"
import { Metadata } from "next";
import { DrawingRoomSessionProvider } from "./lib/drawing/react/DrawingRoomSessionProvider";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Drawers",
    template: "%s | Drawers",
  },
  description: "Collaborate live with friends and draw together on a canvas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased dark`}>
        <div className="flex items-center flex-col md:flex-row justify-center h-svh w-svw">
          <DrawingRoomSessionProvider>
              {children}
          </DrawingRoomSessionProvider>
        </div>
        <Toaster/>
      </body>
    </html>
  )
}
