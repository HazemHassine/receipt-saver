"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { usePathname } from "next/navigation";
import { useCurrency } from "@/components/currency-provider";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * Core AI chat component — used both in the floating sheet and the full page.
 * @param {string} chatId - existing chatId to continue, or null for new
 * @param {function} onChatCreated - called with new chatId when first message creates a chat
 * @param {string} className - optional extra classes
 * @param {boolean} compact - if true, uses more compact spacing (for sheet)
 */
export function AdvisorChat({ chatId, onChatCreated, className = "", compact = false }) {
  const authFetch = useAuthFetch();
  const pathname = usePathname();
  const { currency } = useCurrency();
  const t = useTranslations("advisor");
  const locale = useLocale();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Load existing chat messages
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    setLoadingHistory(true);
    authFetch(`/api/ai/chats/${chatId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages) {
          setMessages(
            data.messages.map((m) => ({
              role: m.role,
              content: m.content,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [chatId, authFetch]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await authFetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chatId: chatId || undefined,
          context: {
            currentPath: pathname,
            currency,
            locale,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get response");
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      // If this was a new chat, notify parent
      if (!chatId && data.chatId && onChatCreated) {
        onChatCreated(data.chatId);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("errorMessage", { error: err.message || t("tryAgain") }),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, chatId, authFetch, pathname, currency, onChatCreated]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages area */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto ${compact ? "p-3 space-y-3" : "p-4 space-y-4"}`}
      >
        {/* Welcome message when empty */}
        {messages.length === 0 && !loadingHistory && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{t("welcome")}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                {t("welcomeDesc")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 justify-center max-w-sm">
              {[
                t("suggestion1"),
                t("suggestion2"),
                t("suggestion3"),
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => textareaRef.current?.focus(), 50);
                  }}
                  className="text-xs border rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading history skeleton */}
        {loadingHistory && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} compact={compact} />
        ))}

        {/* Thinking indicator */}
        {sending && (
          <div className="flex gap-3 items-start">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground animate-pulse">
                {t("researching")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className={`border-t ${compact ? "p-3" : "p-4"}`}>
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            disabled={sending}
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="shrink-0 h-10 w-10"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Markdown components ───────── */

const markdownComponents = {
  h1: ({ children }) => (
    <h2 className="text-base font-bold mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-[0.9rem] font-bold mt-3.5 mb-1.5 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed [&:first-child]:mt-0 [&:last-child]:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 ml-5 list-disc space-y-1 [&_ul]:my-1 [&_ul]:ml-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 [&_ol]:my-1 [&_ol]:ml-4">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
  code: ({ children, className, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded-sm bg-background/80 border border-border/50 px-1.5 py-0.5 text-[0.8em] font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className={`text-xs leading-relaxed ${className || ""}`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2.5 overflow-x-auto rounded-lg border border-border bg-background p-3.5 text-xs leading-relaxed">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 border-l-[3px] border-border pl-3.5 text-muted-foreground [&_p]:my-1">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/60 text-left">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 px-3 py-2">{children}</td>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-muted/20">{children}</tr>
  ),
  hr: () => <hr className="my-4 border-border" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2 decoration-border hover:decoration-foreground transition-colors"
    >
      {children}
    </a>
  ),
  input: ({ checked, ...props }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mr-1.5 rounded accent-primary"
      {...props}
    />
  ),
};

/* ───────── Chat bubble ───────── */

function ChatBubble({ message, compact }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 items-start ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div
        className={`rounded-lg px-3.5 py-2.5 max-w-[85%] ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        } text-sm`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="max-w-none text-sm leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
