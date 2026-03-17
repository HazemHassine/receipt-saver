"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { useCurrency, CURRENCIES } from "@/components/currency-provider";
import { useBudget } from "@/components/budget-provider";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Globe, MessageCircle, Link2, Unlink, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const {
    budgetingEnabled,
    budgetingAlerts,
    setBudgetingEnabled,
    setBudgetingAlerts,
  } = useBudget();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tLang = useTranslations("languages");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const authFetch = useAuthFetch();

  // WhatsApp state
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [linkedPhone, setLinkedPhone] = useState(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappChecking, setWhatsappChecking] = useState(true);

  const fetchLinkedPhone = useCallback(async () => {
    try {
      setWhatsappChecking(true);
      const res = await authFetch("/api/whatsapp/link");
      if (res.ok) {
        const data = await res.json();
        setLinkedPhone(data.phone);
      }
    } catch {
      // ignore
    } finally {
      setWhatsappChecking(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) fetchLinkedPhone();
  }, [user, fetchLinkedPhone]);

  const initials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  async function handleCurrencyChange(code) {
    await setCurrency(code);
    const label = CURRENCIES.find((c) => c.code === code)?.label || code;
    toast.success(t("currencySet", { label }));
  }

  function handleLanguageChange(newLocale) {
    router.replace(pathname, { locale: newLocale });
  }

  async function handleLinkWhatsApp() {
    const phone = whatsappPhone.trim();
    if (!/^\+\d{7,15}$/.test(phone)) {
      toast.error(t("whatsappInvalidPhone"));
      return;
    }
    setWhatsappLoading(true);
    try {
      const res = await authFetch("/api/whatsapp/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setLinkedPhone(phone);
        setWhatsappPhone("");
        toast.success(t("whatsappLinked"));
      } else {
        const data = await res.json();
        toast.error(data.error || t("whatsappLinkFailed"));
      }
    } catch {
      toast.error(t("whatsappLinkFailed"));
    } finally {
      setWhatsappLoading(false);
    }
  }

  async function handleUnlinkWhatsApp() {
    setWhatsappLoading(true);
    try {
      const res = await authFetch("/api/whatsapp/link", { method: "DELETE" });
      if (res.ok) {
        setLinkedPhone(null);
        toast.success(t("whatsappUnlinked"));
      } else {
        toast.error(t("whatsappUnlinkFailed"));
      }
    } catch {
      toast.error(t("whatsappUnlinkFailed"));
    } finally {
      setWhatsappLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{t("account")}</CardTitle>
          <CardDescription>{t("accountDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user?.photoURL} alt={user?.displayName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user?.displayName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Separator />

          <Button
            variant="outline"
            className="gap-2 text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {tc("signOut")}
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{t("preferences")}</CardTitle>
          <CardDescription>{t("preferencesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("displayCurrency")}</p>
            <p className="text-xs text-muted-foreground">
              {t("currencyHint")}
            </p>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground w-8 shrink-0">{c.symbol}</span>
                      <span>{c.code}</span>
                      <span className="text-muted-foreground">— {c.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("languageLabel")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("languageHint")}
            </p>
            <Select value={locale} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {routing.locales.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {tLang(loc)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{t("budgeting")}</CardTitle>
          <CardDescription>
            {t("budgetingDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="budgeting-toggle" className="text-sm font-medium">
                {t("enableBudgeting")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("enableBudgetingHint")}
              </p>
            </div>
            <Switch
              id="budgeting-toggle"
              checked={budgetingEnabled}
              onCheckedChange={async (checked) => {
                await setBudgetingEnabled(checked);
                toast.success(checked ? t("budgetingEnabled") : t("budgetingDisabled"));
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor="alerts-toggle"
                className={`text-sm font-medium ${!budgetingEnabled ? "text-muted-foreground" : ""}`}
              >
                {t("budgetAlerts")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("budgetAlertsHint")}
              </p>
            </div>
            <Switch
              id="alerts-toggle"
              checked={budgetingAlerts}
              disabled={!budgetingEnabled}
              onCheckedChange={async (checked) => {
                await setBudgetingAlerts(checked);
                toast.success(checked ? t("alertsEnabled") : t("alertsDisabled"));
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {t("whatsapp")}
          </CardTitle>
          <CardDescription>{t("whatsappDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {whatsappChecking ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tc("loading")}
            </div>
          ) : linkedPhone ? (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1.5 text-sm py-1 px-3">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  {t("whatsappConnected")}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{linkedPhone}</p>
                  <p className="text-xs text-muted-foreground">{t("whatsappLinkedHint")}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive"
                  onClick={handleUnlinkWhatsApp}
                  disabled={whatsappLoading}
                >
                  {whatsappLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                  {t("whatsappUnlink")}
                </Button>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{t("whatsappHowTo")}</p>
                <p>{t("whatsappHowToDesc")}</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t("whatsappNotLinked")}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="tel"
                  placeholder={t("whatsappPhonePlaceholder")}
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="w-52"
                />
                <Button
                  onClick={handleLinkWhatsApp}
                  disabled={whatsappLoading || !whatsappPhone.trim()}
                  className="gap-1.5"
                  size="sm"
                >
                  {whatsappLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  {t("whatsappLink")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("whatsappPhoneHint")}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

