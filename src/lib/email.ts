import "server-only";

export type OutgoingEmail = { to: string; subject: string; text: string };

/** Which email service sends mail — set EMAIL_PROVIDER once Nomad has one.
 * Until then ("log", the default) nothing is sent: the message is written
 * to the server log, and in development the member app also shows the
 * sign-in link on screen so the flow can be tested end to end. */
export function emailProvider(): string {
  return process.env.EMAIL_PROVIDER?.trim() || "log";
}

/** True when sign-in links should be shown on screen: no email service yet,
 * and not a production build. Never true in production. */
export function showDevEmailLinks(): boolean {
  return emailProvider() === "log" && process.env.NODE_ENV !== "production";
}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const provider = emailProvider();
  if (provider === "log") {
    console.info(`[email:log] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }
  // Adapters for a real service (Resend, Postmark, SES, SMTP) go here once
  // one is chosen; failing loudly beats silently not sending sign-in links.
  throw new Error(`EMAIL_PROVIDER "${provider}" is not set up yet.`);
}
