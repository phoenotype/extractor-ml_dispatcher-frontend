import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Extractor ML Dispatcher",
  description: "Configura, valida e simula i flussi documentali.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
