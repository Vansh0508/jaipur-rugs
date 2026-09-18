"use client";

import React, { useState } from "react";
import { Button, Chip } from "@heroui/react";
import {
  Sparkles,
  Copy,
  Check,
  X,
  AlertTriangle,
  Layers,
  ArrowRight,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboardCopy";

interface NextNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefix: string;
  quality: string;
  construction: string;
  sampleCode: string;
  highestKnownSuffix?: string | null;
  suggestedCode: string;
  note: string;
}

export const NextNumberModal: React.FC<NextNumberModalProps> = ({
  isOpen,
  onClose,
  prefix,
  quality,
  construction,
  sampleCode,
  highestKnownSuffix,
  suggestedCode,
  note,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(suggestedCode, suggestedCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-5 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Background accent glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-title" className="text-base font-bold text-foreground">
                Next Available Design Code
              </h3>
              <p className="text-xs text-muted">
                Sequential extension for series{" "}
                <span className="font-mono font-bold text-foreground">{prefix}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Suggested Code Hero Box */}
        <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/80 bg-blue-50/50 dark:bg-blue-950/30 p-4 text-center space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">
            Suggested Next Number
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">
              {suggestedCode}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              className="h-8 px-2.5 rounded-lg border border-border bg-surface text-xs font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-muted" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
          {highestKnownSuffix && (
            <div className="text-[11px] text-muted">
              Highest recorded sample suffix:{" "}
              <code className="font-mono font-semibold text-foreground">
                {highestKnownSuffix}
              </code>
            </div>
          )}
        </div>

        {/* Metadata Specs Table */}
        <div className="rounded-xl border border-border bg-surface-secondary/40 p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted">Construction</span>
            <span className="font-semibold text-foreground">{construction || "Hand Knotted"}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted">Quality</span>
            <span className="font-medium text-foreground">{quality || "—"}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted">Reference Sample</span>
            <span className="font-mono text-foreground font-semibold">
              {sampleCode || "—"}
            </span>
          </div>
        </div>

        {/* Caution Advisory Notice */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/40 p-3 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Important: </span>
            <span>
              {note ||
                "This master file records one sample number per prefix. Cross-verify this suggested code against Sudesh's live sheet to ensure no previously issued code is duplicated."}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold px-4 cursor-pointer"
          >
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCopy}
            className="text-xs font-semibold px-4 cursor-pointer flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Code</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
