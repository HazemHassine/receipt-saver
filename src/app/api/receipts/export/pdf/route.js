import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { getSignedUrl } from "@/lib/storage";
import { Timestamp } from "firebase-admin/firestore";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Storage } from "@google-cloud/storage";

let _storage;
let _bucket;

function getBucket() {
  if (!_bucket) {
    _storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    _bucket = _storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
  }
  return _bucket;
}

export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const categoriesParam = searchParams.get("categories");
    const categories = categoriesParam ? categoriesParam.split(",") : null;
    const reportName =
      searchParams.get("name") ||
      `Receipt Report - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    // Fetch receipts
    const snapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("receipts")
      .orderBy("date", "desc")
      .get();

    let receipts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter by date range
    if (from) {
      receipts = receipts.filter((r) => r.date && r.date >= from);
    }
    if (to) {
      receipts = receipts.filter((r) => r.date && r.date <= to);
    }

    // Filter by categories
    if (categories && categories.length > 0) {
      receipts = receipts.filter((r) =>
        categories.includes(r.category || "other")
      );
    }

    // Generate PDF
    const pdfBuffer = await generatePDF(reportName, receipts, { from, to, categories });

    // Upload PDF to Cloud Storage
    const filePath = `users/${user.uid}/reports/${Date.now()}-${slugify(reportName)}.pdf`;
    const file = getBucket().file(filePath);
    await file.save(pdfBuffer, {
      metadata: { contentType: "application/pdf" },
      resumable: false,
    });

    // Save report metadata to Firestore
    const reportRef = db
      .collection("users")
      .doc(user.uid)
      .collection("reports")
      .doc();

    await reportRef.set({
      name: reportName,
      filePath,
      receiptCount: receipts.length,
      totalAmount: receipts.reduce((sum, r) => sum + (r.total || 0), 0),
      filters: {
        from: from || null,
        to: to || null,
        categories: categories || null,
      },
      createdAt: Timestamp.now(),
    });

    // Generate download URL
    const downloadUrl = await getSignedUrl(filePath);

    return Response.json({
      report: {
        id: reportRef.id,
        name: reportName,
        downloadUrl,
        receiptCount: receipts.length,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return Response.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

/**
 * Generate a receipt report PDF using pdf-lib (no external font files needed).
 */
async function generatePDF(reportName, receipts, filters) {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const PAGE_W = 595.28; // A4
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const black = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.42, 0.45, 0.5);
  const light = rgb(0.9, 0.9, 0.9);
  const lighter = rgb(0.97, 0.97, 0.97);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  function ensureSpace(needed) {
    if (y - needed < MARGIN + 30) newPage();
  }

  function drawText(text, x, yPos, { font = regularFont, size = 9, color = black, maxWidth } = {}) {
    let str = String(text ?? "");
    if (maxWidth && font.widthOfTextAtSize(str, size) > maxWidth) {
      while (str.length > 1 && font.widthOfTextAtSize(str + "…", size) > maxWidth) {
        str = str.slice(0, -1);
      }
      str = str + "…";
    }
    page.drawText(str, { x, y: yPos, font, size, color });
  }

  function drawLine(x1, yPos, x2, { thickness = 0.5, color = light } = {}) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color });
  }

  function drawRect(x, yPos, w, h, color) {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  }

  // ── Header ──
  drawText("Receipt Saver", MARGIN, y, { font: boldFont, size: 22 });
  y -= 16;
  drawText("Your personal receipt tracker", MARGIN, y, { size: 8, color: muted });
  y -= 14;
  drawLine(MARGIN, y, MARGIN + CONTENT_W, { thickness: 2, color: black });
  y -= 18;

  // Report title
  drawText(reportName, MARGIN, y, { font: boldFont, size: 15 });
  y -= 16;

  // Filter summary
  const filterParts = [];
  if (filters.from || filters.to) {
    filterParts.push(`Date: ${filters.from || "start"} → ${filters.to || "present"}`);
  }
  if (filters.categories && filters.categories.length > 0) {
    filterParts.push(`Categories: ${filters.categories.join(", ")}`);
  }
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  filterParts.push(`Generated: ${today}`);
  drawText(filterParts.join("   •   "), MARGIN, y, { size: 7.5, color: muted, maxWidth: CONTENT_W });
  y -= 18;

  drawLine(MARGIN, y, MARGIN + CONTENT_W);
  y -= 14;

  // ── Summary Stats ──
  const totalAmount = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
  const avgAmount = receipts.length > 0 ? totalAmount / receipts.length : 0;

  const statW = CONTENT_W / 3;
  const stats = [
    { label: "Total Receipts", value: String(receipts.length) },
    { label: "Total Amount", value: `$${totalAmount.toFixed(2)}` },
    { label: "Average", value: `$${avgAmount.toFixed(2)}` },
  ];
  stats.forEach((s, i) => {
    const x = MARGIN + i * statW;
    drawText(s.label, x, y, { size: 7.5, color: muted });
    drawText(s.value, x, y - 14, { font: boldFont, size: 13 });
  });
  y -= 34;
  drawLine(MARGIN, y, MARGIN + CONTENT_W);
  y -= 16;

  // ── Category Breakdown ──
  const catTotals = {};
  receipts.forEach((r) => {
    const cat = r.category || "other";
    catTotals[cat] = (catTotals[cat] || 0) + (r.total || 0);
  });
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  if (sortedCats.length > 0) {
    drawText("Spending by Category", MARGIN, y, { font: boldFont, size: 10 });
    y -= 16;
    sortedCats.forEach(([cat, total]) => {
      ensureSpace(16);
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      drawText(label, MARGIN, y, { size: 8.5 });
      const amtStr = `$${total.toFixed(2)}`;
      const amtW = boldFont.widthOfTextAtSize(amtStr, 8.5);
      drawText(amtStr, MARGIN + CONTENT_W - amtW, y, { font: boldFont, size: 8.5 });
      y -= 14;
    });
    y -= 4;
    drawLine(MARGIN, y, MARGIN + CONTENT_W);
    y -= 16;
  }

  // ── Receipt Table ──
  if (receipts.length === 0) {
    drawText("No receipts match the selected filters.", MARGIN, y, { size: 9, color: muted });
  } else {
    drawText("Receipt Details", MARGIN, y, { font: boldFont, size: 10 });
    y -= 18;

    // Column layout
    const cols = [
      { label: "Merchant", x: MARGIN, w: 155 },
      { label: "Date", x: MARGIN + 155, w: 85 },
      { label: "Category", x: MARGIN + 240, w: 90 },
      { label: "Total", x: MARGIN + 330, w: CONTENT_W - 330, align: "right" },
    ];

    function drawTableHeader(yPos) {
      drawRect(MARGIN, yPos - 2, CONTENT_W, 18, rgb(0.95, 0.95, 0.95));
      cols.forEach((col) => {
        const txt = col.label;
        if (col.align === "right") {
          const tw = regularFont.widthOfTextAtSize(txt, 7.5);
          drawText(txt, col.x + col.w - tw - 4, yPos + 4, { size: 7.5, color: muted });
        } else {
          drawText(txt, col.x + 4, yPos + 4, { size: 7.5, color: muted });
        }
      });
      return yPos - 18;
    }

    y = drawTableHeader(y);

    receipts.forEach((receipt, idx) => {
      ensureSpace(18);
      if (y === PAGE_H - MARGIN) {
        y = drawTableHeader(y);
      }
      if (idx % 2 === 0) {
        drawRect(MARGIN, y - 2, CONTENT_W, 16, rgb(0.98, 0.98, 0.98));
      }
      drawText(receipt.merchant || "Unknown", cols[0].x + 4, y + 2, { size: 8, maxWidth: cols[0].w - 8 });
      drawText(receipt.date || "—", cols[1].x + 4, y + 2, { size: 8, color: muted, maxWidth: cols[1].w - 8 });
      const cat = (receipt.category || "other");
      drawText(cat.charAt(0).toUpperCase() + cat.slice(1), cols[2].x + 4, y + 2, { size: 8, color: muted });
      const amtStr = `$${(receipt.total || 0).toFixed(2)}`;
      const amtW = boldFont.widthOfTextAtSize(amtStr, 8);
      drawText(amtStr, cols[3].x + cols[3].w - amtW - 4, y + 2, { font: boldFont, size: 8 });
      y -= 16;
    });

    drawLine(MARGIN, y, MARGIN + CONTENT_W);
  }

  // ── Footer on each page ──
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i);
    p.drawLine({
      start: { x: MARGIN, y: MARGIN + 18 },
      end: { x: PAGE_W - MARGIN, y: MARGIN + 18 },
      thickness: 0.5,
      color: light,
    });
    const footerTxt = `Generated by Receipt Saver   •   Page ${i + 1} of ${pageCount}`;
    const fw = regularFont.widthOfTextAtSize(footerTxt, 7);
    p.drawText(footerTxt, {
      x: (PAGE_W - fw) / 2,
      y: MARGIN + 6,
      font: regularFont,
      size: 7,
      color: muted,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}
