import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

function shortRef(value?: string | null) {
  if (!value) return null;
  const normalized = value.replace(/^"|"$/g, "");
  if (/^[0-9a-f]{40}$/i.test(normalized)) return normalized.slice(0, 7);
  return normalized.slice(0, 12);
}

export function GET() {
  const deployRef = process.env.OKR_DEPLOY_REF || null;
  const sourceEtag = process.env.OKR_SOURCE_ETAG || null;
  const deployedAt = process.env.OKR_DEPLOYED_AT || null;

  return NextResponse.json(
    {
      app: "okr-harness",
      version: packageJson.version,
      deployRef,
      shortRef: shortRef(deployRef) ?? shortRef(sourceEtag),
      sourceEtag,
      deployedAt,
      environment: process.env.NODE_ENV ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
