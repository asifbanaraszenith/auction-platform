import { NextResponse } from "next/server";
import { getApps, initializeApp } from "firebase-admin/app";
import { applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
function app(){return getApps()[0]??initializeApp({credential:applicationDefault()});}
export async function GET(request:Request,context:{params:Promise<{auctionId:string}>}){try{const h=request.headers.get("authorization");if(!h?.startsWith("Bearer "))return NextResponse.json({error:"Authentication required."},{status:401});const f=app();const d=await getAuth(f).verifyIdToken(h.slice(7),true);const db=getFirestore(f);const a=await db.collection("auctions").doc((await context.params).auctionId).get();if(!a.exists)return NextResponse.json({error:"Auction not found."},{status:404});const x=a.data()!;if(d.superAdmin!==true&&!(Array.isArray(x.adminIds)&&x.adminIds.includes(d.uid)))return NextResponse.json({error:"Auction administration access is required."},{status:403});const logs=await a.ref.collection("auditLogs").orderBy("createdAt","desc").limit(100).get();return NextResponse.json({logs:logs.docs.map(v=>({id:v.id,...v.data(),createdAtMillis:v.data().createdAt?.toMillis?.()??0}))});}catch(e){console.error(e);return NextResponse.json({error:"Unable to load audit history."},{status:500});}}
