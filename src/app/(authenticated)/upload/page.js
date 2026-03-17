"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload, ImageIcon, CheckCircle2, AlertCircle, Loader2, Coins, X, Plus, Images,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;
const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function UploadPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const inputRef = useRef(null);

  // Queue of { file, preview } objects
  const [queue, setQueue] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | processing | done | error
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);

  useEffect(() => {
    async function loadCredits() {
      try {
        const res = await authFetch("/api/user");
        if (res.ok) {
          const data = await res.json();
          setCredits(data.user.credits);
          setUnlimited(data.user.unlimited);
        }
      } catch { /* ignore */ }
    }
    loadCredits();
  }, [authFetch]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => queue.forEach((item) => URL.revokeObjectURL(item.preview));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = useCallback((newFiles) => {
    const valid = [];
    for (const file of newFiles) {
      if (!VALID_TYPES.includes(file.type)) {
        toast.error(`${file.name}: not a JPEG, PNG, or WebP image`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: exceeds 10 MB limit`);
        continue;
      }
      valid.push({ file, preview: URL.createObjectURL(file) });
    }
    setQueue((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} images per receipt`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const removeFile = useCallback((index) => {
    setQueue((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleUpload = async () => {
    if (queue.length === 0) return;
    setStatus("processing");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      queue.forEach(({ file }) => formData.append("files", file));

      const res = await authFetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setStatus("done");
      const label = data.imageCount > 1 ? `${data.imageCount} images merged` : "Receipt processed";
      toast.success(`${label} successfully!`);

      setTimeout(() => router.push(`/receipts/${data.receiptId}`), 900);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message);
      toast.error(err.message || "Something went wrong.");
    }
  };

  const reset = () => {
    queue.forEach((item) => URL.revokeObjectURL(item.preview));
    setQueue([]);
    setStatus("idle");
    setErrorMessage(null);
  };

  const noCredits = !unlimited && credits !== null && credits < 2;
  const isMulti = queue.length > 1;
  const busy = status === "processing" || status === "done";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Receipt</h1>
        <p className="text-muted-foreground">
          Upload one image or multiple images of the same receipt — we&apos;ll merge them automatically.
        </p>
        {!unlimited && credits !== null && (
          <div className="flex items-center gap-2 mt-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className={cn("text-sm", noCredits ? "text-destructive font-medium" : "text-muted-foreground")}>
              {noCredits
                ? "Not enough credits to upload."
                : `${credits} credits remaining (2 per receipt)`}
            </span>
          </div>
        )}
      </div>

      <Card className="max-w-2xl">
        <CardContent className="p-6 space-y-5">
          {/* Drop zone — always visible so more files can be added */}
          <label
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors",
              dragActive ? "border-foreground bg-muted" : "border-muted-foreground/25 hover:border-muted-foreground/50",
              busy && "pointer-events-none opacity-50"
            )}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {queue.length === 0 ? "Drop receipt images here" : "Drop more images to add"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse • JPEG, PNG, WebP • Max 10 images • 10 MB each
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = ""; }}
            />
          </label>

          {/* Image queue thumbnails */}
          {queue.length > 0 && (
            <div className="space-y-3">
              {isMulti && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Images className="h-4 w-4" />
                  <span>{queue.length} images — will be merged into one receipt</span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {queue.map(({ file, preview }, i) => (
                  <div key={i} className="relative group rounded-lg border overflow-hidden bg-muted aspect-[3/4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={file.name} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {/* Page number badge */}
                    {isMulti && (
                      <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-xs rounded px-1.5 py-0.5">
                        {i + 1}
                      </span>
                    )}
                    {/* Remove button */}
                    {!busy && (
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs truncate px-2 py-1">
                      {file.name}
                    </p>
                  </div>
                ))}
                {/* Add more tile */}
                {queue.length < MAX_FILES && !busy && (
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 aspect-[3/4] text-muted-foreground hover:text-foreground transition-colors gap-2"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-xs">Add image</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Status messages */}
          {status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isMulti ? `Merging ${queue.length} images and extracting data…` : "Extracting receipt data…"}
            </div>
          )}
          {status === "done" && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Done! Redirecting…
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errorMessage || "Something went wrong."}
            </div>
          )}

          {/* Actions */}
          {queue.length > 0 && (
            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={noCredits || busy}
                className="flex-1"
              >
                {status === "processing" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
                ) : status === "done" ? (
                  "Done"
                ) : isMulti ? (
                  `Upload & Merge ${queue.length} Images`
                ) : (
                  "Upload & Extract"
                )}
              </Button>
              {!busy && (
                <Button variant="outline" onClick={reset}>Clear all</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
