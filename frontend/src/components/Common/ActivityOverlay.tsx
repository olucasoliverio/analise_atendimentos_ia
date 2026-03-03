import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface ActivityOverlayProps {
  open: boolean;
  title: string;
  description: string;
  icon: LucideIcon;
  accentClassName?: string;
}

export const ActivityOverlay = ({
  open,
  title,
  description,
  icon: Icon,
  accentClassName = 'from-brand-500 via-brand-400 to-brand-600'
}: ActivityOverlayProps) => {
  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120]">
      <div className="mx-auto w-full max-w-5xl px-4 pt-4">
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/88 shadow-glass backdrop-blur-md">
          <div className={`h-1.5 w-full bg-gradient-to-r ${accentClassName} opacity-90`} />

          <div className="flex items-center gap-3 px-4 py-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft ${accentClassName}`}>
              <Icon className="h-4.5 w-4.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-surface-900">{title}</h2>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-surface-400" />
              </div>
              <p className="truncate text-xs text-surface-500">{description}</p>
            </div>

            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">
                Em andamento
              </span>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="h-2 overflow-hidden rounded-full bg-surface-100 ring-1 ring-inset ring-white/80">
              <div className={`h-full w-1/3 rounded-full bg-gradient-to-r ${accentClassName} animate-pulse`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
