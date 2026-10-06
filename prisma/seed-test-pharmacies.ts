/**
 * Test pharmacies for medication delivery (step 1).
 *
 *   npm run db:seed-test-pharmacies             create the missing ones
 *   npm run db:seed-test-pharmacies -- --reset  recreate them (new IDs)
 *   npm run db:seed-test-pharmacies -- --remove remove them
 *
 * Eight made-up pharmacies in and around Dakar, named "[TEST] …" with
 * external IDs TEST-PHARM-01…08, so they're obvious in every list and easy
 * to remove. "Open" is read from the provider record as for any pharmacy:
 * the Open 24/7 box, or else the posted office hours. One is DO NOT USE, to
 * check it's never offered. Phone and mobile-money numbers are fake.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type DayOfWeek } from "../generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const WEEKDAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const MON_SAT: DayOfWeek[] = [...WEEKDAYS, "SATURDAY"];
const ALL_WEEK: DayOfWeek[] = [...MON_SAT, "SUNDAY"];

type Hours = { days: DayOfWeek[]; open: string; close: string }[];
type Def = {
  n: number;
  name: string;
  line1: string;
  city: string;
  lat: number;
  lng: number;
  open247?: boolean;
  hours?: Hours;
  status?: "ACTIVE" | "DO_NOT_USE";
  pay: "ORANGE_MONEY" | "WAVE";
};

const PHARMACIES: Def[] = [
  { n: 1, name: "[TEST] Pharmacie du Plateau", line1: "Avenue Léopold Sédar Senghor", city: "Dakar", lat: 14.6681, lng: -17.4327, open247: true, pay: "ORANGE_MONEY" },
  { n: 2, name: "[TEST] Pharmacie de la Médina", line1: "Rue 6, Médina", city: "Dakar", lat: 14.683, lng: -17.448, pay: "WAVE", hours: [{ days: MON_SAT, open: "08:00", close: "22:00" }, { days: ["SUNDAY"], open: "09:00", close: "13:00" }] },
  { n: 3, name: "[TEST] Pharmacie Point E", line1: "Rue de Fatick, Point E", city: "Dakar", lat: 14.695, lng: -17.463, pay: "ORANGE_MONEY", hours: [{ days: WEEKDAYS, open: "08:30", close: "20:00" }, { days: ["SATURDAY"], open: "09:00", close: "14:00" }] },
  { n: 4, name: "[TEST] Pharmacie Mermoz", line1: "Route de la Corniche Ouest, Mermoz", city: "Dakar", lat: 14.71, lng: -17.474, open247: true, pay: "WAVE" },
  { n: 5, name: "[TEST] Pharmacie Sacré-Cœur", line1: "Sacré-Cœur 3", city: "Dakar", lat: 14.723, lng: -17.466, pay: "ORANGE_MONEY", hours: [{ days: MON_SAT, open: "08:00", close: "23:00" }] },
  { n: 6, name: "[TEST] Pharmacie de Ouakam", line1: "Route de Ouakam", city: "Dakar", lat: 14.724, lng: -17.493, pay: "WAVE", hours: [{ days: ALL_WEEK, open: "08:00", close: "21:00" }] },
  { n: 7, name: "[TEST] Pharmacie des Parcelles", line1: "Unité 15, Parcelles Assainies", city: "Dakar", lat: 14.766, lng: -17.44, pay: "ORANGE_MONEY", status: "DO_NOT_USE", hours: [{ days: MON_SAT, open: "08:00", close: "20:00" }] },
  { n: 8, name: "[TEST] Pharmacie de Rufisque", line1: "Centre-ville", city: "Rufisque", lat: 14.716, lng: -17.273, pay: "WAVE", hours: [{ days: MON_SAT, open: "08:00", close: "20:00" }] },
];

const externalId = (n: number) => `TEST-PHARM-${String(n).padStart(2, "0")}`;
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

async function main() {
  if (process.argv.includes("--remove")) {
    const { count } = await prisma.provider.deleteMany({ where: { externalId: { startsWith: "TEST-PHARM-" } } });
    console.log(`Removed ${count} test pharmacies.`);
    return;
  }
  const [senegal, facility, pharmacy, physical, mainPhone, system, ...payTypes] = await Promise.all([
    prisma.countryRef.findFirstOrThrow({ where: { iso2: "SN" } }),
    prisma.providerTypeRef.findUniqueOrThrow({ where: { code: "FACILITY" } }),
    prisma.capability.findUniqueOrThrow({ where: { code: "PHARMACY" } }),
    prisma.addressTypeRef.findUniqueOrThrow({ where: { code: "PHYSICAL" } }),
    prisma.phoneTypeRef.findUniqueOrThrow({ where: { code: "MAIN" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "system@seed.local" } }),
    prisma.paymentTypeRef.findUniqueOrThrow({ where: { code: "ORANGE_MONEY" } }),
    prisma.paymentTypeRef.findUniqueOrThrow({ where: { code: "WAVE" } }),
  ]);
  const payType = { ORANGE_MONEY: payTypes[0], WAVE: payTypes[1] };

  for (const d of PHARMACIES) {
    const ext = externalId(d.n);
    // Kept as they are on a re-run (so their IDs stay the same); --reset
    // recreates them, discarding edits made while testing.
    const existing = await prisma.provider.findFirst({ where: { externalId: ext }, select: { providerNumber: true } });
    if (existing && !process.argv.includes("--reset")) {
      console.log(`${ext}  NMD-${String(existing.providerNumber).padStart(6, "0")}  ${d.name}  (already there)`);
      continue;
    }
    if (existing) await prisma.provider.deleteMany({ where: { externalId: ext } });
    const p = await prisma.provider.create({
      data: {
        externalId: ext,
        countryId: senegal.id,
        status: d.status ?? "ACTIVE",
        operatingStatus: "OPERATING",
        isOpen24_7: d.open247 ?? false,
        createdBy: system.id,
        updatedById: system.id,
        providerTypes: { create: { providerTypeId: facility.id, isPrimary: true } },
        names: { create: { nameType: "LEGAL", facilityName: d.name, fullNameText: d.name, isPrimary: true } },
        addresses: {
          create: { addressTypeId: physical.id, line1: d.line1, city: d.city, countryId: senegal.id, latitude: d.lat, longitude: d.lng, coordinateStatus: "CONFIRMED", isPrimary: true },
        },
        phones: { create: { phoneTypeId: mainPhone.id, number: `+221 33 800 00 ${String(d.n).padStart(2, "0")}` } },
        capabilities: { create: { capabilityId: pharmacy.id } },
        officeHours: { create: (d.hours ?? []).flatMap((h) => h.days.map((day) => ({ dayOfWeek: day, openTime: time(h.open), closeTime: time(h.close), createdBy: system.id }))) },
        bankingPayments: {
          create: {
            payeeName: d.name.replace("[TEST] ", ""),
            currency: "XOF",
            paymentTypeId: payType[d.pay].id,
            mobileMoneyNumber: `+221 77 800 00 ${String(d.n).padStart(2, "0")}`,
            approvalStatus: "APPROVED",
            approvedById: system.id,
            approvedAt: new Date(),
            createdBy: system.id,
          },
        },
      },
    });
    console.log(`${ext}  NMD-${String(p.providerNumber).padStart(6, "0")}  ${d.name}${d.open247 ? "  (24/7)" : ""}${d.status === "DO_NOT_USE" ? "  (DO NOT USE)" : ""}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
