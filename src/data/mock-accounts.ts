import type { Tenant, TenantMembership, UserAccount } from "@/types";

export const PLATFORM_TENANT_ID = "platform";
export const DEFAULT_TENANT_ID = "tenant-alpha";
export const DEFAULT_USER_ID = "user-a-owner";

export const mockUsers: UserAccount[] = [
  {
    id: "user-platform",
    name: "平台管理员",
    email: "owner@okr-harness.local",
  },
  {
    id: "user-a-owner",
    name: "A 企业负责人",
    email: "owner@alpha.local",
  },
  {
    id: "user-a-admin",
    name: "A 配置管理员",
    email: "admin@alpha.local",
  },
  {
    id: "user-a-member",
    name: "A 普通用户",
    email: "member@alpha.local",
  },
  {
    id: "user-b-owner",
    name: "B 企业负责人",
    email: "owner@beta.local",
  },
  {
    id: "user-b-member",
    name: "B 普通用户",
    email: "member@beta.local",
  },
];

export const mockTenants: Tenant[] = [
  {
    id: DEFAULT_TENANT_ID,
    name: "A 企业",
    status: "active",
    ownerUserId: "user-a-owner",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "tenant-beta",
    name: "B 企业",
    status: "active",
    ownerUserId: "user-b-owner",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export const mockMemberships: TenantMembership[] = [
  {
    id: "membership-platform",
    tenantId: PLATFORM_TENANT_ID,
    userId: "user-platform",
    role: "platform_owner",
    status: "active",
  },
  {
    id: "membership-a-owner",
    tenantId: DEFAULT_TENANT_ID,
    userId: "user-a-owner",
    role: "tenant_owner",
    status: "active",
  },
  {
    id: "membership-a-admin",
    tenantId: DEFAULT_TENANT_ID,
    userId: "user-a-admin",
    role: "tenant_admin",
    status: "active",
  },
  {
    id: "membership-a-member",
    tenantId: DEFAULT_TENANT_ID,
    userId: "user-a-member",
    role: "member",
    status: "active",
  },
  {
    id: "membership-b-owner",
    tenantId: "tenant-beta",
    userId: "user-b-owner",
    role: "tenant_owner",
    status: "active",
  },
  {
    id: "membership-b-member",
    tenantId: "tenant-beta",
    userId: "user-b-member",
    role: "member",
    status: "active",
  },
];
