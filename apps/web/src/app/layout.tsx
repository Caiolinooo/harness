import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Last Harness",
  description: "Multi-model agent harness control plane",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="rail">
            <div className="brand">
              <span className="brand-mark">LH</span>
              <div>
                <strong>The Last Harness</strong>
                <p>Models propose. Architectures dispose.</p>
              </div>
            </div>
            <nav>
              <a href="/">Runs</a>
              <a href="/approvals">HITL Inbox</a>
              <a href="/memory">Memory</a>
              <a href="/providers">Providers</a>
              <a href="/settings">Configurações</a>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
