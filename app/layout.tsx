import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dastify Credentialing",
  description: "Payer enrollment portal for Dastify and its client practices.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
