/**
 * Extract structured receipt data from an image using Gemini 2.5 Flash.
 * Handles both extraction and category inference in a single call.
 */

import { normalizeMerchant } from "@/lib/merchant";

const GEMINI_MODEL = "gemini-3-flash-preview";

const EXTRACTION_PROMPT_SINGLE = `You are a receipt data extraction system. Analyze this receipt image and extract all structured data.

Return ONLY valid JSON with this exact schema (no markdown, no code fences, no explanation):

{
  "merchant": "store/restaurant name or null",
  "date": "YYYY-MM-DD format or null",
  "currency": "3-letter currency code, default USD",
  "subtotal": number or null,
  "tax": number or null,
  "tip": number or null,
  "total": number (required - best estimate if not explicitly shown),
  "items": [
    {
      "description": "item name",
      "quantity": number or null,
      "unitPrice": number or null,
      "totalPrice": number or null
    }
  ],
  "paymentMethod": {
    "cardBrand": "Visa/Mastercard/Amex/etc or null",
    "lastFourDigits": "last 4 digits or null",
    "type": "credit/debit/cash/etc or null"
  } or null,
  "category": "exactly one of: groceries, dining, transport, entertainment, utilities, health, shopping, travel, other"
}

Rules:
- All monetary values must be numbers (not strings), e.g. 12.99 not "$12.99"
- If a field is not visible on the receipt, use null
- For date, always use YYYY-MM-DD format
- For items, extract as many line items as you can read
- For category, infer from the merchant name and items purchased
- paymentMethod should be null if no card info is visible
- Return ONLY the JSON object, nothing else`;

function buildMultiImagePrompt(count) {
  return `You are a receipt data extraction system. You are given ${count} images that are all different parts or pages of the SAME receipt.

Analyze ALL images together and return ONE unified JSON result with this exact schema (no markdown, no code fences, no explanation):

{
  "merchant": "store/restaurant name or null",
  "date": "YYYY-MM-DD format or null",
  "currency": "3-letter currency code, default USD",
  "subtotal": number or null,
  "tax": number or null,
  "tip": number or null,
  "total": number (required - best estimate if not explicitly shown),
  "items": [
    {
      "description": "item name",
      "quantity": number or null,
      "unitPrice": number or null,
      "totalPrice": number or null
    }
  ],
  "paymentMethod": {
    "cardBrand": "Visa/Mastercard/Amex/etc or null",
    "lastFourDigits": "last 4 digits or null",
    "type": "credit/debit/cash/etc or null"
  } or null,
  "category": "exactly one of: groceries, dining, transport, entertainment, utilities, health, shopping, travel, other"
}

Merging rules:
- merchant, date, currency: use the most clearly visible value across all images
- subtotal, tax, tip, total: prefer the LAST image (usually the receipt footer), then the most legible one
- items: merge ALL items from ALL images into one list; if the exact same item (same description AND same price) appears in multiple images it is a duplicate — include it ONCE
- paymentMethod: use whichever image shows card info
- category: infer from the merchant name and all items combined
- All monetary values must be numbers (not strings), e.g. 12.99 not "$12.99"
- Return ONLY the JSON object, nothing else`;
}

/**
 * Extract structured receipt data from one or multiple images using Gemini.
 * @param {Buffer|Array<{buffer: Buffer, mimeType: string}>} imageBufferOrImages
 * @param {string} [mimeType] - required when first arg is a single Buffer
 */
export async function extractReceiptData(imageBufferOrImages, mimeType) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  }

  // Normalize input to array of {buffer, mimeType}
  let images;
  if (Buffer.isBuffer(imageBufferOrImages)) {
    images = [{ buffer: imageBufferOrImages, mimeType: mimeType || "image/jpeg" }];
  } else {
    images = imageBufferOrImages;
  }

  const isMulti = images.length > 1;
  const prompt = isMulti
    ? buildMultiImagePrompt(images.length)
    : EXTRACTION_PROMPT_SINGLE;

  // Build parts: prompt text first, then all images in order
  const parts = [
    { text: prompt },
    ...images.map(({ buffer, mimeType: mt }) => ({
      inlineData: {
        mimeType: mt,
        data: buffer.toString("base64"),
      },
    })),
  ];
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Gemini API error:", response.status, errorBody);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("Gemini returned no content:", JSON.stringify(data));
    return null;
  }

  try {
    // Clean up response in case it has markdown fences
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return validateAndClean(parsed);
  } catch (parseError) {
    console.error("Failed to parse Gemini response:", text);
    throw new Error("Failed to parse receipt data from Gemini response");
  }
}

/**
 * Validate and clean the parsed data to match our data model.
 */
function validateAndClean(data) {
  const validCategories = [
    "groceries", "dining", "transport", "entertainment",
    "utilities", "health", "shopping", "travel", "other",
  ];

    // Normalize merchant: returns structured object with raw, cleaned, canonical, branch, matchType, confidence
    const _merchantResult = normalizeMerchant(typeof data.merchant === "string" ? data.merchant : null);
    return {
      merchant: _merchantResult.merchantCanonical ?? _merchantResult.merchantCleaned ?? _merchantResult.merchantRaw,
      merchantRaw: _merchantResult.merchantRaw,
      merchantBranch: _merchantResult.merchantBranch,
      merchantMatchType: _merchantResult.matchType,
      merchantConfidence: _merchantResult.confidence,
    date: typeof data.date === "string" ? data.date : null,
    currency: typeof data.currency === "string" ? data.currency : "USD",
    subtotal: toNumber(data.subtotal),
    tax: toNumber(data.tax),
    tip: toNumber(data.tip),
    total: toNumber(data.total) || 0,
    items: deduplicateItems(Array.isArray(data.items)
      ? data.items
          .map((item) => ({
            description: typeof item.description === "string" ? item.description : null,
            quantity: toNumber(item.quantity),
            unitPrice: toNumber(item.unitPrice),
            totalPrice: toNumber(item.totalPrice),
          }))
          .filter((item) => item.description || item.totalPrice)
      : []),
    paymentMethod: data.paymentMethod
      ? {
          cardBrand: data.paymentMethod.cardBrand || null,
          lastFourDigits: data.paymentMethod.lastFourDigits || null,
          type: data.paymentMethod.type || null,
        }
      : null,
    category: validCategories.includes(data.category) ? data.category : "other",
  };
}

function toNumber(val) {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

/**
 * Remove exact duplicate items (same description + same totalPrice).
 * Keeps the first occurrence.
 */
function deduplicateItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${(item.description || "").toLowerCase().trim()}|${item.totalPrice ?? item.unitPrice ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
