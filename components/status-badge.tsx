interface StatusBadgeProps {
  status: "CLEAN" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "COMMITTED" | "ERROR" | "WARNING" | "INFO";
  size?: "sm" | "md";
}

const statusStyles: Record<StatusBadgeProps["status"], string> = {
  CLEAN: "bg-sage-100 text-sage-700 border-sage-200",
  NEEDS_REVIEW: "bg-amber-soft text-amber-ink border-amber-line",
  APPROVED: "bg-sage-100 text-sage-700 border-sage-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  COMMITTED: "bg-indigo-soft text-indigo-action border-indigo-action/20",
  ERROR: "bg-red-50 text-red-700 border-red-200",
  WARNING: "bg-amber-soft text-amber-ink border-amber-line",
  INFO: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabels: Record<StatusBadgeProps["status"], string> = {
  CLEAN: "Clean",
  NEEDS_REVIEW: "Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMMITTED: "Committed",
  ERROR: "Error",
  WARNING: "Warning",
  INFO: "Info",
};

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${statusStyles[status]} ${sizeClass}`}
    >
      {statusLabels[status]}
    </span>
  );
}
