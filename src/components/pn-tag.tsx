const KIND_CLASS: Record<"active" | "pending" | "exception" | "danger" | "inactive", string> = {
  active: "bg-pn-ink text-white",
  pending: "bg-pn-accent-soft text-[#08432c]",
  exception: "bg-pn-accent text-white",
  // Reserved for DO_NOT_USE — a provider that must not be used gets an
  // unmistakable red, not the green shared by every other exception.
  danger: "bg-[#dc2626] text-white",
  inactive: "border-2 border-pn-border-muted text-pn-gray-2",
};

const STATUS_TO_KIND: Record<string, keyof typeof KIND_CLASS> = {
  ACTIVE: "active",
  OPERATING: "active",
  APPROVED: "active",
  CONFIRMED: "active",
  RESOLVED: "active",
  RECONCILED: "active",
  COMMITTED: "active",

  PENDING_REVIEW: "pending",
  PENDING: "pending",
  PENDING_APPROVAL: "pending",
  DRAFT: "pending",
  UNCONFIRMED: "pending",
  UNKNOWN: "pending",
  OPEN: "pending",
  ASSIGNED: "pending",
  IN_REVIEW: "pending",
  VALIDATING: "pending",
  STAGED: "pending",
  VALIDATED: "pending",
  PARTIALLY_APPROVED: "pending",
  UPLOADED: "pending",

  SUSPENDED: "exception",
  REJECTED: "exception",
  TERMINATED: "exception",
  EXPIRED: "exception",
  CLOSED: "exception",
  DO_NOT_USE: "danger",
  MISSING: "exception",
  TEMPORARILY_CLOSED: "exception",
  PERMANENTLY_CLOSED: "exception",
  FAILED: "exception",
  CRITICAL: "exception",
  ERROR: "exception",
  HIGH: "exception",

  INACTIVE: "inactive",
  DISMISSED: "inactive",
  INFO: "inactive",
  WARNING: "inactive",
  MEDIUM: "pending",
  LOW: "inactive",
};

/** Mockup's `tag(kind)` helper — 5 fixed visual kinds every status-shaped
 * value (ProviderStatus, DqStatus, severity labels, ...) maps onto. */
export function PnTag({ status, className = "" }: { status: string; className?: string }) {
  const kind = STATUS_TO_KIND[status] ?? "inactive";
  return (
    <span className={`inline-block px-[7px] py-[1px] text-[10.5px] font-bold tracking-[0.03em] uppercase ${KIND_CLASS[kind]} ${className}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
