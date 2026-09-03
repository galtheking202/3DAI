import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3DAI — spatial captures you own",
  description:
    "Upload video and photos of an object, apartment, or vehicle. Get a shareable 3D space whose access you control.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
