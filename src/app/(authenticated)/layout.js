"use client";

import { useAuth } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import { SignInPage } from "@/components/sign-in-page";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyProvider } from "@/components/currency-provider";

export default function AuthenticatedLayout({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-8 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  return <CurrencyProvider><AppShell>{children}</AppShell></CurrencyProvider>;
}
