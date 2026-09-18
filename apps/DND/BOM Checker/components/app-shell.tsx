"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  AlertTriangle,
  ShoppingBag,
  Layers,
  Database,
  RefreshCw,
  Download,
  ShieldCheck,
  PanelLeft,
  Menu,
  X,
  LogOut,
  Tag,
} from "lucide-react";
import { Button, Chip, Typography } from "@heroui/react";

export type NavTab = "dashboard" | "benchmarks" | "discrepancies" | "orders" | "rug-boms" | "design-series";

interface AppShellProps {
  children: React.ReactNode;
  currentTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
  isLive?: boolean;
  isMssqlConfigured?: boolean;
  benchmarkCount?: number;
  discrepancyCount?: number;
  totalLinesCount?: number;
  isRefreshing?: boolean;
  onExport?: () => void;
  onRefresh?: () => void;
  onOpenBenchmarks?: () => void;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentTab = "dashboard",
  onTabChange,
  isLive = false,
  isMssqlConfigured = false,
  benchmarkCount = 0,
  discrepancyCount = 0,
  totalLinesCount = 0,
  isRefreshing = false,
  onExport,
  onRefresh,
  onOpenBenchmarks,
  userEmail = "dnd.auditor@company.com",
  userName = "D&D Auditor",
  userRole = "Auditor",
  onSignOut,
}) => {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile popup when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfilePopupOpen(false);
      }
    };
    if (profilePopupOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [profilePopupOpen]);

  const initialLetter = (userName || userEmail || "A").trim().charAt(0).toUpperCase();

  const handleNavClick = (tab: NavTab) => {
    if (tab === "orders") {
      router.push("/orders");
    } else if (tab === "rug-boms") {
      router.push("/rug-boms");
    } else if (tab === "design-series") {
      router.push("/design-series");
    } else {
      if (onTabChange) {
        onTabChange(tab);
      } else {
        router.push(tab === "dashboard" ? "/" : `/?tab=${tab}`);
      }
    }
    setMobileMenuOpen(false);
  };

  const navItems = [
    {
      id: "dashboard" as NavTab,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "design-series" as NavTab,
      label: "Design Series",
      icon: Tag,
    },
    {
      id: "rug-boms" as NavTab,
      label: "Rug & BOMs",
      icon: Layers,
    },
    {
      id: "orders" as NavTab,
      label: "Orders",
      icon: ShoppingBag,
    },
    {
      id: "discrepancies" as NavTab,
      label: "Discrepancies",
      icon: AlertTriangle,
    },
    {
      id: "benchmarks" as NavTab,
      label: "Benchmarks",
      icon: BookOpen,
    },
  ];

  return (
    // Outer canvas matching reference: soft light grey background
    <div className="h-screen w-screen overflow-hidden bg-[#f4f5f7] flex p-2.5 sm:p-3 gap-2.5 sm:gap-3 selection:bg-stone-200 selection:text-stone-900 font-sans">
      {/* Desktop Left Sidebar (Floating on the light grey canvas) */}
      <aside
        className={`hidden md:flex flex-col bg-transparent transition-all duration-300 z-30 select-none shrink-0 ${
          isCollapsed ? "w-14" : "w-52"
        }`}
      >
        {/* Top Header: Small Dark Brand Pill + Sidebar Toggle (Exact reference match) */}
        <div
          className={`h-12 flex items-center px-1 shrink-0 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!isCollapsed && (
            <div className="flex items-center px-1">
              <img
                src="https://d16n7e76tyykgs.cloudfront.net/jrc2021/assets/v2/master/img/svg/jr-new-logo1.svg"
                alt="Jaipur Rugs"
                className="h-6 w-auto object-contain max-w-[130px]"
              />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle sidebar"
            className="text-stone-500 hover:text-stone-900 hover:bg-stone-200/70 p-1.5 rounded-lg cursor-pointer transition"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items (Active link is a clean white card matching reference screenshot!) */}
        <div className="flex-1 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-xl py-2 px-2.5 text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200/80 font-semibold"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/50"
                } ${isCollapsed ? "justify-center" : "justify-between"}`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-stone-900" : "text-stone-500"
                    }`}
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Area: User Profile Trigger */}
        <div className="pt-2 border-t border-stone-200/70 shrink-0 relative" ref={profileRef}>

          {/* Profile Popup Menu (shown upon clicking profile icon) */}
          {profilePopupOpen && (
            <div
              className="absolute bottom-full mb-2.5 left-0 w-64 bg-white border border-stone-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              {/* User Email & Name */}
              <div className="pb-2.5 border-b border-stone-100">
                <div className="text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-0.5">
                  Signed in as
                </div>
                <div className="text-xs font-semibold text-stone-900 truncate" title={userEmail}>
                  {userEmail}
                </div>
                {userName && userName !== userEmail && (
                  <div className="text-[11px] text-stone-500 truncate mt-0.5">
                    {userName}
                  </div>
                )}
              </div>

              {/* Red Sign Out action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfilePopupOpen(false);
                    setShowSignOutConfirm(true);
                  }}
                  className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Profile Icon Only (Username and email hidden outside popup) */}
          <div className="flex items-center pt-0.5">
            <button
              type="button"
              onClick={() => setProfilePopupOpen(!profilePopupOpen)}
              title="Account Settings"
              className={`w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-2xs hover:ring-2 hover:ring-stone-400 hover:scale-105 active:scale-95 transition cursor-pointer ${
                profilePopupOpen ? "ring-2 ring-stone-900 scale-105" : ""
              }`}
            >
              {initialLetter}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-64 bg-[#f4f5f7] h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center">
                <img
                  src="https://d16n7e76tyykgs.cloudfront.net/jrc2021/assets/v2/master/img/svg/jr-new-logo1.svg"
                  alt="Jaipur Rugs"
                  className="h-6 w-auto object-contain max-w-[130px]"
                />
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-stone-500 hover:text-stone-900 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-1 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between rounded-xl py-2 px-3 text-xs font-semibold ${
                      isActive
                        ? "bg-white text-stone-900 shadow-xs border border-stone-200/80"
                        : "text-stone-700 hover:bg-stone-200/60"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mobile Drawer Footer: Profile Icon Only */}
            <div className="pt-3 border-t border-stone-200 relative">
              {profilePopupOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-60 bg-white border border-stone-200/90 rounded-2xl shadow-xl p-3.5 z-50">
                  <div className="pb-2.5 border-b border-stone-100">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-0.5">
                      Signed in as
                    </div>
                    <div className="text-xs font-semibold text-stone-900 truncate">
                      {userEmail}
                    </div>
                    {userName && userName !== userEmail && (
                      <div className="text-[11px] text-stone-500 truncate mt-0.5">
                        {userName}
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProfilePopupOpen(false);
                        setMobileMenuOpen(false);
                        setShowSignOutConfirm(true);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setProfilePopupOpen(!profilePopupOpen)}
                  className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs select-none shadow-2xs hover:ring-2 hover:ring-stone-400 transition cursor-pointer"
                >
                  {initialLetter}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 
        The Pure White Content Panel (Matches the large white container in reference):
        - Rounded-2xl corners
        - Soft shadow on left side
        - Pure white background
        - Internal scrollable area
      */}
      <div className="flex-1 h-full min-w-0 bg-white rounded-2xl border border-stone-200/80 shadow-[-8px_0px_24px_rgba(0,0,0,0.06),0px_2px_12px_rgba(0,0,0,0.03)] flex flex-col overflow-hidden">
        {/* Mobile Header Bar Toggle */}
        <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-stone-100 bg-white shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-stone-600 p-1 rounded-lg hover:bg-stone-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold text-stone-800">BOM Quality Audit</span>
          <div className="w-5" />
        </div>

        {/* Main Canvas */}
        <main className="flex-1 w-full p-4 sm:p-5 flex flex-col min-h-0 overflow-hidden bg-white">
          {children}
        </main>
      </div>

      {/* Final Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setShowSignOutConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl border border-stone-200/90 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <LogOut className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-stone-900">
                  Confirm Sign Out
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Are you sure you want to sign out of the BOM Quality Audit console?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSignOutConfirm(false);
                  if (onSignOut) {
                    onSignOut();
                  }
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-xs transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
