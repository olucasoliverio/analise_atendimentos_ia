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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-surface-900/20 backdrop-blur-sm p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/92 p-8 text-center shadow-2xl shadow-surface-900/10">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentClassName}`} />

        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          <div className={`absolute inset-0 rounded-full bg-gradient-to-br opacity-15 ${accentClassName}`} />
          <div className="absolute inset-2 rounded-full border border-white/80 bg-white/80 shadow-inner" />
          <div className="absolute inset-0 rounded-full border border-white/70 animate-ping" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-900 text-white shadow-lg">
            <Icon className="h-8 w-8" />
          </div>
          <div className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
            <Loader2 className="h-4 w-4 animate-spin text-surface-700" />
          </div>
        </div>

        <h2 className="text-2xl font-display font-bold text-surface-900">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-surface-500">{description}</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-2.5 w-2.5 rounded-full bg-surface-300 animate-bounce"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>

        <p className="mt-5 text-xs font-medium uppercase tracking-[0.24em] text-surface-400">
          Aguarde um instante
        </p>
      </div>
    </div>
  );
};
