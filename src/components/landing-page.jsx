"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Receipt,
  ScanLine,
  PiggyBank,
  Bot,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Zap,
  Globe,
  BarChart3,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Camera,
  FileText,
  ChevronRight,
  MessageCircle,
  Cloud,
  Smartphone,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ─────────── Animated counter ─────────── */
function AnimatedNumber({ value, prefix = "", suffix = "", duration = 1500 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const animate = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.floor(eased * value));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ─────────── Fade-in on scroll ─────────── */
function FadeIn({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─────────── Mock receipt scan animation ─────────── */
function ReceiptScanMock() {
  return (
    <div className="relative w-full max-w-[320px] mx-auto">
      {/* Paper receipt */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border shadow-2xl p-6 space-y-3 relative overflow-hidden">
        {/* Scan line animation */}
        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-foreground/40 to-transparent animate-scan-line" />

        <div className="text-center space-y-1">
          <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
            Fresh Market
          </p>
          <p className="text-[10px] text-muted-foreground">
            123 Main Street • Mar 15, 2026
          </p>
        </div>
        <Separator />
        <div className="space-y-1.5 text-xs">
          {[
            { item: "Organic Milk 1L", price: "$4.99" },
            { item: "Sourdough Bread", price: "$6.50" },
            { item: "Avocados x3", price: "$5.97" },
            { item: "Orange Juice", price: "$3.49" },
            { item: "Chicken Breast 1kg", price: "$12.99" },
          ].map((line, i) => (
            <div
              key={i}
              className="flex justify-between animate-fade-in-row"
              style={{ animationDelay: `${800 + i * 200}ms` }}
            >
              <span className="text-muted-foreground">{line.item}</span>
              <span className="font-medium">{line.price}</span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-between text-sm font-bold animate-fade-in-row" style={{ animationDelay: "1800ms" }}>
          <span>Total</span>
          <span>$33.94</span>
        </div>

        {/* Extracted badge */}
        <div className="absolute -top-1 -right-1 animate-badge-pop" style={{ animationDelay: "2200ms" }}>
          <Badge className="bg-foreground text-background shadow-lg text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" />
            AI Extracted
          </Badge>
        </div>
      </div>

      {/* Floating category tag */}
      <div
        className="absolute -bottom-3 -left-3 animate-badge-pop"
        style={{ animationDelay: "2500ms" }}
      >
        <Badge variant="secondary" className="shadow-md text-xs gap-1 py-1">
          🛒 Groceries
        </Badge>
      </div>

      {/* Floating amount tag */}
      <div
        className="absolute -bottom-3 -right-3 animate-badge-pop"
        style={{ animationDelay: "2700ms" }}
      >
        <Badge variant="outline" className="shadow-md text-xs gap-1 py-1 bg-background">
          <Wallet className="h-3 w-3" />
          -$33.94
        </Badge>
      </div>
    </div>
  );
}

/* ─────────── Mock budget chart ─────────── */
function BudgetMock() {
  const categories = [
    { name: "Groceries", spent: 342, limit: 400, color: "bg-foreground" },
    { name: "Dining", spent: 189, limit: 200, color: "bg-foreground/80" },
    { name: "Transport", spent: 95, limit: 150, color: "bg-foreground/60" },
    { name: "Entertainment", spent: 67, limit: 100, color: "bg-foreground/40" },
  ];

  return (
    <div className="bg-background rounded-xl border shadow-xl p-5 space-y-4 w-full max-w-[340px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">March Budget</span>
        </div>
        <Badge variant="secondary" className="text-xs">72% used</Badge>
      </div>
      <div className="space-y-3">
        {categories.map((cat, i) => {
          const pct = Math.round((cat.spent / cat.limit) * 100);
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{cat.name}</span>
                <span className="font-medium">
                  ${cat.spent} <span className="text-muted-foreground">/ ${cat.limit}</span>
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${cat.color} transition-all duration-1000 ease-out`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <Separator />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Remaining balance</span>
        <span className="font-bold text-sm text-green-600">$1,307</span>
      </div>
    </div>
  );
}

/* ─────────── Mock AI chat ─────────── */
function AiChatMock() {
  return (
    <div className="bg-background rounded-xl border shadow-xl p-5 space-y-3 w-full max-w-[340px]">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Financial Coach</span>
        <Sparkles className="h-3 w-3 text-muted-foreground ml-auto" />
      </div>
      {/* User message */}
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs max-w-[80%]">
          Where am I spending the most this month?
        </div>
      </div>
      {/* AI response */}
      <div className="flex gap-2">
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="bg-muted rounded-lg px-3 py-2 text-xs space-y-1.5 max-w-[85%]">
          <p>Your top 3 spending categories this month:</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>1. 🛒 Groceries</span>
              <span className="font-semibold">$342</span>
            </div>
            <div className="flex justify-between">
              <span>2. 🍽️ Dining</span>
              <span className="font-semibold">$189</span>
            </div>
            <div className="flex justify-between">
              <span>3. 🚗 Transport</span>
              <span className="font-semibold">$95</span>
            </div>
          </div>
          <p>
            You&apos;re spending <strong>18% more</strong> on dining compared to last month. Want me to set a savings goal?
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Mock goals ─────────── */
function GoalsMock() {
  return (
    <div className="bg-background rounded-xl border shadow-xl p-5 space-y-4 w-full max-w-[340px]">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Financial Goals</span>
      </div>
      {[
        { title: "Reduce dining to $150/mo", current: 189, target: 150, deadline: "Apr 2026" },
        { title: "Save $500 for vacation", current: 320, target: 500, deadline: "Jun 2026" },
      ].map((goal, i) => {
        const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
        return (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{goal.title}</span>
              <span className="text-[10px] text-muted-foreground">{goal.deadline}</span>
            </div>
            <Progress value={pct} className="h-2" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>${goal.current} / ${goal.target}</span>
              <span>{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Mock WhatsApp chat ─────────── */
function WhatsAppMock() {
  return (
    <div className="bg-background rounded-xl border shadow-xl w-full max-w-[340px] overflow-hidden">
      {/* Header */}
      <div className="bg-foreground text-background px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-background/20 flex items-center justify-center">
          <Receipt className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Receipt Saver</p>
          <p className="text-[10px] opacity-70">Online</p>
        </div>
        <Smartphone className="h-4 w-4 ml-auto opacity-50" />
      </div>
      {/* Chat area */}
      <div className="p-4 space-y-3 bg-muted/30 min-h-[200px]">
        {/* User sends image */}
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs max-w-[75%] space-y-1">
            <div className="flex items-center gap-1.5">
              <Camera className="h-3 w-3" />
              <span className="font-medium">receipt.jpg</span>
            </div>
            <p className="text-[10px] opacity-70">12:34 PM</p>
          </div>
        </div>
        {/* Bot processing */}
        <div className="flex gap-2">
          <div className="h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5">
            <Receipt className="h-3 w-3" />
          </div>
          <div className="bg-background rounded-lg px-3 py-2 text-xs border space-y-1 max-w-[80%]">
            <p>✅ *Receipt saved!*</p>
            <p>🏪 *Fresh Market*</p>
            <p>📅 Mar 15, 2026</p>
            <p>💰 *Total: $33.94*</p>
            <p>🏷️ _Groceries_</p>
            <p>📦 5 items detected</p>
            <p className="text-[10px] text-muted-foreground mt-1">12:34 PM</p>
          </div>
        </div>
        {/* User asks question */}
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs max-w-[75%]">
            How much did I spend this month?
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Google icon SVG ─────────── */
function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════ */

export function LandingPage() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2.5">
            <Receipt className="h-6 w-6" />
            <span className="text-lg font-bold tracking-tight">Receipts</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              Beta
            </Badge>
            <Button onClick={signIn} size="sm" className="gap-2">
              <GoogleIcon />
              Sign in
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-32">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] [background-size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_70%,transparent_100%)]" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left: text */}
            <div className="space-y-6 text-center lg:text-left">
              <FadeIn>
                <Badge variant="secondary" className="gap-1.5 text-xs mb-2">
                  <Zap className="h-3 w-3" />
                  Powered by Gemini AI
                </Badge>
              </FadeIn>

              <FadeIn delay={100}>
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
                  Snap. Extract.
                  <br />
                  <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
                    Stay on budget.
                  </span>
                </h1>
              </FadeIn>

              <FadeIn delay={200}>
                <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0">
                  Take a photo of any receipt and let AI extract every detail — merchant, items, totals, and category. 
                  Track spending, set budgets, and get personalized financial coaching.
                </p>
              </FadeIn>

              <FadeIn delay={300}>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Button onClick={signIn} size="lg" className="gap-2 text-base px-8">
                    <GoogleIcon />
                    Get started free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  No credit card required • Free during beta
                </p>
              </FadeIn>
            </div>

            {/* Right: receipt mock */}
            <FadeIn delay={400} className="flex justify-center">
              <ReceiptScanMock />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="border-y bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 99, suffix: "%", label: "Extraction accuracy" },
              { value: 7, suffix: "s", label: "Avg processing time" },
              { value: 15, suffix: "+", label: "Supported categories" },
              { value: 4, suffix: "", label: "Languages supported" },
            ].map((stat, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div>
                  <p className="text-3xl font-extrabold">
                    <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 text-xs">How it works</Badge>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Three steps to financial clarity
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto">
                From paper receipt to actionable insights in seconds.
              </p>
            </div>
          </FadeIn>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Camera,
                title: "Snap or upload",
                desc: "Take a photo of your receipt or upload an image. Support for multi-page receipts with automatic merging.",
              },
              {
                step: "02",
                icon: ScanLine,
                title: "AI extracts everything",
                desc: "Gemini AI reads the receipt and extracts merchant, date, items, prices, totals, currency, and category.",
              },
              {
                step: "03",
                icon: BarChart3,
                title: "Track & optimize",
                desc: "See spending trends, set category budgets, and get personalized advice from your AI financial coach.",
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 150}>
                <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="absolute top-0 right-0 text-[5rem] font-black text-muted/30 leading-none pr-4 -mt-2 select-none">
                    {item.step}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center mb-2">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features: Budget + AI ─── */}
      <section className="py-20 md:py-28 bg-muted/20 border-y">
        <div className="mx-auto max-w-6xl px-6 space-y-24">
          {/* Budget feature */}
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <FadeIn className="order-2 lg:order-1 flex justify-center">
              <BudgetMock />
            </FadeIn>
            <FadeIn delay={150} className="order-1 lg:order-2 space-y-4 text-center lg:text-left">
              <Badge variant="outline" className="text-xs gap-1">
                <PiggyBank className="h-3 w-3" />
                Budgeting
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight">
                Set limits. Stay on track.
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto lg:mx-0">
                Define monthly budgets for any category. Get real-time progress bars, 
                alerts when you&apos;re approaching limits, and month-over-month trend comparisons.
              </p>
              <div className="space-y-2 text-sm">
                {[
                  "Per-category spending limits",
                  "Custom date range analysis",
                  "Visual spending breakdowns",
                  "Overspending alerts",
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 justify-center lg:justify-start">
                    <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>

          {/* AI Coach feature */}
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <FadeIn className="space-y-4 text-center lg:text-left">
              <Badge variant="outline" className="text-xs gap-1">
                <Bot className="h-3 w-3" />
                AI Financial Coach
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight">
                Your personal money advisor.
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto lg:mx-0">
                Ask questions about your spending in natural language. The AI coach analyzes 
                your real data, identifies patterns, and helps you set achievable savings goals.
              </p>
              <div className="space-y-2 text-sm">
                {[
                  "Natural language queries",
                  "Real-time data analysis",
                  "Personalized savings goals",
                  "Spending pattern detection",
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 justify-center lg:justify-start">
                    <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
            <FadeIn delay={150} className="flex justify-center">
              <AiChatMock />
            </FadeIn>
          </div>

          {/* Goals feature */}
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <FadeIn className="order-2 lg:order-1 flex justify-center">
              <GoalsMock />
            </FadeIn>
            <FadeIn delay={150} className="order-1 lg:order-2 space-y-4 text-center lg:text-left">
              <Badge variant="outline" className="text-xs gap-1">
                <Target className="h-3 w-3" />
                Goal Tracking
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight">
                Set goals. Crush them.
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto lg:mx-0">
                Let the AI suggest realistic financial goals based on your habits, or create your own. 
                Track progress with visual indicators and celebrate when you hit your targets.
              </p>
            </FadeIn>
          </div>

          {/* WhatsApp integration */}
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <FadeIn className="space-y-4 text-center lg:text-left">
              <Badge variant="outline" className="text-xs gap-1">
                <MessageCircle className="h-3 w-3" />
                WhatsApp Integration
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight">
                Scan receipts from WhatsApp.
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto lg:mx-0">
                Link your WhatsApp number and send receipt photos directly — no app needed. 
                Chat with your AI financial coach right from your messaging app.
              </p>
              <div className="space-y-2 text-sm">
                {[
                  "Send a photo → receipt saved instantly",
                  "Ask spending questions via chat",
                  "Get budget alerts on WhatsApp",
                  "No extra app to install",
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 justify-center lg:justify-start">
                    <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
            <FadeIn delay={150} className="flex justify-center">
              <WhatsAppMock />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── Feature grid ─── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Everything you need
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto">
                Built for people who want to understand their spending without the spreadsheet headaches.
              </p>
            </div>
          </FadeIn>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ScanLine, title: "AI Receipt Scanning", desc: "Gemini extracts merchant, items, prices, tax, and total from any receipt photo." },
              { icon: FileText, title: "Multi-page Merge", desc: "Upload multiple images of a long receipt and they'll be merged into one record." },
              { icon: PiggyBank, title: "Smart Budgeting", desc: "Set per-category limits, track utilization, and get alerts before you overspend." },
              { icon: Bot, title: "AI Financial Coach", desc: "Chat with your financial data. Get actionable insights and personalized advice." },
              { icon: Target, title: "Financial Goals", desc: "Set savings targets with deadlines. Track progress and get nudges from your AI coach." },
              { icon: BarChart3, title: "Reports & Export", desc: "Generate monthly reports, export receipts to CSV or PDF for tax season." },
              { icon: MessageCircle, title: "WhatsApp Integration", desc: "Send receipt photos via WhatsApp to scan them. Chat with your AI advisor without opening the app." },
              { icon: Globe, title: "Multi-language", desc: "Full support for English, French, German, and Arabic with RTL layout." },
              { icon: Shield, title: "Secure by Design", desc: "Google authentication, encrypted storage, and your data is never shared." },
              { icon: Zap, title: "Lightning Fast", desc: "Most receipts are processed in under 3 seconds with real-time progress updates." },
            ].map((feature, i) => (
              <FadeIn key={i} delay={i * 80}>
                <Card className="group hover:shadow-md transition-shadow h-full">
                  <CardHeader className="pb-1">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center mb-1 group-hover:bg-foreground group-hover:text-background transition-colors">
                      <feature.icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.desc}
                    </p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 md:py-28 border-t bg-muted/20">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="text-center space-y-6 max-w-xl mx-auto">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ready to take control of your spending?
              </h2>
              <p className="text-muted-foreground text-lg">
                Join the beta and start tracking your expenses with AI-powered receipt scanning. 
                It&apos;s free, it&apos;s fast, and it&apos;s beautiful.
              </p>
              <Button onClick={signIn} size="lg" className="gap-2 text-base px-10">
                <GoogleIcon />
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Beta access • No credit card • Unlimited during testing
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            <span>Receipts &copy; {new Date().getFullYear()}</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            Powered by
            <Cloud className="h-3.5 w-3.5" />
            Google Cloud Platform
            <span className="mx-1">•</span>
            Next.js, Firebase & Gemini AI
          </p>
        </div>
      </footer>
    </div>
  );
}
