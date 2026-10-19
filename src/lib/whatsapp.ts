import "server-only";

/** Sends member sign-in codes over WhatsApp (Meta's WhatsApp Business Cloud
 * API, an "authentication" template with a copy-code button). Set
 * WHATSAPP_PROVIDER=meta once Nomad's WhatsApp Business account is
 * approved, with:
 *   WHATSAPP_TOKEN            permanent access token (System User)
 *   WHATSAPP_PHONE_NUMBER_ID  the business number's ID in Meta
 *   WHATSAPP_CODE_TEMPLATE    approved template name, e.g. "nomad_code"
 *   WHATSAPP_API_VERSION      Graph API version, e.g. "v23.0"
 * Until then ("log", the default) nothing is sent: the code is written to
 * the server log, and in development the sign-in screen shows it so the
 * flow can be tested end to end. Template language codes: "fr" and "en"
 * (create the template in both). */

export function whatsappProvider(): string {
  return process.env.WHATSAPP_PROVIDER?.trim() || "log";
}

/** True when codes should be shown on screen: no WhatsApp account yet, and
 * not a production build. Never true in production. */
export function showDevCodes(): boolean {
  return whatsappProvider() === "log" && process.env.NODE_ENV !== "production";
}

export class WhatsAppSendError extends Error {}

/** `to` in E.164 ("+221771234567"). */
export async function sendWhatsAppCode(to: string, code: string, language: "fr" | "en"): Promise<void> {
  const provider = whatsappProvider();
  if (provider === "log") {
    console.info(`[whatsapp:log] code for ${to}: ${code}`);
    return;
  }
  if (provider !== "meta") throw new WhatsAppSendError(`WHATSAPP_PROVIDER "${provider}" is not set up.`);

  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneId, WHATSAPP_CODE_TEMPLATE: template } = process.env;
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v23.0";
  if (!token || !phoneId || !template) throw new WhatsAppSendError("WhatsApp is missing WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_CODE_TEMPLATE.");

  // Meta's documented shape for authentication templates: the code goes in
  // the body and in the copy-code button.
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template,
        language: { code: language },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new WhatsAppSendError(`WhatsApp send failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}
