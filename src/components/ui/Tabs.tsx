"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue = "",
  value,
  onValueChange,
  children,
  className = "",
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (tab: string) => {
    if (onValueChange) {
      onValueChange(tab);
    } else {
      setInternalValue(tab);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "pills" | "underline";
}

export function TabsList({ children, className = "", variant = "default" }: TabsListProps) {
  const variantStyles = {
    default: "inline-flex gap-1 bg-[var(--color-bg-surface)] p-1 rounded-xl border border-[var(--color-border-subtle)]",
    pills: "inline-flex gap-2",
    underline: "inline-flex gap-6 border-b border-[var(--color-border-default)]",
  };

  return (
    <div className={`${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
  count?: number;
  icon?: ReactNode;
}

export function TabsTrigger({ value, children, className = "", count, icon }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`
        px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
        flex items-center gap-2 cursor-pointer
        ${isActive
          ? "bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-glow-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
        }
        ${className}
      `}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
      {count !== undefined && (
        <span
          className={`
            text-xs px-2 py-0.5 rounded-full font-medium
            ${isActive
              ? "bg-white/20 text-white"
              : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
            }
          `}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className = "" }: TabsContentProps) {
  const { activeTab } = useTabs();

  if (activeTab !== value) {
    return null;
  }

  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}
