"use client";

import { useEffect, useState } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useCurrency } from "@/components/currency-provider";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Trash2, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isPast } from "date-fns";

export function GoalsProgress() {
  const authFetch = useAuthFetch();
  const { formatAmount } = useCurrency();
  const t = useTranslations("goals");
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/ai/goals")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setGoals(data?.goals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch]);

  async function deleteGoal(goalId) {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    try {
      await authFetch("/api/ai/goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId }),
      });
      toast.success("Goal removed");
    } catch {
      toast.error("Failed to remove goal");
    }
  }

  async function completeGoal(goalId) {
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, status: "completed" } : g))
    );
    try {
      await authFetch("/api/ai/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, status: "completed" }),
      });
      toast.success("Goal marked as complete!");
    } catch {
      toast.error("Failed to update goal");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  if (goals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </div>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeGoals.map((goal) => {
          const percent =
            goal.targetAmount > 0
              ? Math.min(
                  (goal.currentAmount / goal.targetAmount) * 100,
                  100
                )
              : 0;
          const isOverdue = goal.deadline && isPast(parseISO(goal.deadline));

          return (
            <div
              key={goal.id}
              className="rounded-lg border p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{goal.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      Target: {formatAmount(goal.targetAmount)}
                    </span>
                    {goal.deadline && (
                      <span
                        className={`text-xs flex items-center gap-1 ${
                          isOverdue
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(goal.deadline), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => completeGoal(goal.id)}
                    title="Mark complete"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => deleteGoal(goal.id)}
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Progress value={percent} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {formatAmount(goal.currentAmount)} of{" "}
                {formatAmount(goal.targetAmount)} ({Math.round(percent)}%)
              </p>
            </div>
          );
        })}

        {completedGoals.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground pt-1">{t("completed")}</p>
            {completedGoals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center justify-between rounded-lg border p-3 opacity-60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm line-through truncate">
                    {goal.title}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground shrink-0"
                  onClick={() => deleteGoal(goal.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
