import { Badge } from "@/components/ui/badge";

const VARIANT_BY_STATUS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  OPERATING: "default",
  APPROVED: "default",
  CONFIRMED: "default",
  RESOLVED: "default",
  RECONCILED: "default",
  COMMITTED: "default",

  PENDING_REVIEW: "secondary",
  PENDING: "secondary",
  PENDING_APPROVAL: "secondary",
  DRAFT: "secondary",
  UNCONFIRMED: "secondary",
  DEFAULT: "secondary",
  UNKNOWN: "secondary",
  OPEN: "secondary",
  ASSIGNED: "secondary",
  IN_REVIEW: "secondary",
  UPLOADED: "secondary",
  VALIDATING: "secondary",
  STAGED: "secondary",
  VALIDATED: "secondary",
  PARTIALLY_APPROVED: "secondary",

  SUSPENDED: "destructive",
  REJECTED: "destructive",
  TERMINATED: "destructive",
  EXPIRED: "destructive",
  CLOSED: "destructive",
  DO_NOT_USE: "destructive",
  MISSING: "destructive",
  TEMPORARILY_CLOSED: "destructive",
  PERMANENTLY_CLOSED: "destructive",
  FAILED: "destructive",
  CRITICAL: "destructive",
  ERROR: "destructive",

  INACTIVE: "outline",
  DISMISSED: "outline",
  INFO: "outline",
  WARNING: "outline",
};

/** Maps any of the status-shaped enums (ProviderStatus, ContractStatus,
 * ApprovalStatus, DqStatus, CoordinateStatus, OperatingStatus, ...) to a
 * consistent badge color, since they all share the same handful of
 * "good / pending / bad / neutral" meanings. */
export function StatusBadge({ status }: { status: string }) {
  const variant = VARIANT_BY_STATUS[status] ?? "outline";
  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}
