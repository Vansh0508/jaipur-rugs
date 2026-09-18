"use client";

import React from "react";
import { Download, Database, ShieldCheck, BookOpen, RefreshCw, Settings, Layers } from "lucide-react";
import { Button, Chip, Dropdown } from "@heroui/react";

interface NavbarProps {
  isLive: boolean;
  isMssqlConfigured: boolean;
  benchmarkCount: number;
  onExport: () => void;
  onRefresh: () => void;
  onOpenBenchmarks: () => void;
  userEmail?: string;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isLive,
  isMssqlConfigured,
  benchmarkCount,
  onExport,
  onRefresh,
  onOpenBenchmarks,
  userEmail = "dnd.auditor@company.com",
  isRefreshing = false,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/80 bg-white/95 backdrop-blur shadow-xs">
      <div className="max-w-[96%] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
        {/* Brand & Title (Cleaned up - no corporate name) */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B1E1E] flex items-center justify-center text-white shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-serif font-bold text-lg tracking-tight text-stone-900">
                BOM Management
              </span>
              <Chip color="warning" variant="soft" size="sm" className="font-semibold text-xs h-5">
                D&D Portal
              </Chip>
            </div>
            <p className="text-xs text-stone-500 font-medium">
              Quality & Transfer Anomaly Audit System
            </p>
          </div>
        </div>

        {/* Action Controls & Gear-based Settings Dropdown */}
        <div className="flex items-center space-x-3">
          {/* Primary Export Action */}
          <Button
            variant="primary"
            size="sm"
            onClick={onExport}
            className="flex items-center space-x-1.5 bg-[#8B1E1E] text-white hover:bg-[#741818] shadow-xs cursor-pointer font-semibold h-9 px-3.5 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Discrepancies</span>
          </Button>

          {/* Clean Hero UI Gear-based Settings & Configurations Dropdown */}
          <Dropdown>
            <Button
              variant="secondary"
              size="sm"
              isIconOnly
              aria-label="Settings and configurations"
              className="w-9 h-9 rounded-lg border border-stone-200 bg-stone-50 text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer transition flex items-center justify-center"
            >
              <Settings className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#8B1E1E]" : ""}`} />
            </Button>
            <Dropdown.Popover className="w-80 shadow-xl border border-stone-200 rounded-xl p-1 bg-white">
              <Dropdown.Menu
                aria-label="Settings and Configurations"
                onAction={(key) => {
                  if (key === "benchmarks") onOpenBenchmarks();
                  if (key === "refresh") onRefresh();
                }}
              >
                <Dropdown.Section>
                  {/* Section Title */}
                  <Dropdown.Item id="header-label" textValue="Configurations" className="pointer-events-none opacity-60">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      System & Database Settings
                    </span>
                  </Dropdown.Item>

                  {/* Database Status Item */}
                  <Dropdown.Item id="connection" textValue="Database Status">
                    <div className="flex items-center justify-between w-full py-1.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-stone-600">
                          <Database className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-semibold text-stone-900 block">
                            MS SQL Database
                          </span>
                          <span className="text-[10px] text-stone-500 block font-mono">
                            View: NAV-004 Details
                          </span>
                        </div>
                      </div>
                      <Chip
                        color={isLive ? "success" : isMssqlConfigured ? "warning" : "default"}
                        variant="soft"
                        size="sm"
                        className="text-[10px] h-5 font-semibold"
                      >
                        {isLive ? "Live" : isMssqlConfigured ? "Connecting" : "Demo Data"}
                      </Chip>
                    </div>
                  </Dropdown.Item>

                  {/* Benchmarks Master Item */}
                  <Dropdown.Item id="benchmarks" textValue="Benchmark Master">
                    <div className="flex items-center justify-between w-full py-1.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-[#8B1E1E]">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-semibold text-stone-900 block">
                            Design Benchmarks
                          </span>
                          <span className="text-[10px] text-stone-500 block">
                            Final Sheet Data
                          </span>
                        </div>
                      </div>
                      <Chip color="accent" variant="soft" size="sm" className="text-[10px] h-5 font-bold">
                        {benchmarkCount} Prefixes
                      </Chip>
                    </div>
                  </Dropdown.Item>

                  {/* Sync / Refresh Action */}
                  <Dropdown.Item id="refresh" textValue="Sync with ERP">
                    <div className="flex items-center justify-between w-full py-1.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-stone-600">
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#8B1E1E]" : ""}`} />
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-semibold text-stone-900 block">
                            Force ERP Sync
                          </span>
                          <span className="text-[10px] text-stone-500 block">
                            Refresh live BOM records
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#8B1E1E] font-semibold">Sync Now</span>
                    </div>
                  </Dropdown.Item>

                  {/* User Session Info */}
                  <Dropdown.Item id="user" textValue="User Session" className="border-t border-stone-100 mt-1 pt-2">
                    <div className="flex items-center justify-between w-full py-1">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-semibold text-stone-900 block truncate max-w-[140px]">
                            {userEmail}
                          </span>
                          <span className="text-[10px] text-stone-500 block">
                            Role: D&D Auditor
                          </span>
                        </div>
                      </div>
                      <Chip color="success" variant="soft" size="sm" className="text-[10px] h-4.5 font-semibold">
                        Whitelisted
                      </Chip>
                    </div>
                  </Dropdown.Item>
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>
    </header>
  );
};
