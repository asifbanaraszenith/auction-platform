"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./mobile-navigation.module.css";

export function MobileNavigation({authenticated,roles,displayName,email,onSignOut}:{authenticated:boolean;roles?:string[];displayName?:string|null;email?:string|null;onSignOut?:()=>void}) {
  const [open,setOpen]=useState(false);
  const canManage=roles?.includes("superAdmin")||roles?.includes("auctionAdmin");
  const isParticipant=roles?.includes("participant");
  const isBidder=roles?.includes("bidder");
  const isSuper=roles?.includes("superAdmin");
  return <div className={styles.mobileNavigation}><button className={styles.mobileMenuButton} type="button" aria-label={open?"Close navigation menu":"Open navigation menu"} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span/><span/><span/></button>{open&&<div className={styles.mobileMenuPanel} role="menu">{authenticated&&<div className={styles.accountSection}><span className={styles.accountAvatar}>{(displayName??email??"A").charAt(0).toUpperCase()}</span><div className={styles.accountDetails}><strong>{displayName??"Auction Member"}</strong><small>{email??"Authenticated account"}</small></div></div>}{!authenticated&&<Link href="/login" onClick={()=>setOpen(false)}>Sign in</Link>}{authenticated&&canManage&&<Link href="/auctions" onClick={()=>setOpen(false)}>Auctions</Link>}{authenticated&&canManage&&<Link href="/participant" onClick={()=>setOpen(false)}>Participants</Link>}{authenticated&&canManage&&<Link href="/auctions" onClick={()=>setOpen(false)}>Auction Setup</Link>}{authenticated&&isBidder&&<Link href="/bidder" onClick={()=>setOpen(false)}>Bidding</Link>}{authenticated&&isParticipant&&<Link href="/participant" onClick={()=>setOpen(false)}>My Auctions</Link>}{authenticated&&isSuper&&<Link href="/admin" onClick={()=>setOpen(false)}>Administration</Link>}{authenticated&&<Link href="/profile" onClick={()=>setOpen(false)}>My Profile</Link>}{authenticated&&<button className={styles.menuAction} type="button" onClick={()=>{setOpen(false);onSignOut?.();}}>Sign Out</button>}</div>}</div>;
}