
import { Geist, Geist_Mono } from "next/font/google"

import "@/app/globals.css";
import { SocketProvider } from "@/providers/SocketProvider"
import {Toaster} from "@/components/ui/sonner"
import { SidebarProvider } from "@/components/ui/sidebar";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased dark`}>
        <div className="flex items-center flex-col md:flex-row justify-center h-svh w-svw">
          <SocketProvider>
            <SidebarProvider className="h-full">
            {children}
            </SidebarProvider>
          </SocketProvider>
        </div>
        <Toaster/>
      </body>
    </html>
  )
}
