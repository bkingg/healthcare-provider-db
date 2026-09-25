import { AppShell } from "@/components/app-shell";

/** Staff area: header, sidebar and open-record tabs around every staff page
 * (providers, map, members, import, admin…). Route groups don't change URLs,
 * so these pages keep their paths. */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
