"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";

export default function PasswordPage() {
  const router = useRouter();
  const applyServerSession = useAppStore((s) => s.applyServerSession);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "修改密码失败");
        return;
      }

      const me = await fetch("/api/auth/me", { credentials: "include" });
      if (me.ok) {
        const sessionData = await me.json();
        if (sessionData.session) applyServerSession(sessionData.session);
      }
      toast.success("密码已更新");
      router.replace("/cases");
    } catch {
      toast.error("无法连接服务器");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <Card className="w-full border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl text-slate-900">修改密码</CardTitle>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              首次登录或管理员重置密码后，需要先设置自己的新密码。
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="current-password">当前密码</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-slate-400">至少 8 位，建议包含字母、数字和符号。</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" type="submit" disabled={isSaving}>
              {isSaving ? "保存中..." : "保存新密码"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
