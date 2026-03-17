import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns";

/* ───────── Gemini config ───────── */

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/* ───────── Tool definitions (function calling) ───────── */

const TOOL_DECLARATIONS = [
  {
    name: "get_monthly_summary",
    description:
      "Get a financial summary for a given month. Returns total income, total spend, category breakdown, and number of receipts.",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Month in YYYY-MM format, e.g. 2026-03",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "query_receipts",
    description:
      "Search the user's receipts with optional filters. Returns matching receipts with merchant, total, date, and category.",
    parameters: {
      type: "object",
      properties: {
        merchant: {
          type: "string",
          description: "Filter by merchant name (partial match)",
        },
        category: {
          type: "string",
          description: "Filter by category (e.g. groceries, dining, transport)",
        },
        minAmount: {
          type: "number",
          description: "Minimum total amount",
        },
        maxAmount: {
          type: "number",
          description: "Maximum total amount",
        },
        period: {
          type: "string",
          description: "Filter by month in YYYY-MM format",
        },
        limit: {
          type: "number",
          description: "Max number of results to return (default 10)",
        },
      },
    },
  },
  {
    name: "get_budget_status",
    description:
      "Get the current month's budget limits vs actual spending per category. Only available if budgeting is enabled.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "commit_goal",
    description:
      "Save a new financial goal for the user. Use this when the user agrees to a savings or spending target.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short title for the goal, e.g. 'Reduce dining spending'",
        },
        targetAmount: {
          type: "number",
          description: "Target amount in the user's currency",
        },
        deadline: {
          type: "string",
          description: "Deadline date in YYYY-MM-DD format",
        },
      },
      required: ["title", "targetAmount", "deadline"],
    },
  },
  {
    name: "list_goals",
    description:
      "List all financial goals for the user. Returns active and completed goals with their IDs, titles, amounts, and deadlines.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "remove_goal",
    description:
      "Permanently delete a financial goal by its ID. IMPORTANT: Only call this AFTER the user has explicitly confirmed they want to delete the goal. Never call this without prior confirmation.",
    parameters: {
      type: "object",
      properties: {
        goalId: {
          type: "string",
          description: "The ID of the goal to delete",
        },
      },
      required: ["goalId"],
    },
  },
];

/* ───────── Tool implementations ───────── */

async function toolGetMonthlySummary(uid, { period }) {
  const [incomeDoc, receiptsSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("income").doc(period).get(),
    db.collection("users").doc(uid).collection("receipts").get(),
  ]);

  const income = incomeDoc.exists ? incomeDoc.data().amount || 0 : 0;
  const incomeSource = incomeDoc.exists ? incomeDoc.data().source || "" : "";

  const periodReceipts = receiptsSnap.docs
    .map((d) => d.data())
    .filter((r) => r.status === "completed" && r.date?.startsWith(period));

  const totalSpend = periodReceipts.reduce((s, r) => s + (r.total || 0), 0);
  const categoryBreakdown = {};
  for (const r of periodReceipts) {
    const cat = r.category || "other";
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (r.total || 0);
  }

  return {
    period,
    income,
    incomeSource,
    totalSpend: Math.round(totalSpend * 100) / 100,
    remaining: Math.round((income - totalSpend) * 100) / 100,
    receiptCount: periodReceipts.length,
    categoryBreakdown: Object.fromEntries(
      Object.entries(categoryBreakdown)
        .map(([k, v]) => [k, Math.round(v * 100) / 100])
        .sort((a, b) => b[1] - a[1])
    ),
  };
}

async function toolQueryReceipts(uid, args) {
  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("receipts")
    .orderBy("createdAt", "desc")
    .get();

  let results = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.status === "completed");

  if (args.merchant) {
    const q = args.merchant.toLowerCase();
    results = results.filter((r) =>
      (r.merchant || "").toLowerCase().includes(q)
    );
  }
  if (args.category) {
    results = results.filter((r) => r.category === args.category);
  }
  if (args.minAmount !== undefined) {
    results = results.filter((r) => (r.total || 0) >= args.minAmount);
  }
  if (args.maxAmount !== undefined) {
    results = results.filter((r) => (r.total || 0) <= args.maxAmount);
  }
  if (args.period) {
    results = results.filter((r) => r.date?.startsWith(args.period));
  }

  const maxResults = args.limit || 10;
  results = results.slice(0, maxResults);

  return {
    count: results.length,
    receipts: results.map((r) => ({
      id: r.id,
      merchant: r.merchant,
      total: r.total,
      date: r.date,
      category: r.category,
      currency: r.currency,
      items: (r.items || []).slice(0, 5).map((i) => i.description),
    })),
  };
}

async function toolGetBudgetStatus(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  const features = userDoc.data()?.features || {};

  if (!features.budgetingEnabled) {
    return { error: "Budgeting is not enabled for this user." };
  }

  const currentMonth = format(new Date(), "yyyy-MM");

  const [limitsSnap, receiptsSnap, incomeDoc] = await Promise.all([
    db.collection("users").doc(uid).collection("budget_limits").get(),
    db.collection("users").doc(uid).collection("receipts").get(),
    db.collection("users").doc(uid).collection("income").doc(currentMonth).get(),
  ]);

  const limits = {};
  limitsSnap.forEach((doc) => {
    limits[doc.id] = doc.data().limit;
  });

  const categoryTotals = {};
  receiptsSnap.docs
    .map((d) => d.data())
    .filter((r) => r.status === "completed" && r.date?.startsWith(currentMonth))
    .forEach((r) => {
      const cat = r.category || "other";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (r.total || 0);
    });

  const income = incomeDoc.exists ? incomeDoc.data().amount || 0 : 0;

  const categories = {};
  const allCats = new Set([...Object.keys(limits), ...Object.keys(categoryTotals)]);
  for (const cat of allCats) {
    const spent = Math.round((categoryTotals[cat] || 0) * 100) / 100;
    const limit = limits[cat] || 0;
    categories[cat] = {
      spent,
      limit,
      percent: limit > 0 ? Math.round((spent / limit) * 100) : null,
      status: limit > 0 ? (spent > limit ? "over" : spent >= limit * 0.9 ? "warning" : "ok") : "no_limit",
    };
  }

  return { currentMonth, income, categories };
}

async function toolCommitGoal(uid, { title, targetAmount, deadline }) {
  const ref = db.collection("users").doc(uid).collection("financial_goals").doc();
  await ref.set({
    title,
    targetAmount,
    deadline,
    currentAmount: 0,
    status: "active",
    createdAt: Timestamp.now(),
  });
  return { success: true, goalId: ref.id, title, targetAmount, deadline };
}

async function toolListGoals(uid) {
  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("financial_goals")
    .orderBy("createdAt", "desc")
    .get();

  if (snap.empty) {
    return { count: 0, goals: [], message: "No goals found." };
  }

  const goals = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.title,
      targetAmount: d.targetAmount,
      currentAmount: d.currentAmount || 0,
      deadline: d.deadline,
      status: d.status,
    };
  });

  return { count: goals.length, goals };
}

async function toolRemoveGoal(uid, { goalId }) {
  const ref = db
    .collection("users")
    .doc(uid)
    .collection("financial_goals")
    .doc(goalId);
  const doc = await ref.get();
  if (!doc.exists) {
    return { success: false, error: "Goal not found." };
  }
  const title = doc.data().title;
  await ref.delete();
  return { success: true, deletedGoal: title };
}

/* ───────── tool dispatcher ───────── */

async function executeTool(uid, name, args) {
  switch (name) {
    case "get_monthly_summary":
      return await toolGetMonthlySummary(uid, args);
    case "query_receipts":
      return await toolQueryReceipts(uid, args);
    case "get_budget_status":
      return await toolGetBudgetStatus(uid);
    case "commit_goal":
      return await toolCommitGoal(uid, args);
    case "list_goals":
      return await toolListGoals(uid);
    case "remove_goal":
      return await toolRemoveGoal(uid, args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/* ───────── System prompt ───────── */

function buildSystemPrompt(context) {
  const budgetClause = context.budgetingEnabled
    ? "The user has budgeting enabled — you can use get_budget_status and commit_goal tools."
    : "The user does NOT have budgeting enabled — do not offer budget-related advice or use budget tools.";

  const languageMap = {
    en: "English",
    de: "German",
    fr: "French",
    ar: "Arabic",
  };
  const language = languageMap[context.locale] || "English";
  const languageClause = `You MUST respond in ${language}. All your text output must be in ${language}, including tables, explanations, and suggestions.`;

  return `You are the "Receipt Saver" Financial Coach. You are witty, grounded, and data-driven.

RULES:
- ${languageClause}
- **Always verify**: Use your tools to check real data before giving advice. Never guess numbers.
- **Context**: The user is currently on the page "${context.currentPath || "/dashboard"}". If they are on /upload, offer tips on categorization. If on a receipt detail page, offer insights about that spending. If on /budget, help with budget analysis.
- **Goal Setting**: If a user expresses a desire to save money or cut costs, suggest a specific, measurable goal. If they agree, call commit_goal immediately.
- **Goal Removal**: If a user asks to remove/delete a goal, FIRST call list_goals to show them their goals, then ask them to confirm which goal they want to delete by name. Only call remove_goal AFTER the user explicitly confirms (e.g. says "yes", "confirm", "go ahead", "delete it"). If they change their mind or pick a different goal, adjust accordingly. Never remove a goal without clear confirmation.
- **Tone**: Professional but friendly. Concise. Use markdown formatting: tables for data, bold for emphasis, bullet points for lists.
- **Currency**: Format all amounts in ${context.currency || "USD"}.
- ${budgetClause}
- Today's date is ${format(new Date(), "MMMM d, yyyy")}.
- Current month period is ${format(new Date(), "yyyy-MM")}.

When presenting financial data, use markdown tables for clarity. Keep responses concise and actionable.`;
}

/* ───────── POST handler ───────── */

export async function POST(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { message, chatId, context = {} } = body;

    if (!message?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Load user features for system prompt
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.data() || {};
    const systemContext = {
      currentPath: context.currentPath || "/dashboard",
      currency: userData.preferredCurrency || "USD",
      budgetingEnabled: !!userData.features?.budgetingEnabled,
      locale: context.locale || "en",
    };

    // Load or create chat
    let chatRef;
    let conversationHistory = [];

    if (chatId) {
      chatRef = db
        .collection("users")
        .doc(user.uid)
        .collection("chats")
        .doc(chatId);
      const messagesSnap = await chatRef
        .collection("messages")
        .orderBy("createdAt", "asc")
        .limit(40)
        .get();
      conversationHistory = messagesSnap.docs.flatMap((doc) => {
        const d = doc.data();
        const parts = [];
        if (d.role === "user") {
          parts.push({ role: "user", parts: [{ text: d.content }] });
        } else if (d.role === "assistant") {
          parts.push({ role: "model", parts: [{ text: d.content }] });
        }
        return parts;
      });
    } else {
      chatRef = db
        .collection("users")
        .doc(user.uid)
        .collection("chats")
        .doc();
      await chatRef.set({
        title: message.slice(0, 60),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    // Save user message
    await chatRef.collection("messages").add({
      role: "user",
      content: message,
      createdAt: Timestamp.now(),
    });

    // Build Gemini request
    const contents = [
      ...conversationHistory,
      { role: "user", parts: [{ text: message }] },
    ];

    // Determine which tools to expose
    const budgetOnlyTools = ["get_budget_status", "commit_goal", "list_goals", "remove_goal"];
    const availableTools = systemContext.budgetingEnabled
      ? TOOL_DECLARATIONS
      : TOOL_DECLARATIONS.filter((t) => !budgetOnlyTools.includes(t.name));

    let finalText = "";
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    // Loop: Gemini may call multiple tools in sequence
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: buildSystemPrompt(systemContext) }],
          },
          contents,
          tools: [{ function_declarations: availableTools }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error("Gemini API error:", geminiRes.status, errText);
        throw new Error(`Gemini API error: ${geminiRes.status}`);
      }

      const geminiData = await geminiRes.json();
      const candidate = geminiData.candidates?.[0];
      if (!candidate) throw new Error("No response from AI");

      const parts = candidate.content?.parts || [];

      // Check for function calls
      const functionCalls = parts.filter((p) => p.functionCall);

      if (functionCalls.length > 0) {
        // Add the model's response (with function calls) to contents
        contents.push({ role: "model", parts });

        // Execute each function call and add results
        const functionResponseParts = [];
        for (const fc of functionCalls) {
          const result = await executeTool(
            user.uid,
            fc.functionCall.name,
            fc.functionCall.args || {}
          );
          functionResponseParts.push({
            functionResponse: {
              name: fc.functionCall.name,
              response: result,
            },
          });
        }

        contents.push({ role: "user", parts: functionResponseParts });
        // Continue loop — Gemini will process the results
      } else {
        // Text response — we're done
        finalText = parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join("");
        break;
      }
    }

    if (!finalText) {
      finalText =
        "I couldn't complete my research. Please try rephrasing your question.";
    }

    // Save assistant response
    await chatRef.collection("messages").add({
      role: "assistant",
      content: finalText,
      createdAt: Timestamp.now(),
    });

    // Update chat metadata
    await chatRef.update({ updatedAt: Timestamp.now() });

    // Auto-title if this is the first exchange
    if (!chatId) {
      // Generate a short title from the AI
      try {
        const titleRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Generate a very short title (max 6 words, no quotes) for a financial chat that starts with: "${message.slice(0, 100)}"`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.3, maxOutputTokens: 30 },
          }),
        });
        if (titleRes.ok) {
          const titleData = await titleRes.json();
          const title =
            titleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            message.slice(0, 60);
          await chatRef.update({ title: title.slice(0, 60) });
        }
      } catch {
        // ignore title generation failures
      }
    }

    return Response.json({
      chatId: chatRef.id,
      message: finalText,
    });
  } catch (error) {
    console.error("AI advisor error:", error);
    return Response.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}
