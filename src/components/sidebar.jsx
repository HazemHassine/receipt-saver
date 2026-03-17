"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Upload,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
  Coins,
  Infinity,
  FileText,
  PiggyBank,
  Bot,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useBudget } from "@/components/budget-provider";

export function Sidebar() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const authFetch = useAuthFetch();
  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const { budgetingEnabled } = useBudget();

  const baseNavItems = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/upload", label: t("upload"), icon: Upload },
    { href: "/receipts", label: t("receipts"), icon: Receipt },
    { href: "/reports", label: t("reports"), icon: FileText },
  ];

  const navItems = [
    ...baseNavItems,
    ...(budgetingEnabled ? [{ href: "/budget", label: t("budget"), icon: PiggyBank }] : []),
    { href: "/advisor", label: t("advisor"), icon: Bot },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  useEffect(() => {
    async function loadCredits() {
      try {
        const res = await authFetch("/api/user");
        if (res.ok) {
          const data = await res.json();
          setCredits(data.user.credits);
          setUnlimited(data.user.unlimited);
        }
      } catch {
        // ignore
      }
    }
    loadCredits();
  }, [authFetch, pathname]);

  const initials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  /* ─── Mobile nav (always expanded) ─── */
  const mobileNavContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5">
        <Receipt className="h-6 w-6" />
        <span className="text-lg font-semibold tracking-tight">{tc("receipts")}</span>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.photoURL} alt={user?.displayName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium truncate">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        {credits !== null && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{tc("credits")}:</span>
            {unlimited ? (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1">
                <Infinity className="h-3 w-3" />
                {tc("unlimited")}
              </Badge>
            ) : (
              <Badge
                variant={credits < 10 ? "destructive" : "secondary"}
                className="text-xs px-1.5 py-0"
              >
                {credits}
              </Badge>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {tc("signOut")}
        </Button>
      </div>
    </div>
  );

  const desktopNavContent = (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-background">
        {/* Logo row */}
        <div className="flex items-center h-[68px] px-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <Receipt className="h-6 w-6 shrink-0" />
            <span
              className={cn(
                "text-lg font-semibold tracking-tight whitespace-nowrap transition-all duration-200 overflow-hidden",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}
            >
              {tc("receipts")}
            </span>
          </Link>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            const linkEl = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg font-medium transition-colors h-10",
                  collapsed ? "justify-center w-10 mx-auto" : "gap-3 px-3 text-sm",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 overflow-hidden",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    render={
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center justify-center rounded-lg font-medium transition-colors h-10 w-10 mx-auto",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      />
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkEl}</div>;
          })}
        </nav>

        <Separator />

        {/* User section */}
        <div className={cn("px-2 py-3", collapsed ? "space-y-2" : "space-y-3")}>
          {/* User info */}
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger render={<div className="cursor-default" />}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL} alt={user?.displayName} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{user?.displayName}</p>
                  <p className="text-xs opacity-70">{user?.email}</p>
                  {credits !== null && (
                    <p className="text-xs opacity-70 mt-0.5">
                      {unlimited ? tc("unlimited") : `${credits} ${tc("credits")}`}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-1">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.photoURL} alt={user?.displayName} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.displayName}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Credits row (expanded only) */}
          {!collapsed && credits !== null && (
            <div className="flex items-center gap-2 px-1">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{tc("credits")}:</span>
              {unlimited ? (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1">
                  <Infinity className="h-3 w-3" />
                  {tc("unlimited")}
                </Badge>
              ) : (
                <Badge
                  variant={credits < 10 ? "destructive" : "secondary"}
                  className="text-xs px-1.5 py-0"
                >
                  {credits}
                </Badge>
              )}
            </div>
          )}

          {/* Sign out + collapse toggle */}
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    />
                  }
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="right">{tc("signOut")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    />
                  }
                  onClick={() => setCollapsed(false)}
                >
                  <PanelLeft className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start gap-2 text-muted-foreground h-9"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                {tc("signOut")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-background transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {mobileNavContent}
      </aside>

      {/* Sidebar - desktop (collapsible) */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:border-r md:bg-background transition-[width] duration-200 ease-in-out overflow-hidden",
          collapsed ? "md:w-[60px]" : "md:w-64"
        )}
      >
        {desktopNavContent}
      </aside>
    </>
  );
}
