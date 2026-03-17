"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { AdvisorChat } from "@/components/advisor-chat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  MessageSquarePlus,
  Trash2,
  MessageSquare,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { formatDistanceToNow, parseISO } from "date-fns";

export default function AdvisorPage() {
  const authFetch = useAuthFetch();
  const t = useTranslations("advisor");
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeChatId, setActiveChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load chat list
  const loadChats = useCallback(async () => {
    try {
      const res = await authFetch("/api/ai/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingChats(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  function handleNewChat() {
    setActiveChatId(null);
    setSidebarOpen(false);
  }

  function handleChatCreated(newId) {
    setActiveChatId(newId);
    // Refresh list after a short delay to get the title
    setTimeout(loadChats, 1500);
  }

  function selectChat(id) {
    setActiveChatId(id);
    setSidebarOpen(false);
  }

  async function deleteChat(chatId) {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) setActiveChatId(null);
    try {
      await authFetch("/api/ai/chats", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      toast.success(t("chatDeleted"));
    } catch {
      toast.error(t("chatDeleteFailed"));
    }
  }

  const chatListContent = (
    <div className="flex h-full flex-col">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <span className="font-semibold text-sm">{t("consultations")}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleNewChat}
          title={t("newChat")}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {loadingChats && (
          <div className="space-y-2 px-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!loadingChats && chats.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            {t("noConsultations")}
          </p>
        )}

        {chats.map((chat) => (
          <div key={chat.id} className="group relative">
            <button
              onClick={() => selectChat(chat.id)}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors",
                activeChatId === chat.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <p className="font-medium truncate text-xs">
                {chat.title || "Untitled"}
              </p>
              <p
                className={cn(
                  "text-xs mt-0.5 truncate",
                  activeChatId === chat.id
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                {chat.updatedAt
                  ? formatDistanceToNow(parseISO(chat.updatedAt), {
                      addSuffix: true,
                    })
                  : ""}
              </p>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
                activeChatId === chat.id
                  ? "text-primary-foreground/70 hover:text-primary-foreground"
                  : "text-muted-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                deleteChat(chat.id);
              }}
              title="{t('deleteChat')}"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-4 -my-8 md:-mx-8">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-20 right-4 z-30 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquare className="h-5 w-5" />
        )}
      </Button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat list sidebar — mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-20 w-72 border-l bg-background transition-transform duration-200 md:hidden",
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {chatListContent}
      </aside>

      {/* Chat list sidebar — desktop */}
      <aside className="hidden md:flex md:w-72 md:flex-col md:border-r md:bg-background/50">
        {chatListContent}
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Bot className="h-5 w-5" />
          <div>
            <h1 className="text-sm font-semibold">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Chat component */}
        <div className="flex-1 overflow-hidden">
          <AdvisorChat
            chatId={activeChatId}
            onChatCreated={handleChatCreated}
          />
        </div>
      </div>
    </div>
  );
}
