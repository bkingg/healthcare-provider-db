import { getTranslations } from "next-intl/server";
import { ConfirmSignIn } from "./confirm-sign-in";

/** Where the email link lands. It only shows a button: signing in happens
 * when the member presses it, so an email scanner opening the link can't
 * use up the one-time token (see redeemLoginLinkAction). */
export default async function MemberAuthPage(props: PageProps<"/[locale]/m/auth">) {
  const t = await getTranslations("MemberApp");
  const { token } = await props.searchParams;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
      <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.02em]">{t("confirmTitle")}</h1>
      <ConfirmSignIn token={typeof token === "string" ? token : ""} />
    </main>
  );
}
