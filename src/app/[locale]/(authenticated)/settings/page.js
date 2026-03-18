"use client";

import { useAuth } from "@/components/auth-provider";
import { useCurrency, CURRENCIES } from "@/components/currency-provider";
import { useBudget } from "@/components/budget-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Globe } from "lucide-react";
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
    </div>
  );
}

