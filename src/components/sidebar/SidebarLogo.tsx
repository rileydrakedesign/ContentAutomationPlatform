"use client";

import Image from "next/image";
import Link from "next/link";
import { useSidebar } from "./SidebarContext";

const BOX_H = 18;

export function SidebarLogo() {
  const { isCollapsed } = useSidebar();

  const xBox = (
    <div
      className="bg-amber-500 flex items-center justify-center flex-shrink-0 -skew-x-12 overflow-hidden"
      style={{ width: BOX_H, height: BOX_H }}
    >
      <Image
        src="/x-logo.png"
        alt="X"
        width={24}
        height={24}
        className="skew-x-12"
      />
    </div>
  );

  return (
    <div className="px-4 py-4 border-b border-slate-800">
      <Link href="/" className="flex items-end gap-0.5">
        {isCollapsed ? (
          xBox
        ) : (
          <>
            <div
              className="overflow-hidden flex-shrink-0"
              style={{ height: BOX_H }}
            >
              <span
                className="font-extrabold text-white uppercase tracking-tight whitespace-nowrap block"
                style={{ fontSize: 24, lineHeight: 1, marginTop: -4 }}
              >
                Agent For
              </span>
            </div>
            {xBox}
          </>
        )}
      </Link>
    </div>
  );
}
