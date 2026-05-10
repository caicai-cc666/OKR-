"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { AccountRoleLabel } from "@/types";

const pageTitles: Record<string, string> = {
  "/": "工作台",
  "/cases": "工作台",
  "/cases/new": "新建拆解",
  "/config": "系统配置",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/cases/")) return "案例详情";
  return "OKR 拆解";
}

export function TopBar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const currentTenant = useAppStore((s) => s.tenants.find((tenant) => tenant.id === s.currentTenantId));
  const memberships = useAppStore((s) => s.memberships);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentTenantId = useAppStore((s) => s.currentTenantId);
  const currentRole =
    memberships.find((item) => item.userId === currentUserId && item.tenantId === currentTenantId && item.status === "active")?.role ??
    memberships.find((item) => item.userId === currentUserId && item.role === "platform_owner" && item.status === "active")?.role;

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <Badge variant="secondary" className="border-0 bg-slate-100 text-slate-600">
          {currentTenant?.name ?? "未选择企业"}
        </Badge>
        {currentRole && (
          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700">
            {AccountRoleLabel[currentRole]}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="搜索案例..."
            className="h-9 w-64 border-slate-200 bg-slate-50 pl-9"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-[18px] w-[18px] text-slate-500" />
          <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 border-2 border-white bg-red-500 px-1 text-[10px] text-white">
            3
          </Badge>
        </Button>
      </div>
    </header>
  );
}
