import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const target = resolve(process.cwd(), ".env.production");
const force = process.argv.includes("--force");

if (existsSync(target) && !force) {
  console.log(".env.production already exists. Use --force only if you intend to rotate generated secrets.");
  process.exit(0);
}

const postgresPassword = randomBytes(24).toString("base64url");
const sessionSecret = randomBytes(32).toString("base64url");
const encryptionKey = randomBytes(32).toString("base64url");
const databaseUrl = `postgresql://okr_app:${encodeURIComponent(postgresPassword)}@postgres:5432/okr_harness`;

const content = `APP_DOMAIN=ai6c9.cn
APP_ORIGIN=https://ai6c9.cn

POSTGRES_DB=okr_harness
POSTGRES_USER=okr_app
POSTGRES_PASSWORD=${postgresPassword}
DATABASE_URL=${databaseUrl}
DATABASE_SSL=false
DATABASE_POOL_SIZE=10

SESSION_SECRET=${sessionSecret}
ENCRYPTION_KEY=${encryptionKey}

PLATFORM_OWNER_EMAIL=irene.c.tsai@gmail.com
FIRST_TENANT_NAME=润米
FIRST_TENANT_SLUG=runmi
FIRST_TENANT_ADMIN_EMAIL=yhcai@run2me.com
`;

writeFileSync(target, content, { encoding: "utf8", flag: "w" });
console.log("Generated .env.production with production secrets.");
console.log("Keep this file on the server only. Do not commit it or send it in chat.");
