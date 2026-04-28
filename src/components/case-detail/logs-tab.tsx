import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CaseLogEntry } from "@/types";
import { Clock } from "lucide-react";

export function LogsTab({ logs }: { logs: CaseLogEntry[] }) {
  const sorted = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">操作日志</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">暂无日志</p>
        ) : (
          <div className="relative pl-6">
            {/* Timeline line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-slate-200" />

            <div className="space-y-4">
              {sorted.map((log) => (
                <div key={log.id} className="relative flex items-start gap-3">
                  {/* Dot */}
                  <div className="absolute -left-6 mt-1.5 w-[7px] h-[7px] rounded-full bg-blue-500 ring-2 ring-white" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium text-slate-800">
                        {log.action}
                      </p>
                      <span className="text-xs text-slate-400">
                        {log.actor}
                      </span>
                    </div>
                    {log.detail && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {log.detail}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
