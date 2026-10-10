import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import "./globals.css";
import { routing } from "@/i18n/routing";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Nomad · Provider Network",
  description: "Nomad healthcare provider network and member care",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale — see the Next.js i18n guide.
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${archivo.variable} h-full antialiased`}>
      <body className="h-full font-pn text-[13px] text-pn-ink">
        <NextIntlClientProvider>
          {/* Staff chrome lives in (staff)/layout.tsx; the member app in
           * (member)/ has its own phone-first layout. */}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
