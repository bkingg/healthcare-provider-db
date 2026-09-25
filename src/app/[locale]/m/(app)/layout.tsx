import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentMember } from "@/lib/memberAuth";

/** Every member-app page in this group needs a signed-in member. */
export default async function MemberAppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentMember())) redirect({ href: "/m/login", locale: await getLocale() });
  return <>{children}</>;
}
