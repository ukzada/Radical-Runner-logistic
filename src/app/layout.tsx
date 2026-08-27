import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radical Runner Logistics — Dispatch Management",
  description: "Trucking dispatch management and financial operations platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
