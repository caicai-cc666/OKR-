"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, KeyRound, Plus, RefreshCcw, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { AccountRoleLabel, type AccountRole } from "@/types";

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  status: string;
  password_reset_required: boolean;
  role: AccountRole;
  membership_status: string;
  tenant_id: string;
}

const roleOptions: Array<{ role: AccountRole; label: string }> = [
  { role: "tenant_owner", label: AccountRoleLabel.tenant_owner },
  { role: "tenant_admin", label: AccountRoleLabel.tenant_admin },
  { role: "member", label: AccountRoleLabel.member },
];

export function AccountsTab() {
  const currentTenantId = useAppStore((s) => s.currentTenantId);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const tenants = useAppStore((s) => s.tenants);
  const memberships = useAppStore((s) => s.memberships);
  const currentRole =
    memberships.find((item) => item.userId === currentUserId && item.tenantId === currentTenantId && item.status === "active")?.role ??
    memberships.find((item) => item.userId === currentUserId && item.role === "platform_owner" && item.status === "active")?.role;
  const canCreateTenant = currentRole === "platform_owner";
  const availableRoles = useMemo(() => {
    if (currentRole === "platform_owner") return roleOptions;
    if (currentRole === "tenant_owner") return roleOptions.filter((item) => item.role !== "tenant_owner");
    if (currentRole === "tenant_admin") return roleOptions.filter((item) => item.role === "member");
    return [];
  }, [currentRole]);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<AccountRole>(availableRoles[0]?.role ?? "member");
  const [lastPassword, setLastPassword] = useState<{ email: string; password: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const effectiveUserRole = availableRoles.some((item) => item.role === userRole)
    ? userRole
    : availableRoles[0]?.role ?? "member";

  const loadUsers = useCallback(async () => {
    if (!currentTenantId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/users?tenantId=${encodeURIComponent(currentTenantId)}`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { users: ManagedUser[] };
      setUsers(data.users ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenantId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
    });
  }, [loadUsers]);

  const createTenant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: tenantName, slug: tenantSlug, ownerEmail, ownerName }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "创建企业失败");
      return;
    }
    setLastPassword({ email: data.email, password: data.temporaryPassword });
    toast.success("企业和企业超级管理员已创建");
    setTenantName("");
    setTenantSlug("");
    setOwnerEmail("");
    setOwnerName("");
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tenantId: currentTenantId, email: userEmail, name: userName, role: effectiveUserRole }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "创建用户失败");
      return;
    }
    setLastPassword({ email: data.email, password: data.temporaryPassword });
    toast.success("用户已创建，临时密码已生成");
    setUserEmail("");
    setUserName("");
    await loadUsers();
  };

  const resetPassword = async (user: ManagedUser) => {
    const response = await fetch("/api/admin/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tenantId: currentTenantId, userId: user.id }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "重置密码失败");
      return;
    }
    setLastPassword({ email: user.email, password: data.temporaryPassword });
    toast.success("临时密码已生成");
    await loadUsers();
  };

  return (
    <div className="space-y-4">
      {lastPassword && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="space-y-2 p-4 text-sm text-amber-800">
            <p className="font-medium">请复制并单独发给用户，系统不会再次显示这个临时密码。</p>
            <p>账号：{lastPassword.email}</p>
            <p className="font-mono">临时密码：{lastPassword.password}</p>
          </CardContent>
        </Card>
      )}

      {canCreateTenant && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-blue-600" />
              创建试用企业
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={createTenant}>
              <div className="space-y-1.5">
                <Label>企业名称</Label>
                <Input value={tenantName} onChange={(event) => setTenantName(event.target.value)} placeholder="例如：润米" required />
              </div>
              <div className="space-y-1.5">
                <Label>企业标识</Label>
                <Input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} placeholder="例如：runmi" required />
              </div>
              <div className="space-y-1.5">
                <Label>企业超级管理员邮箱</Label>
                <Input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>管理员姓名</Label>
                <Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="可选" />
              </div>
              <Button className="md:col-span-2 w-fit gap-2 bg-blue-600 hover:bg-blue-700" type="submit">
                <Plus className="h-4 w-4" />
                创建企业
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersRound className="h-4 w-4 text-blue-600" />
            企业用户管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-slate-500">
            当前企业：{tenants.find((tenant) => tenant.id === currentTenantId)?.name ?? "未选择企业"}
          </div>

          {availableRoles.length > 0 && (
            <form className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]" onSubmit={createUser}>
              <Input type="email" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} placeholder="用户邮箱" required />
              <Input value={userName} onChange={(event) => setUserName(event.target.value)} placeholder="姓名" required />
              <select
                value={effectiveUserRole}
                onChange={(event) => setUserRole(event.target.value as AccountRole)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {availableRoles.map((item) => (
                  <option key={item.role} value={item.role}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700" type="submit">
                <Plus className="h-4 w-4" />
                新增用户
              </Button>
            </form>
          )}

          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{user.name}</p>
                    <Badge variant="secondary" className="border-0 bg-slate-100 text-slate-600">
                      {AccountRoleLabel[user.role]}
                    </Badge>
                    {user.password_reset_required && (
                      <Badge variant="secondary" className="border-0 bg-amber-50 text-amber-700">
                        待改密码
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{user.email}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => resetPassword(user)}>
                  <KeyRound className="h-3.5 w-3.5" />
                  重置密码
                </Button>
              </div>
            ))}
            {!isLoading && users.length === 0 && (
              <p className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">暂无用户。</p>
            )}
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={loadUsers}>
              <RefreshCcw className="h-3.5 w-3.5" />
              刷新用户列表
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
