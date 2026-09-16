import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth-context";
import { NavUser } from "@/components/NavUser";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koya Content Lab — Therese Week 4",
  description: "AI Content Research and Publishing System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" suppressHydrationWarning>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              style: { maxWidth: "420px", fontSize: "13px", background: "#fff", color: "#1a1a1a", border: "1px solid #d1cbc6" },
            }}
          />
          <nav className="border-b bg-[#1f1823] text-white">
            <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <a href="/" className="flex items-center gap-2.5">
                  <span className="text-lg font-bold tracking-tight">Koya Content Lab</span>
                  <span className="text-[10px] font-medium bg-white/15 text-white/80 px-2 py-0.5 rounded-full">
                    Therese — Week 4
                  </span>
                </a>
                <div className="hidden sm:flex items-center gap-1 ml-4">
                  <a href="/" className="text-sm text-white/70 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
                    Dashboard
                  </a>
                  <a href="/queue" className="text-sm text-white/70 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
                    Publishing Queue
                  </a>
                </div>
              </div>
              <NavUser />
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
