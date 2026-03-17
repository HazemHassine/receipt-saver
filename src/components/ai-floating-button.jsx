"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Bot, X, MessageSquarePlus } from "lucide-react";
import { AdvisorChat } from "@/components/advisor-chat";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function AiFloatingButton() {
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState(null);
  const t = useTranslations("advisor");

  function handleNewChat() {
    setChatId(null);
  }

  return (
    <>
      {/* Floating button — bottom-right, above mobile nav */}
      <Button
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 h-12 w-12 rounded-full shadow-lg md:bottom-8 md:right-8"
        aria-label="Open AI Financial Advisor"
      >
        <Bot className="h-5 w-5" />
      </Button>

      {/* Sheet sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col"
        >
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <SheetTitle className="text-sm">{t("title")}</SheetTitle>
                <SheetDescription className="text-xs">
                  {t("aiInsights")}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNewChat}
                title={t("newConversation")}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
              <Link href="/advisor" onClick={() => setOpen(false)}>
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  {t("fullPage")}
                </Button>
              </Link>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            <AdvisorChat
              chatId={chatId}
              onChatCreated={(id) => setChatId(id)}
              compact
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
