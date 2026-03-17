import { Roboto, Roboto_Mono } from "next/font/google";
import "../globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const messages = (await import(`@/messages/${locale}.json`)).default;
  return {
    title: messages.metadata?.title || "Receipts — Expense Tracker",
    description: messages.metadata?.description || "Track and organize your receipts with AI-powered extraction.",
  };
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  // RTL for Arabic
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${roboto.className} ${robotoMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
            <Toaster position={locale === "ar" ? "bottom-left" : "bottom-right"} />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
