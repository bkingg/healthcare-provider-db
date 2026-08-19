import "server-only";
import { prisma } from "@/lib/prisma";

/** Every provider in the system, with exactly the relations the "Provider
 * main report" (src/app/api/reports/providers/route.ts) needs — deliberately
 * leaner than getProviderProfile's include (which also pulls credentials,
 * contracts, banking, rates, visits, and notes for a single provider's
 * detail page): fetching all of that for every row of a full-system export
 * would be wasteful. Primary name/address/phone/email each take just the
 * one row the Overview tab itself treats as "the" name/address/phone/email
 * (see profile-body.tsx's mainPhone/mainEmail, getProviderProfile's
 * isPrimary-first ordering for names/addresses). */
export function listProviderReportRows() {
  const today = new Date();
  return prisma.provider.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      names: { orderBy: { isPrimary: "desc" }, take: 1 },
      addresses: { include: { country: true }, orderBy: { isPrimary: "desc" }, take: 1 },
      phones: { take: 1 },
      emails: { take: 1 },
      providerTypes: { include: { providerType: true }, orderBy: { isPrimary: "desc" } },
      specialties: { include: { specialty: true } },
      languages: { include: { language: true } },
      // Postgres enums sort by declaration order, and DayOfWeek is declared
      // Monday-first (see reference.prisma) — same ordering getProviderProfile uses.
      officeHours: { orderBy: [{ dayOfWeek: "asc" }, { openTime: "asc" }] },
      country: { include: { qualityRating: true } },
      // "Currently accepted" — same [effectiveDate, endDate] window
      // search.ts's results-table Network column uses, not every contract
      // ever signed.
      networkContracts: {
        where: { effectiveDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
        include: { network: true },
      },
      // Affiliation has no enforced subject/related direction (see
      // search.ts's own comment on this same pattern) — both sides fetched
      // and joined the same way so a physician's hospital and a hospital's
      // consulting physicians both show up.
      affiliationsAsSubject: { include: { relatedProvider: { include: { names: { where: { isPrimary: true }, take: 1 } } } } },
      affiliationsAsRelated: { include: { provider: { include: { names: { where: { isPrimary: true }, take: 1 } } } } },
    },
  });
}

export type ProviderReportRow = Awaited<ReturnType<typeof listProviderReportRows>>[number];

/** Cheap at-a-glance counts for the Reports & KPIs tab — a plain groupBy,
 * not the full listProviderReportRows() query (which pulls names/addresses/
 * office hours/etc. for every provider just to render a page that mostly
 * exists to offer the download). */
export async function getProviderStatusCounts(): Promise<{ status: string; count: number }[]> {
  const rows = await prisma.provider.groupBy({ by: ["status"], _count: { _all: true } });
  return rows.map((r) => ({ status: r.status, count: r._count._all })).sort((a, b) => b.count - a.count);
}

/** "Validated" = the Validate record button has been pressed at least once
 * (`lastVerifiedAt` set — see providers.ts::verifyProviderRecord). */
export async function getValidationCounts(): Promise<{ validated: number; notValidated: number }> {
  const [validated, notValidated] = await Promise.all([
    prisma.provider.count({ where: { lastVerifiedAt: { not: null } } }),
    prisma.provider.count({ where: { lastVerifiedAt: null } }),
  ]);
  return { validated, notValidated };
}

/** Providers validated per calendar month (UTC) for the last `months` months,
 * oldest first, zero-filled so quiet months still get a bar. Only the latest
 * validation is stored per provider, so a provider re-validated later is
 * counted in its most recent month only. */
export async function getValidatedPerMonth(months = 12): Promise<{ month: string; count: number }[]> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const rows = await prisma.provider.findMany({
    where: { lastVerifiedAt: { gte: start } },
    select: { lastVerifiedAt: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const d = r.lastVerifiedAt!;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { month: key, count: counts.get(key) ?? 0 };
  });
}

/** Every administrative contact in the system with what the "Administrative
 * contacts report" (src/app/api/reports/admin-contacts/route.ts) needs — the
 * owning provider's number and primary name, plus each contact's department
 * and all of its phones/emails (with their types). Ordered by provider
 * number, then by when the contact was added, so a provider's contacts stay
 * together in the sheet. */
export function listAdministrativeContactReportRows() {
  return prisma.administrativeContact.findMany({
    orderBy: [{ provider: { providerNumber: "asc" } }, { createdAt: "asc" }],
    include: {
      department: true,
      phones: { include: { phoneType: true }, orderBy: { createdAt: "asc" } },
      emails: { include: { emailType: true }, orderBy: { createdAt: "asc" } },
      provider: {
        select: {
          providerNumber: true,
          nameKind: true,
          names: { orderBy: { isPrimary: "desc" }, take: 1, select: { fullNameText: true } },
        },
      },
    },
  });
}

export type AdministrativeContactReportRow = Awaited<ReturnType<typeof listAdministrativeContactReportRows>>[number];
