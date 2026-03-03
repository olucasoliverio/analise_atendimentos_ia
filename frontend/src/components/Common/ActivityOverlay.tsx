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
  accentClassName = 'from-brand-500 via-violet-500 to-fuchsia-500'
}: ActivityOverlayProps) => {
  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] animate-fade-in">
      <div className="mx-auto w-full max-w-4xl px-4 pt-6">
        <div className="card-glass overflow-hidden border-white/40 shadow-2xl animate-slide-up">
          {/* Top accent line with animated gradient */}
          <div className={`h-1 w-full bg-gradient-to-r ${accentClassName} opacity-80 animate-pulse`} />

          <div className="flex items-center gap-4 px-5 py-4">
            {/* Icon Container with Glass Effect */}
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${accentClassName} ring-4 ring-white/20`}>
              <Icon className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-base font-bold tracking-tight text-surface-900 sm:text-lg">
                  {title}
                </h2>
                <div className="flex items-center gap-1.5 rounded-full bg-brand-50/50 px-2 py-0.5 border border-brand-100/50">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    Processando
                  </span>
                </div>
              </div>
              <p className="mt-0.5 truncate text-sm text-surface-500">
                {description}
              </p>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">
                Ativo
              </span>
            </div>
          </div>

          {/* Progress Bar Area */}
          <div className="px-5 pb-5">
            <div className="h-2 overflow-hidden rounded-full bg-surface-100/50 ring-1 ring-inset ring-black/5">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${accentClassName} shadow-sm transition-all duration-1000 ease-in-out`}
                style={{ width: '45%', animation: 'shimmer 2s infinite linear' }}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};
