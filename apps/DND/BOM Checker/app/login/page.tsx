"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Database,
  Sparkles,
  Loader2,
  Info,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  // Check if Supabase env vars are present
  useEffect(() => {
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasKey =
      !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    setIsConfigured(hasUrl && hasKey);

    // If already logged in, redirect to home
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push("/");
      }
    });
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    if (!isConfigured) {
      setErrorMessage(
        "Supabase credentials are not yet configured in .env.local. Please provide NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        setSuccessMessage("Authentication successful! Loading dashboard...");
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#f4f5f7] flex flex-col justify-center items-center p-4 sm:p-6 font-sans select-none">
      {/* Background Subtle Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-40">
        <div className="w-[600px] h-[600px] bg-stone-300/40 rounded-full blur-3xl" />
        <div className="w-[450px] h-[450px] bg-amber-100/30 rounded-full blur-3xl -translate-y-20 translate-x-32" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Top Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            BOM Management System
          </h1>
        </div>

        {/* Configuration Notice (if .env.local is missing Supabase keys) */}
        {!isConfigured && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start space-x-3 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Supabase Keys Required</span>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Add your Supabase URL & Anon Key to{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px] font-medium">
                  .env.local
                </code>{" "}
                to activate live authentication.
              </p>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 sm:p-8 space-y-5">
          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-800 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="name@jaipurrugs.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-stone-50/70 border border-stone-200 rounded-xl focus:outline-hidden focus:border-stone-400 focus:bg-white focus:ring-2 focus:ring-stone-200/50 transition placeholder:text-stone-400 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-xs bg-stone-50/70 border border-stone-200 rounded-xl focus:outline-hidden focus:border-stone-400 focus:bg-white focus:ring-2 focus:ring-stone-200/50 transition placeholder:text-stone-400 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 active:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-stone-300" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Audit Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Bottom Credits / Org */}
        <div className="mt-6 text-center text-[11px] text-stone-400 space-x-1">
          <span>Jaipur Rugs Company Pvt. Ltd.</span>
          <span>•</span>
          <span>Design & Development BOM Audit</span>
        </div>
      </div>
    </div>
  );
}
