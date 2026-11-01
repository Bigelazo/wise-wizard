import type { Metadata } from "next";
import "@dcc/ui/css";

export const metadata: Metadata = {
  title: "Wise Wizard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="dcc-root">{children}</body>
    </html>
  );
}
