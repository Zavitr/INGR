"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  X,
  Sparkles,
  Gamepad2,
  Palette,
  MessageSquare,
  Terminal,
  Cpu,
  Database,
  Briefcase,
  Layers,
  Check,
  Zap,
  Share2,
} from "lucide-react";
import {
  searchConnectors,
  getAllConnectorCategories,
  getTotalConnectorCount,
} from "@/lib/recipes/universal-connectors";
import type { UniversalConnector } from "@/lib/recipes/flow-types";

interface ConnectorSpotlightProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (connector: UniversalConnector) => void;
  targetType?: "trigger" | "action";
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Gaming & Esports": <Gamepad2 className="w-3.5 h-3.5" />,
  "Creative & 3D Design": <Palette className="w-3.5 h-3.5" />,
  "Communication": <MessageSquare className="w-3.5 h-3.5" />,
  "Developer & Cloud": <Terminal className="w-3.5 h-3.5" />,
  "AI & Machine Learning": <Cpu className="w-3.5 h-3.5" />,
  "Databases & Storage": <Database className="w-3.5 h-3.5" />,
  "Business & Finance": <Briefcase className="w-3.5 h-3.5" />,
  "Productivity": <Layers className="w-3.5 h-3.5" />,
  "Social & Creators": <Share2 className="w-3.5 h-3.5" />,
};

export function ConnectorSpotlight({
  isOpen,
  onClose,
  onSelect,
  targetType = "action",
}: ConnectorSpotlightProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => ["All", ...getAllConnectorCategories()], []);
  const totalCount = useMemo(() => getTotalConnectorCount(), []);

  // Filter connectors using fast in-memory index
  const results = useMemo(() => {
    return searchConnectors(query, {
      category: selectedCategory === "All" ? undefined : selectedCategory,
      limit: 36,
    });
  }, [query, selectedCategory]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSelectedCategory("All");
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        onSelect(results[selectedIndex]);
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, onSelect, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-card/95 dark:bg-zinc-900/95 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spotlight Top Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border/60 gap-3">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={`Search ${totalCount.toLocaleString()}+ connectors (${targetType === "trigger" ? "Pick Trigger" : "Pick Action"})...`}
            className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground/60 text-foreground"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 hover:bg-muted/60 rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-md border border-border/40 font-mono">
            <span>ESC to close</span>
          </div>
        </div>

        {/* Category Pills Slider */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/40 overflow-x-auto no-scrollbar text-xs bg-muted/30">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedIndex(0);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap transition-all font-medium ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40"
                }`}
              >
                {CATEGORY_ICONS[cat] || <Sparkles className="w-3 h-3" />}
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[420px] overflow-y-auto p-2 space-y-1 divide-y divide-border/20"
        >
          {results.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Zap className="w-8 h-8 stroke-[1.5] text-muted-foreground/40" />
              <p className="text-sm font-medium">No connectors match &quot;{query}&quot;</p>
              <p className="text-xs text-muted-foreground/70">
                Try searching for Discord, Slack, Blender, Minecraft, Clash of Clans, or GitHub.
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={item.name}
                  data-index={idx}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/10 dark:bg-primary/20 border border-primary/30"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    {/* Logo */}
                    <div className="w-9 h-9 rounded-xl bg-background/80 border border-border/60 flex items-center justify-center overflow-hidden shrink-0 shadow-sm p-1">
                      {item.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.logoUrl}
                          alt={item.displayName}
                          className="w-full h-full object-contain rounded"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Sparkles className="w-4 h-4 text-primary" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {item.displayName}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-muted border border-border/50 text-muted-foreground shrink-0">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-md mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isSelected && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-md">
                        Press Enter <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-muted/40 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {results.length} results shown
            </span>
            <span>·</span>
            <span>Total catalog: {totalCount.toLocaleString()} connectors</span>
          </div>
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
