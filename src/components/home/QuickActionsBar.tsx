"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Plus, Upload } from "lucide-react";

interface QuickActionsBarProps {
  onUploadClick: () => void;
}

export function QuickActionsBar({ onUploadClick }: QuickActionsBarProps) {
  return (
    <div className="flex items-center gap-3">
      <Link href="/create">
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          glow
        >
          Create Draft
        </Button>
      </Link>
      <Button
        variant="secondary"
        size="sm"
        icon={<Upload className="w-4 h-4" />}
        onClick={onUploadClick}
      >
        Upload CSV
      </Button>
    </div>
  );
}
