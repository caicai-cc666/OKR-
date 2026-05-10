import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const { Client } = pg;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function temporaryPassword() {
  return randomBytes(12).toString("base64url");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

async function ensureUser(client, email, roleLabel) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await client.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows[0]) {
    return { id: existing.rows[0].id, email: normalizedEmail, password: null, existed: true };
  }

  const password = temporaryPassword();
  const inserted = await client.query(
    `
      INSERT INTO users (email, password_hash, name, password_reset_required)
      VALUES ($1, $2, $3, true)
      RETURNING id
    `,
    [normalizedEmail, hashPassword(password), roleLabel],
  );

  return { id: inserted.rows[0].id, email: normalizedEmail, password, existed: false };
}

async function ensureMembership(client, userId, tenantId, role) {
  const existing = tenantId
    ? await client.query(
        "SELECT id FROM memberships WHERE user_id = $1 AND tenant_id = $2 AND role = $3",
        [userId, tenantId, role],
      )
    : await client.query(
        "SELECT id FROM memberships WHERE user_id = $1 AND tenant_id IS NULL AND role = $2",
        [userId, role],
      );

  if (existing.rows[0]) return;

  await client.query(
    "INSERT INTO memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)",
    [userId, tenantId, role],
  );
}

loadEnvFile(resolve(process.cwd(), ".env.production"));

const requiredEnv = [
  "DATABASE_URL",
  "PLATFORM_OWNER_EMAIL",
  "FIRST_TENANT_NAME",
  "FIRST_TENANT_SLUG",
  "FIRST_TENANT_ADMIN_EMAIL",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

try {
  await client.query("BEGIN");

  const schema = readFileSync(resolve(process.cwd(), "database/schema.sql"), "utf8");
  await client.query(schema);

  const platformOwner = await ensureUser(
    client,
    process.env.PLATFORM_OWNER_EMAIL,
    "平台超级管理员",
  );
  await ensureMembership(client, platformOwner.id, null, "platform_owner");

  const tenantResult = await client.query(
    `
      INSERT INTO tenants (name, slug)
      VALUES ($1, $2)
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id
    `,
    [process.env.FIRST_TENANT_NAME, process.env.FIRST_TENANT_SLUG],
  );
  const tenantId = tenantResult.rows[0].id;

  await client.query(
    `
      INSERT INTO tenant_configs (tenant_id, config)
      VALUES ($1, '{}'::jsonb)
      ON CONFLICT (tenant_id)
      DO NOTHING
    `,
    [tenantId],
  );

  const tenantOwner = await ensureUser(
    client,
    process.env.FIRST_TENANT_ADMIN_EMAIL,
    "企业超级管理员",
  );
  await ensureMembership(client, tenantOwner.id, tenantId, "tenant_owner");

  await client.query("COMMIT");

  console.log("Production database schema and initial accounts are ready.");
  console.log("");
  console.log("Initial account passwords are shown only when an account is newly created:");
  if (platformOwner.password) {
    console.log(`平台超级管理员 ${platformOwner.email}: ${platformOwner.password}`);
  } else {
    console.log(`平台超级管理员 ${platformOwner.email}: already existed, password unchanged`);
  }

  if (tenantOwner.password) {
    console.log(`企业超级管理员 ${tenantOwner.email}: ${tenantOwner.password}`);
  } else {
    console.log(`企业超级管理员 ${tenantOwner.email}: already existed, password unchanged`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
