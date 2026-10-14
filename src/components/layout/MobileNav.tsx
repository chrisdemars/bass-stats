"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { NavItem } from "./nav-items";

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid size-9 place-items-center rounded-md text-ink transition-colors hover:bg-surface-2 lg:hidden"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open ? (
        <nav
          id="mobile-nav"
          className="absolute inset-x-0 top-full z-40 border-b border-line bg-elevated shadow-pop lg:hidden"
        >
          <ul className="mx-auto max-w-7xl px-4 py-2">
            {items.map((item) => (
              <li key={item.href} className="border-b border-line-soft last:border-0">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-sm font-medium"
                >
                  {item.label}
                  {item.description ? (
                    <span className="block text-xs font-normal text-muted">
                      {item.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
