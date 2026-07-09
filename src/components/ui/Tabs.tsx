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
  // GALLEY: newspaper section heads — one rule with an uppercase row on top.
  // The `variant` prop is kept for API compatibility; all render as the rule row.
  void variant;
  return (
    <div className={`flex gap-[4ch] border-b border-[var(--color-border-default)] ${className}`}>
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
        relative pb-3 text-xs uppercase tracking-[0.1em] leading-6
        flex items-center gap-[1ch] cursor-pointer bg-transparent
        transition-colors duration-100 ease-linear
        ${isActive
          ? "text-[var(--color-text-primary)] font-bold"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        }
        ${className}
      `}
    >
      {icon && <span className="w-3.5 h-3.5 flex items-center">{icon}</span>}
      {children}
      {count !== undefined && (
        <span className="text-[var(--color-text-muted)]">({count})</span>
      )}
      {isActive && (
        <span className="absolute left-0 right-0 -bottom-px border-b-2 border-[var(--color-accent-500)]" />
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
