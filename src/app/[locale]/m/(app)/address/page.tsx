import { getTranslations } from "next-intl/server";
import { getCurrentMember } from "@/lib/memberAuth";
import { getPrimaryAddress } from "@/data/memberAddresses";
import { EmergencyPanel } from "../../_components/emergency-panel";
import { MemberSidebar } from "../../_components/member-sidebar";
import { MAIN_PANE, PANES } from "../../_components/panes";
import { removePrimaryAddressAction } from "../../actions";
import { PrimaryAddressForm } from "./address-form";
import { memberFeatures } from "@/data/memberAppFeatures";

/** The member's primary address: offered first when they order or ask for
 * help. Right after quick start (?welcome=1) it can be skipped. */
export default async function PrimaryAddressPage(props: PageProps<"/[locale]/m/address">) {
  const t = await getTranslations("MemberAddress");
  const member = (await getCurrentMember())!;
  const primary = await getPrimaryAddress(member.id);
  const welcome = (await props.searchParams).welcome === "1";

  return (
    <main className="flex flex-col">
      <EmergencyPanel countryId={member.countryId} compact />
      <div className={PANES}>
        <MemberSidebar member={member} active={{ kind: "address" }} className="hidden lg:flex" />
        <div className={`flex flex-col gap-3 px-4 py-6 ${MAIN_PANE}`}>
          <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.02em]">{welcome ? t("welcomeTitle") : t("title")}</h1>
          <p className="m-0 text-[15px] text-pn-gray-1">{t((await memberFeatures(member)).REQUEST_HELP ? "intro" : "introOrdersOnly")}</p>
          <PrimaryAddressForm
            welcome={welcome}
            initial={{
              addressText: primary?.addressText ?? "",
              directions: primary?.directions ?? "",
              coords: primary && primary.latitude !== null && primary.longitude !== null ? { lat: primary.latitude, lng: primary.longitude } : null,
            }}
          />
          {primary && !welcome && (
            <form action={removePrimaryAddressAction} className="border-t border-pn-rule pt-3">
              <button type="submit" className="cursor-pointer text-[14px] font-semibold text-[#991b1b] underline">
                {t("remove")}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
