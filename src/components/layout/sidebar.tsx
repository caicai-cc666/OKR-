"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Plus,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/cases", label: "工作台", icon: LayoutDashboard },
  { href: "/config", label: "系统配置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <span className="text-white font-bold text-[10px]">OKR</span>
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-900">
            OKR拆解
          </h1>
          <p className="text-[11px] text-slate-400 leading-none">
            智能 OKR 拆解工具
          </p>
        </div>
      </div>

      {/* Quick Action */}
      <div className="px-4 py-4">
        <Link href="/cases/new">
          <Button className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            新建拆解
          </Button>
        </Link>
      </div>

      <Separator className="mx-4 w-auto" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-[18px] h-[18px]", isActive ? "text-blue-600" : "text-slate-400")} />
              {item.label}
              {isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <span className="text-xs font-medium text-slate-600">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">
              Demo 用户
            </p>
            <p className="text-xs text-slate-400 truncate">demo@okr-harness.io</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
