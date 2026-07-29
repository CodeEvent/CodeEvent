import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetAlertX ATT&CK Bridge",
  description: "Network events, mapped to MITRE ATT&CK, as STIX Sightings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
