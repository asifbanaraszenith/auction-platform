"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./mobile-navigation.module.css";

export function MobileNavigation({ authenticated, displayName, email, onSignOut }: { authenticated: boolean; displayName?: string | null; email?: string | null; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className={styles.mobileNavigation}>
    <button className={styles.mobileMenuButton} type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}><span /><span /><span /></button>
    {open ? <div className={styles.mobileMenuPanel} role="menu">
      {authenticated ? <div className={styles.accountSection}><span className={styles.accountAvatar} aria-hidden="true">{(displayName ?? email ?? "A").charAt(0).toUpperCase()}</span><div className={styles.accountDetails}><strong>{displayName ?? "Auction Member"}</strong><small>{email ?? "Authenticated account"}</small></div></div> : null}
      {authenticated ? <Link href="/auctions" onClick={() => setOpen(false)}>Auctions</Link> : <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>}
      {authenticated ? <Link href="/participant" onClick={() => setOpen(false)}>Participants</Link> : null}
      {authenticated ? <Link href="/profile" onClick={() => setOpen(false)}>My Profile</Link> : null}
      {authenticated ? <button className={styles.menuAction} type="button" onClick={() => { setOpen(false); onSignOut?.(); }}>Sign Out</button> : null}
    </div> : null}
  </div>;
}
