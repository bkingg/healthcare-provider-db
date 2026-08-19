"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Small reused "delete this row" form for the profile-page section tables —
 * a plain action bound to the row's id, no confirmation dialog (Phase 2 scope;
 * rows are recoverable via AuditLog history, not soft-deleted). */
export function InlineDeleteForm({
  action,
  hiddenFields,
}: {
  action: (formData: FormData) => void;
  hiddenFields: Record<string, string>;
}) {
  return (
    <form action={action}>
      {Object.entries(hiddenFields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Delete">
        <Trash2Icon />
      </Button>
    </form>
  );
}
