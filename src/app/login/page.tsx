"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { AccountRoleLabel } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const users = useAppStore((s) => s.users);
  const tenants = useAppStore((s) => s.tenants);
  const memberships = useAppStore((s) => s.memberships);
  const loginAs = useAppStore((s) => s.loginAs);

  const platformMembership = memberships.find((item) => item.role === "platform_owner" && item.status === "active");
  const platformUser = users.find((user) => user.id === platformMembership?.userId);
  const tenantMemberships = memberships.filter((item) => item.role !== "platform_owner" && item.status === "active");

  const enter = (userId: string, tenantId?: string) => {
    loginAs(userId, tenantId);
    toast.success("已切换账号");
    router.push("/cases");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center space-y-6 px-6 py-10">
      <div className="space-y-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">选择登录身份</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          当前是本地演示登录，用来验证平台层、企业层和普通用户权限。后续接入真实邮箱登录后，同一个邮箱会进入自己所属企业的数据空间。
        </p>
      </div>

      {platformUser && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              平台层账号
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">{platformUser.name}</p>
                <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700">
                  {AccountRoleLabel.platform_owner}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">{platformUser.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tenants.map((tenant) => (
                <Button key={tenant.id} variant="outline" onClick={() => enter(platformUser.id, tenant.id)}>
                  进入 {tenant.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {tenantMemberships.map((membership) => {
          const user = users.find((item) => item.id === membership.userId);
          const tenant = tenants.find((item) => item.id === membership.tenantId);
          if (!user || !tenant) return null;

          return (
            <Card key={membership.id} className="border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                      <UserRound className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="border-0 bg-slate-100 text-slate-600">
                    {AccountRoleLabel[membership.role]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  {tenant.name}
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => enter(user.id, tenant.id)}>
                  进入工作台
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
