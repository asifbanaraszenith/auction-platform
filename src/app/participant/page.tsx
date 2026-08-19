"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth-provider";
import styles from "./participant.module.css";

type Auction={id:string;name:string;status:string;startAtMillis:number|null;endAtMillis:number|null;categoryName:string;basePrice:number;minimumBasePrice:number;participantStatus:string};
export default function ParticipantPage(){const{user,loading}=useAuth();const router=useRouter();const[auctions,setAuctions]=useState<Auction[]>([]);const[error,setError]=useState("");useEffect(()=>{if(!loading&&user){user.getIdToken(true).then(t=>fetch("/api/me/auctions",{headers:{Authorization:`Bearer ${t}`}})).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setAuctions(d.auctions??[])}).catch(e=>setError(e instanceof Error?e.message:"Unable to load your auctions."));}},[loading,user]);async function logout(){await signOut(getFirebaseAuth());router.replace("/login");}if(loading||!user)return <main className={styles.loading}>Loading…</main>;return <main className={styles.shell}><header className={styles.header}><div><p className={styles.eyebrow}>Participant Portal</p><h1>My Auctions</h1><p>Only auctions in which you are registered are shown here.</p></div><div className={styles.actions}><button onClick={()=>router.push("/profile")}>My Profile</button><button onClick={logout}>Sign Out</button></div></header>{error&&<div className={styles.error}>{error}</div>}{!auctions.length&&!error?<div className={styles.empty}>You are not currently registered in any auctions.</div>:<section className={styles.grid}>{auctions.map(a=><article className={styles.card} key={a.id}><div className={styles.cardTop}><h2>{a.name}</h2><span>{a.participantStatus}</span></div><dl><div><dt>Category</dt><dd>{a.categoryName}</dd></div><div><dt>Base points</dt><dd>{a.basePrice}</dd></div><div><dt>Minimum points</dt><dd>{a.minimumBasePrice}</dd></div><div><dt>Auction status</dt><dd>{a.status}</dd></div></dl></article>)}</section>}</main>}
