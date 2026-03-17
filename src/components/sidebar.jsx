"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const authFetch = useAuthFetch();
  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);

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
  }, [authFetch, pathname]); // refetch on navigation so it updates after uploads

  const initials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5">
        <Receipt className="h-6 w-6" />
        <span className="text-lg font-semibold tracking-tight">Receipts</span>
      </div>

      <Separator />

      {/* Navigation */}
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

      {/* User */}
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
        {/* Credits */}
        {credits !== null && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Credits:</span>
            {unlimited ? (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1">
                <Infinity className="h-3 w-3" />
                Unlimited
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
          Sign out
        </Button>
      </div>
    </div>
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
        {navContent}
      </aside>

      {/* Sidebar - desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-background">
        {navContent}
      </aside>
    </>
  );
}
