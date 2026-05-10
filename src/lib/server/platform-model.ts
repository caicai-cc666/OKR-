import { decryptSecret, encryptSecret } from "@/lib/server/security";
import { query } from "@/lib/server/db";

export interface PlatformModelConfig {
  roleId?: string;
  provider: string;
  modelId: string;
  apiBaseUrl?: string;
  apiKey: string;
  connectionType?: string;
  temperature?: number;
  topP?: number;
  customHeaders?: string;
  customParams?: string;
}

interface PlatformModelRow {
  id: string;
  provider: string;
  model_id: string;
  api_base_url: string | null;
  connection_type: string;
  encrypted_api_key: string;
  settings: Record<string, unknown>;
}

export async function ensurePlatformModelTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS platform_model_credentials (
      id TEXT PRIMARY KEY DEFAULT 'default',
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      api_base_url TEXT,
      connection_type TEXT NOT NULL DEFAULT 'official',
      encrypted_api_key TEXT NOT NULL,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function rowToPlatformModelConfig(row: PlatformModelRow): PlatformModelConfig {
  return {
    roleId: row.id,
    provider: row.provider,
    modelId: row.model_id,
    apiBaseUrl: row.api_base_url ?? undefined,
    apiKey: decryptSecret(row.encrypted_api_key),
    connectionType: row.connection_type,
    temperature: typeof row.settings.temperature === "number" ? row.settings.temperature : undefined,
    topP: typeof row.settings.topP === "number" ? row.settings.topP : undefined,
    customHeaders: typeof row.settings.customHeaders === "string" ? row.settings.customHeaders : undefined,
    customParams: typeof row.settings.customParams === "string" ? row.settings.customParams : undefined,
  };
}

export async function getPlatformModelConfigs(): Promise<PlatformModelConfig[]> {
  await ensurePlatformModelTable();
  const result = await query<PlatformModelRow>(`
    SELECT id, provider, model_id, api_base_url, connection_type, encrypted_api_key, settings
    FROM platform_model_credentials
    ORDER BY id
  `);
  return result.rows.map(rowToPlatformModelConfig);
}

export async function getPlatformModelConfig(roleId?: string): Promise<PlatformModelConfig | null> {
  await ensurePlatformModelTable();
  const result = await query<PlatformModelRow>(
    `
      SELECT id, provider, model_id, api_base_url, connection_type, encrypted_api_key, settings
      FROM platform_model_credentials
      WHERE id = $1 OR id = 'default'
      ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [roleId || "default"],
  );
  const row = result.rows[0];
  if (!row) return null;

  return rowToPlatformModelConfig(row);
}

export async function savePlatformModelConfig(
  input: PlatformModelConfig,
  userId: string,
): Promise<void> {
  await ensurePlatformModelTable();
  const settings = {
    temperature: input.temperature,
    topP: input.topP,
    customHeaders: input.customHeaders,
    customParams: input.customParams,
  };

  await query(
    `
      INSERT INTO platform_model_credentials (
        id, provider, model_id, api_base_url, connection_type, encrypted_api_key, settings, updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      ON CONFLICT (id)
      DO UPDATE SET
        provider = EXCLUDED.provider,
        model_id = EXCLUDED.model_id,
        api_base_url = EXCLUDED.api_base_url,
        connection_type = EXCLUDED.connection_type,
        encrypted_api_key = EXCLUDED.encrypted_api_key,
        settings = EXCLUDED.settings,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now()
    `,
    [
      input.roleId || "default",
      input.provider,
      input.modelId,
      input.apiBaseUrl || null,
      input.connectionType || "official",
      encryptSecret(input.apiKey),
      JSON.stringify(settings),
      userId,
    ],
  );
}

export async function deletePlatformModelConfig(roleId: string): Promise<void> {
  await ensurePlatformModelTable();
  await query(
    `
      DELETE FROM platform_model_credentials
      WHERE id = $1
    `,
    [roleId],
  );
}
