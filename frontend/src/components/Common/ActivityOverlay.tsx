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
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[120] flex justify-center px-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-surface-200/80 bg-white/95 shadow-xl shadow-surface-900/10 backdrop-blur-sm">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentClassName}`} />

        <div className="flex items-start gap-4 p-4 pr-5">
          <div className={`relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ${accentClassName}`}>
            <Icon className="h-5 w-5" />
            <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white text-surface-700 shadow-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-surface-900">{title}</h2>
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-surface-500">{description}</p>

            <div className="mt-3 flex items-center gap-1.5">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 rounded-full bg-surface-300 animate-pulse"
                  style={{ animationDelay: `${index * 160}ms` }}
                />
              ))}
              <span className="ml-1 text-[11px] font-medium uppercase tracking-[0.18em] text-surface-400">
                Processando
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
