import { db } from "@/lib/firebase-admin";
import { getUserByPhone } from "@/lib/phone-links";
import { uploadReceiptImage } from "@/lib/storage";
import { extractReceiptData } from "@/lib/gemini";
import { compressReceiptImage } from "@/lib/image";
import { checkCredits, deductCredits, getOrCreateUser } from "@/lib/credits";
import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns";

/* ───────── Twilio helpers ───────── */

const TWILIO_SID = () => process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = () => process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = () => process.env.TWILIO_WHATSAPP_NUMBER;

/**
 * Send a WhatsApp reply via Twilio REST API.
 */
async function sendWhatsAppReply(to, body) {
  const sid = TWILIO_SID();
  const token = TWILIO_TOKEN();

  const params = new URLSearchParams();
  params.append("To", to);
  params.append("From", TWILIO_FROM());
  params.append("Body", body);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("Twilio send error:", res.status, errText);
  }
}

/**
 * Download media from Twilio (images sent by user).
 * Twilio media URLs require Basic auth.
 */
async function downloadTwilioMedia(mediaUrl) {
  const sid = TWILIO_SID();
  const token = TWILIO_TOKEN();

  const res = await fetch(mediaUrl, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Failed to download media: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType: contentType };
}

/* ───────── AI advisor (simplified for WhatsApp) ───────── */

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const WHATSAPP_TOOL_DECLARATIONS = [
  {
    name: "get_monthly_summary",
    description:
      "Get a financial summary for a given month. Returns total income, total spend, category breakdown, and number of receipts.",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", description: "Month in YYYY-MM format" },
      },
      required: ["period"],
    },
  },
  {
    name: "query_receipts",
    description:
      "Search the user's receipts with optional filters. Returns matching receipts.",
    parameters: {
      type: "object",
      properties: {
        merchant: { type: "string", description: "Filter by merchant name" },
        category: { type: "string", description: "Filter by category" },
        period: { type: "string", description: "Filter by month YYYY-MM" },
        limit: { type: "number", description: "Max results (default 5)" },
      },
    },
  },
  {
    name: "get_budget_status",
    description: "Get the current month's budget limits vs actual spending.",
    parameters: { type: "object", properties: {} },
  },
];

async function toolGetMonthlySummary(uid, { period }) {
  const [incomeDoc, receiptsSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("income").doc(period).get(),
    db.collection("users").doc(uid).collection("receipts").get(),
  ]);

  const income = incomeDoc.exists ? incomeDoc.data().amount || 0 : 0;
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
    totalSpend: Math.round(totalSpend * 100) / 100,
    remaining: Math.round((income - totalSpend) * 100) / 100,
    receiptCount: periodReceipts.length,
    categoryBreakdown,
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
  if (args.period) {
    results = results.filter((r) => r.date?.startsWith(args.period));
  }

  return {
    count: results.length,
    receipts: results.slice(0, args.limit || 5).map((r) => ({
      merchant: r.merchant,
      total: r.total,
      date: r.date,
      category: r.category,
      currency: r.currency,
    })),
  };
}

async function toolGetBudgetStatus(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  const features = userDoc.data()?.features || {};

  if (!features.budgetingEnabled) {
    return { error: "Budgeting is not enabled." };
  }

  const currentMonth = format(new Date(), "yyyy-MM");
  const [limitsSnap, receiptsSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("budget_limits").get(),
    db.collection("users").doc(uid).collection("receipts").get(),
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

  const categories = {};
  const allCats = new Set([...Object.keys(limits), ...Object.keys(categoryTotals)]);
  for (const cat of allCats) {
    const spent = Math.round((categoryTotals[cat] || 0) * 100) / 100;
    const limit = limits[cat] || 0;
    categories[cat] = { spent, limit };
  }

  return { currentMonth, categories };
}

async function executeWhatsAppTool(uid, name, args) {
  switch (name) {
    case "get_monthly_summary":
      return await toolGetMonthlySummary(uid, args);
    case "query_receipts":
      return await toolQueryReceipts(uid, args);
    case "get_budget_status":
      return await toolGetBudgetStatus(uid);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function buildWhatsAppSystemPrompt(userData) {
  const currency = userData.preferredCurrency || "USD";
  return `You are the "Receipt Saver" Financial Coach on WhatsApp. You are helpful, concise, and data-driven.

RULES:
- Respond in English.
- Use your tools to check real data before giving advice. Never guess.
- **FORMATTING**: You are replying on WhatsApp. Use WhatsApp-style formatting ONLY:
  • *bold* for emphasis (NOT **bold**)
  • _italic_ for secondary info
  • Numbered lists: 1. Item, 2. Item
  • Bullet points: • Item
  • NO markdown tables. Use simple lists instead.
  • NO markdown headers (##). Use *bold text* instead.
  • Keep messages under 1500 characters.
- Format all amounts in ${currency}.
- Today's date is ${format(new Date(), "MMMM d, yyyy")}.
- Current month period is ${format(new Date(), "yyyy-MM")}.
- Be concise — WhatsApp is a messaging app, not a document.`;
}

async function runAdvisorPipeline(uid, message) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return "AI is not configured. Please try again later.";

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};

  // Load last 10 WhatsApp messages for context
  const chatRef = db.collection("users").doc(uid).collection("whatsapp_chat");
  const historySnap = await chatRef
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const conversationHistory = historySnap.docs
    .reverse()
    .flatMap((doc) => {
      const d = doc.data();
      if (d.role === "user") {
        return [{ role: "user", parts: [{ text: d.content }] }];
      } else if (d.role === "assistant") {
        return [{ role: "model", parts: [{ text: d.content }] }];
      }
      return [];
    });

  // Save user message
  await chatRef.add({
    role: "user",
    content: message,
    createdAt: Timestamp.now(),
  });

  const contents = [
    ...conversationHistory,
    { role: "user", parts: [{ text: message }] },
  ];

  let finalText = "";
  let iterations = 0;

  while (iterations < 3) {
    iterations++;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: buildWhatsAppSystemPrompt(userData) }],
        },
        contents,
        tools: [{ function_declarations: WHATSAPP_TOOL_DECLARATIONS }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiRes.ok) {
      console.error("Gemini error:", geminiRes.status, await geminiRes.text());
      return "Sorry, I couldn't process your request right now. Please try again.";
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData.candidates?.[0];
    if (!candidate) return "Sorry, I couldn't get a response. Please try again.";

    const parts = candidate.content?.parts || [];
    const functionCalls = parts.filter((p) => p.functionCall);

    if (functionCalls.length > 0) {
      contents.push({ role: "model", parts });

      const functionResponseParts = [];
      for (const fc of functionCalls) {
        const result = await executeWhatsAppTool(
          uid,
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
    } else {
      finalText = parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join("");
      break;
    }
  }

  if (!finalText) {
    finalText = "I couldn't complete my research. Please try rephrasing your question.";
  }

  // Save assistant response
  await chatRef.add({
    role: "assistant",
    content: finalText,
    createdAt: Timestamp.now(),
  });

  return finalText;
}

/* ───────── Receipt processing ───────── */

async function processReceiptImage(uid, email, mediaUrl) {
  // Download image from Twilio
  const { buffer: rawBuffer, mimeType } = await downloadTwilioMedia(mediaUrl);

  // Check credits
  const creditStatus = await checkCredits(uid, email);
  if (!creditStatus.allowed) {
    return "❌ Not enough credits to process this receipt. You need 2 credits per receipt.";
  }

  // Compress for storage
  const compressed = await compressReceiptImage(rawBuffer);

  // Upload to GCS
  const fileName = `whatsapp-${Date.now()}.jpg`;
  const { path: imagePath } = await uploadReceiptImage(uid, fileName, compressed, "image/jpeg");

  // Create receipt doc
  const receiptRef = db
    .collection("users")
    .doc(uid)
    .collection("receipts")
    .doc();

  await receiptRef.set({
    imagePath,
    imagePaths: [imagePath],
    imageCount: 1,
    imageUrl: null,
    status: "processing",
    source: "whatsapp",
    merchant: null,
    date: null,
    currency: "USD",
    subtotal: null,
    tax: null,
    tip: null,
    total: null,
    items: [],
    paymentMethod: null,
    category: null,
    notes: "",
    rawExtraction: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Extract with Gemini
  let extractedData;
  try {
    extractedData = await extractReceiptData(rawBuffer, mimeType);
  } catch (err) {
    console.error("Gemini extraction failed:", err);
    await receiptRef.update({ status: "failed", updatedAt: Timestamp.now() });
    return "❌ Failed to extract data from your receipt. Please try a clearer photo.";
  }

  if (!extractedData) {
    await receiptRef.update({ status: "failed", updatedAt: Timestamp.now() });
    return "❌ I couldn't read this receipt. Make sure the text is clear and well-lit.";
  }

  // Save extracted data
  await receiptRef.update({
    status: "completed",
    merchant: extractedData.merchant,
    date: extractedData.date,
    currency: extractedData.currency || "USD",
    subtotal: extractedData.subtotal,
    tax: extractedData.tax,
    tip: extractedData.tip,
    total: extractedData.total,
    items: extractedData.items || [],
    paymentMethod: extractedData.paymentMethod,
    category: extractedData.category,
    rawExtraction: extractedData,
    updatedAt: Timestamp.now(),
  });

  // Deduct credits
  await deductCredits(uid, email);

  // Build WhatsApp-friendly summary
  const curr = extractedData.currency || "USD";
  const lines = [
    "✅ *Receipt saved!*",
    "",
    `🏪 *${extractedData.merchant || "Unknown"}*`,
    `📅 ${extractedData.date || "No date"}`,
    `💰 *Total: ${curr} ${(extractedData.total || 0).toFixed(2)}*`,
  ];

  if (extractedData.category) {
    lines.push(`🏷️ Category: _${extractedData.category}_`);
  }

  const itemCount = (extractedData.items || []).length;
  if (itemCount > 0) {
    lines.push(`📦 ${itemCount} item${itemCount > 1 ? "s" : ""} detected`);
  }

  if (extractedData.tax) {
    lines.push(`🧾 Tax: ${curr} ${extractedData.tax.toFixed(2)}`);
  }

  return lines.join("\n");
}

/* ───────── Webhook handler ───────── */

export async function POST(request) {
  try {
    // Twilio sends form-urlencoded data
    const formData = await request.formData();
    const from = formData.get("From"); // "whatsapp:+1234567890"
    const body = (formData.get("Body") || "").trim();
    const numMedia = parseInt(formData.get("NumMedia") || "0", 10);

    if (!from) {
      return new Response("Missing From", { status: 400 });
    }

    // Ignore messages from our own Twilio number (status callbacks, echo)
    if (from === TWILIO_FROM()) {
      return twimlResponse();
    }

    // Look up user by phone number
    const phoneClean = from.replace(/^whatsapp:/, "");
    const linkedUser = await getUserByPhone(phoneClean);

    if (!linkedUser) {
      // Unknown phone — send link instructions
      await sendWhatsAppReply(
        from,
        "👋 Hi! I don't recognize this phone number.\n\n" +
          "To use Receipt Saver on WhatsApp:\n" +
          "1. Open Receipt Saver in your browser\n" +
          "2. Go to *Settings*\n" +
          "3. Find the *WhatsApp* section\n" +
          "4. Enter this phone number and tap *Link*\n\n" +
          `Your number: ${phoneClean}`
      );
      return twimlResponse();
    }

    const { uid, email } = linkedUser;

    // Ensure user doc exists
    await getOrCreateUser({ uid, email, name: email });

    if (numMedia > 0) {
      // Image received — process as receipt
      const mediaUrl = formData.get("MediaUrl0");
      if (mediaUrl) {
        // Send "processing" acknowledgment first
        await sendWhatsAppReply(from, "📸 Processing your receipt... one moment.");

        const result = await processReceiptImage(uid, email, mediaUrl);
        await sendWhatsAppReply(from, result);
      }
    } else if (body) {
      // Text message — AI advisor
      if (body.toLowerCase() === "help") {
        await sendWhatsAppReply(
          from,
          "🤖 *Receipt Saver — WhatsApp Commands*\n\n" +
            "📸 *Send a photo* → I'll scan & save the receipt\n" +
            "💬 *Ask anything* → AI financial advice\n\n" +
            "_Examples:_\n" +
            '• "How much did I spend this month?"\n' +
            '• "Show my grocery spending"\n' +
            '• "What\'s my budget status?"\n\n' +
            "Type anything to get started!"
        );
      } else {
        const reply = await runAdvisorPipeline(uid, body);
        await sendWhatsAppReply(from, reply);
      }
    }

    return twimlResponse();
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return twimlResponse();
  }
}

/**
 * Return an empty TwiML response so Twilio doesn't retry.
 * We send replies via the REST API instead.
 */
function twimlResponse() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    }
  );
}

/**
 * Twilio validates webhooks via GET to check the URL is alive.
 */
export async function GET() {
  return Response.json({ status: "ok", service: "receipt-saver-whatsapp" });
}
