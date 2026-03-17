"use client";

import { useAuth } from "@/components/auth-provider";
import { Sidebar } from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShell({ children }) {
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
    return null; // Sign-in page handles this
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
