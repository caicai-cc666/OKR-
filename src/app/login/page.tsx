"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";

interface LoginResponse {
  session?: Parameters<ReturnType<typeof useAppStore.getState>["applyServerSession"]>[0];
  error?: string;
}

const allowDemoMode =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ALLOW_DEMO_LOGIN === "true";

export default function LoginPage() {
  const router = useRouter();
  const applyServerSession = useAppStore((s) => s.applyServerSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 501) {
          if (allowDemoMode) setDemoMode(true);
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as LoginResponse;
        if (data.session) {
          applyServerSession(data.session);
          router.replace("/cases");
        }
      })
      .catch(() => {
        if (!cancelled && allowDemoMode) setDemoMode(true);
      });

    return () => {
      cancelled = true;
    };
  }, [applyServerSession, router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as LoginResponse;

      if (response.status === 501) {
        if (allowDemoMode) {
          setDemoMode(true);
          toast.info("当前是本地演示模式，服务器登录尚未启用");
        } else {
          toast.error("生产环境登录服务未启用，请检查服务器数据库配置");
        }
        return;
      }

      if (!response.ok || !data.session) {
        toast.error(data.error ?? "登录失败");
        return;
      }

      applyServerSession(data.session);
      toast.success("登录成功");
      router.push("/cases");
    } catch {
      toast.error("无法连接登录服务");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl text-slate-900">登录 OKR 拆解工具</CardTitle>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              使用企业管理员分配的邮箱和密码登录。不同企业的数据会在服务端隔离。
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入密码"
                required
              />
            </div>
            <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" type="submit" disabled={isSubmitting}>
              <LockKeyhole className="h-4 w-4" />
              {isSubmitting ? "登录中..." : "登录"}
            </Button>
          </form>

          {demoMode && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              当前环境没有配置服务端数据库登录，会保留本地演示数据。生产服务器不会启用演示登录。
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
