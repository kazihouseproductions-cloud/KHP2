import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SceneFlow | KHP",
  description:
    "Edit a layered shot timeline and review video with frame-specific feedback.",
  icons: { icon: "/sceneflow.svg" },
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
