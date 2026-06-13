export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-slate-850 text-sm font-bold text-white shadow-sm">
        K
        <span className="absolute -right-2 -top-2 size-5 rounded-full bg-sage-400/70" />
      </span>
      {compact ? null : (
        <span className="text-lg font-semibold tracking-[-0.04em] text-ink">
          KinCtx
        </span>
      )}
    </span>
  );
}
