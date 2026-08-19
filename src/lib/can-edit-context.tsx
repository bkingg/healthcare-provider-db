"use client";

import { createContext, useContext } from "react";

/** Whether the current actor's role has canEditProviderData — read by the
 * provider profile's section components to hide Add/Edit/Delete controls
 * for a view-only role (Case Manager) instead of showing a button that
 * would just fail server-side. Set once at the top of ProfileBody rather
 * than threaded as a prop through every section, since it's the same value
 * for the whole page and most sections already have a long prop list.
 *
 * This is a UI convenience only — requireEditProviderData in every
 * providers/actions.ts mutation is the actual security boundary regardless
 * of what this hides or shows. */
const CanEditContext = createContext(true);

export function CanEditProvider({ canEdit, children }: { canEdit: boolean; children: React.ReactNode }) {
  return <CanEditContext value={canEdit}>{children}</CanEditContext>;
}

export function useCanEdit(): boolean {
  return useContext(CanEditContext);
}
