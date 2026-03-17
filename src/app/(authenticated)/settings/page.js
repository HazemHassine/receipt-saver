"use client";

import { useAuth } from "@/components/auth-provider";
import { useCurrency, CURRENCIES } from "@/components/currency-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { currency, setCurrency } = useCurrency();

  const initials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  async function handleCurrencyChange(code) {
    await setCurrency(code);
    const label = CURRENCIES.find((c) => c.code === code)?.label || code;
    toast.success(`Currency set to ${label}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your Google account details.</CardDescription>
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
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>Customize how amounts are displayed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Display Currency</p>
            <p className="text-xs text-muted-foreground">
              Controls how monetary amounts are shown across the app. Receipt
              currency detected during extraction is unchanged.
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
        </CardContent>
      </Card>
    </div>
  );
}

