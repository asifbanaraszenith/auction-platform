import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function app(){return getApps()[0]??initializeApp({credential:applicationDefault()});}
async function auth(request:Request){const h=request.headers.get("authorization");if(!h?.startsWith("Bearer "))throw new Error("AUTH");const a=app();const decoded=await getAuth(a).verifyIdToken(h.slice(7),true);return{db:getFirestore(a),uid:decoded.uid};}
export async function GET(request:Request){try{const{db,uid}=await auth(request);const players=await db.collection("players").where("userId","==",uid).get();const playerIds=new Set(players.docs.map(d=>d.id));if(!playerIds.size)return NextResponse.json({auctions:[]});const auctions=await db.collection("auctions").get();const result=[];for(const auction of auctions.docs){const a=auction.data();const regs=await auction.ref.collection("participants").get();const match=regs.docs.find(d=>playerIds.has(String(d.data().playerId)));if(!match)continue;const p=match.data();result.push({id:auction.id,name:a.name,status:a.status,startAtMillis:a.startAt?.toMillis?.()??null,endAtMillis:a.endAt?.toMillis?.()??null,categoryName:p.categoryName,basePrice:p.basePrice,minimumBasePrice:p.minimumBasePrice,participantStatus:p.status});}return NextResponse.json({auctions:result});}catch(e){console.error("Participant auctions failed",e);return NextResponse.json({error:"Unable to load your auctions."},{status:500});}}
