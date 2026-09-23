"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { createParticipantAccount, listPlayers, updateParticipant } from "@/lib/participants/repository";
import type { Player } from "@/lib/auctions/types";
import styles from "./participant.module.css";

type Auction = { id: string; name: string; status: string; categoryName?: string; basePrice?: number; minimumBasePrice?: number; participantStatus?: string };

export default function ParticipantPage() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [roles,setRoles]=useState<string[]>([]); const [auctions,setAuctions]=useState<Auction[]>([]); const [participants,setParticipants]=useState<Player[]>([]);
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [photo,setPhoto]=useState<File|null>(null);
  const [edit,setEdit]=useState<Player|null>(null); const [editName,setEditName]=useState(""); const [editEmail,setEditEmail]=useState(""); const [editPhoto,setEditPhoto]=useState<File|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
  const canManage=roles.includes("superAdmin")||roles.includes("auctionAdmin"); const isParticipant=roles.includes("participant"); const isSuperAdmin=roles.includes("superAdmin");

  const refreshParticipants=useCallback(async()=>{if(!user)return;const data=await listPlayers(user);setParticipants(data);},[user]);
  useEffect(()=>{if(loading)return;if(!user){router.replace("/login");return;}void(async()=>{try{const token=await user.getIdToken(true);const me=await fetch("/api/me",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const profile=await me.json();if(!me.ok)throw new Error(profile.error);const next=Array.isArray(profile.roles)?profile.roles:[];setRoles(next);if(next.includes("participant")){const r=await fetch("/api/me/auctions",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error(p.error);setAuctions(p.auctions??[]);}if(next.includes("superAdmin")||next.includes("auctionAdmin"))await refreshParticipants();}catch(e){setError(e instanceof Error?e.message:"Unable to load participants.");}})();},[loading,user,router,refreshParticipants]);

  async function createAccount(){if(!user)return;setError("");setNotice("");if(!name.trim()||!email.trim()){setError("Name and email are required.");return;}setBusy(true);try{const result=await createParticipantAccount(user,{name:name.trim(),email:email.trim(),photo});setName("");setEmail("");setPhoto(null);await refreshParticipants();setNotice(`Participant account created. Temporary password: ${result.temporaryPassword}`);}catch(e){setError(e instanceof Error?e.message:"Unable to create participant account.");}finally{setBusy(false);}}
  function openEdit(p:Player){setEdit(p);setEditName(p.displayName);setEditEmail(p.email??"");setEditPhoto(null);setError("");setNotice("");}
  async function saveEdit(){if(!user||!edit)return;if(!editName.trim()||!editEmail.trim()){setError("Name and email are required.");return;}setBusy(true);setError("");try{await updateParticipant(user,{playerId:edit.id,displayName:editName.trim(),email:editEmail.trim(),photo:editPhoto});await refreshParticipants();setEdit(null);setNotice("Participant updated successfully.");}catch(e){setError(e instanceof Error?e.message:"Unable to update participant.");}finally{setBusy(false);}}
  async function logout(){await signOut(getFirebaseAuth());router.replace("/login");}

  if(loading||!user)return <main className={styles.loading}>Loading…</main>;
  return <main className={styles.shell}><header className={styles.header}><div><p className={styles.eyebrow}>{isParticipant?"Participant Portal":"Participant Management"}</p><h1>{isParticipant?"My Auctions":"Participants"}</h1><p>{isParticipant?"Only auctions in which you are registered are shown here.":"Manage the participant directory and see each participant's auction assignments."}</p></div><div className={styles.actions}><button onClick={()=>router.push("/profile")}>My Profile</button><button onClick={logout}>Sign Out</button></div></header>{error&&<div className={styles.error}>{error}</div>}{notice&&<div className={styles.notice}>{notice}</div>}
  {isParticipant?<section className={styles.grid}>{auctions.length?auctions.map(a=><article className={styles.card} key={a.id}><div className={styles.cardTop}><h2>{a.name}</h2><span>{a.participantStatus??"assigned"}</span></div><dl>{a.categoryName&&<div><dt>Category</dt><dd>{a.categoryName}</dd></div>}<div><dt>Auction status</dt><dd>{a.status}</dd></div></dl></article>):<div className={styles.empty}>You are not currently registered in any auctions.</div>}</section>
  :canManage?<><section className={styles.card}><div><p className={styles.eyebrow}>New Participant</p><h2>Create participant account</h2><p>Create a registered participant account.</p></div><div className={styles.form}><label>NAME<input value={name} onChange={e=>setName(e.target.value)}/></label><label>EMAIL ADDRESS<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>PROFILE PICTURE <span>(optional)</span><input type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0]??null)}/></label></div><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>void createAccount()}>{busy?"CREATING…":"CREATE PARTICIPANT"}</button></div></section>
  <section className={styles.grid}>{participants.map(p=><article className={styles.card} key={p.id}><div className={styles.cardTop}><div><h2>{p.displayName}</h2><p>{p.email||"No email available"}</p></div>{isSuperAdmin&&<button className={styles.secondary} onClick={()=>openEdit(p)}>EDIT</button>}</div><div className={styles.metaLine}><strong>Auctions</strong><span>{p.auctions?.length?p.auctions.map(a=>a.auctionName).join(", "):"Not assigned to an auction"}</span></div></article>)}</section>
  {edit&&<div className={styles.dialogBackdrop}><div className={styles.dialog}><div className={styles.dialogHeader}><div><p className={styles.eyebrow}>Participant</p><h2>Edit participant</h2></div><button className={styles.closeButton} onClick={()=>setEdit(null)}>×</button></div><div className={styles.form}><label>NAME<input value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>EMAIL ADDRESS<input type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)}/></label><label>PROFILE PICTURE <span>(optional — choose only to replace)</span><input type="file" accept="image/*" onChange={e=>setEditPhoto(e.target.files?.[0]??null)}/></label></div><div className={styles.actions}><button className={styles.secondary} onClick={()=>setEdit(null)}>CANCEL</button><button className={styles.primary} disabled={busy} onClick={()=>void saveEdit()}>{busy?"SAVING…":"SAVE CHANGES"}</button></div></div></div>}</>:<div className={styles.empty}>You do not have participant-management access.</div>}</main>;
}
