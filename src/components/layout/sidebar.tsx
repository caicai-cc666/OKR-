"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  LayoutDashboard,
  LogIn,
  Plus,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AccountRoleLabel, roleHasPermission } from "@/types";

const navItems = [
  { href: "/cases", label: "工作台", icon: LayoutDashboard, permission: undefined },
  { href: "/config", label: "系统配置", icon: Settings, permission: "tenant.manageConfig" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useAppStore((s) => s.users.find((user) => user.id === s.currentUserId));
  const currentTenant = useAppStore((s) => s.tenants.find((tenant) => tenant.id === s.currentTenantId));
  const tenants = useAppStore((s) => s.tenants);
  const memberships = useAppStore((s) => s.memberships);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentTenantId = useAppStore((s) => s.currentTenantId);
  const switchTenant = useAppStore((s) => s.switchTenant);
  const logoutLocal = useAppStore((s) => s.logoutLocal);
  const currentRole =
    memberships.find((item) => item.userId === currentUserId && item.tenantId === currentTenantId && item.status === "active")?.role ??
    memberships.find((item) => item.userId === currentUserId && item.role === "platform_owner" && item.status === "active")?.role;
  const visibleNavItems = navItems.filter((item) => !item.permission || roleHasPermission(currentRole, item.permission));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    logoutLocal();
    router.push("/login");
  };

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
          <span className="text-[10px] font-bold text-white">OKR</span>
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-900">OKR 拆解</h1>
          <p className="text-[11px] leading-none text-slate-400">智能 OKR 拆解工具</p>
        </div>
      </div>

      <div className="px-4 py-4">
        <Link href="/cases/new">
          <Button className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            新建拆解
          </Button>
        </Link>
      </div>

      <Separator className="mx-4 w-auto" />

      <nav className="flex-1 space-y-1 px-3 py-3">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-blue-600" : "text-slate-400")} />
              {item.label}
              {isActive && <ChevronRight className="ml-auto h-4 w-4 text-blue-400" />}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-100 px-4 py-4">
        {currentRole === "platform_owner" && (
          <select
            value={currentTenantId}
            onChange={(event) => switchTenant(event.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
            <span className="text-xs font-medium text-slate-600">
              {currentUser?.name.slice(0, 1) ?? "U"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-700">
              {currentUser?.name ?? "未登录用户"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {currentTenant?.name ?? "未选择企业"} · {currentRole ? AccountRoleLabel[currentRole] : "未识别角色"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
        >
          <LogIn className="h-3.5 w-3.5" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
