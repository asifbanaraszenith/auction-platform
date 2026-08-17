"use client";

import Link from "next/link";
import { useState } from "react";

export function MobileNavigation({ authenticated }: { authenticated: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-navigation">
      <button
        className="mobile-menu-button"
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="mobile-menu-panel">
          <Link href="/" onClick={() => setOpen(false)}>Home</Link>
          {authenticated ? (
            <Link href="/auctions" onClick={() => setOpen(false)}>Auctions</Link>
          ) : (
            <span aria-disabled="true">Auctions</span>
          )}
          <span>Profile</span>
          <span>Settings</span>
        </div>
      ) : null}
    </div>
  );
}
