"use client";

import { useEffect, useState } from "react";

type VersionInfo = {
  version: string;
  shortRef: string | null;
  deployRef: string | null;
  sourceEtag: string | null;
  deployedAt: string | null;
  environment: string | null;
};

export function VersionBadge() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/version", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: VersionInfo | null) => {
        if (!cancelled && data) {
          setVersionInfo(data);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!versionInfo) return null;

  const label = `v${versionInfo.version}${versionInfo.shortRef ? ` · ${versionInfo.shortRef}` : ""}`;
  const title = [
    `Version: ${versionInfo.version}`,
    versionInfo.deployRef ? `Commit: ${versionInfo.deployRef}` : null,
    versionInfo.sourceEtag ? `Source ETag: ${versionInfo.sourceEtag}` : null,
    versionInfo.deployedAt ? `Deployed: ${versionInfo.deployedAt}` : null,
    versionInfo.environment ? `Environment: ${versionInfo.environment}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      title={title}
      className="fixed bottom-2 right-3 z-50 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-medium text-slate-400 shadow-sm backdrop-blur transition-colors hover:text-slate-600"
    >
      {label}
    </div>
  );
}
