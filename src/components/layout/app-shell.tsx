"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const applyServerSession = useAppStore((s) => s.applyServerSession);
  const [authState, setAuthState] = useState<"checking" | "ready">("checking");

  useEffect(() => {
    if (pathname.startsWith("/login")) {
      return;
    }

    let cancelled = false;

    fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (cancelled) return;

        if (response.status === 501) {
          setAuthState("ready");
          return;
        }

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const data = await response.json();
        if (data.session) {
          applyServerSession(data.session);
        }
        setAuthState("ready");
      })
      .catch(() => {
        if (!cancelled) setAuthState("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [applyServerSession, pathname, router]);

  if (pathname.startsWith("/login")) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        正在确认登录状态...
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
