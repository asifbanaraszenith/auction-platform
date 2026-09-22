import { NextResponse } from "next/server";
import { getApps, initializeApp } from "firebase-admin/app";
import { applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function app() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
async function authorize(request: Request, auctionId: string) {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) throw new Error("AUTH");
  const firebase = app();
  const decoded = await getAuth(firebase).verifyIdToken(h.slice(7), true);
  const db = getFirestore(firebase);
  const auction = await db.collection("auctions").doc(auctionId).get();
  if (!auction.exists) throw new Error("NOT_FOUND");
  const data = auction.data()!;
  const admin = decoded.superAdmin === true || (Array.isArray(data.adminIds) && data.adminIds.includes(decoded.uid));
  if (!admin) throw new Error("FORBIDDEN");
  return { db, auction };
}
function fail(e: unknown) {
  const m=e instanceof Error?e.message:"ERROR";
  const s=m==="AUTH"?401:m==="FORBIDDEN"?403:m==="NOT_FOUND"?404:500;
  return NextResponse.json({error:s===401?"Authentication required.":s===403?"Auction administration access is required.":s===404?"Auction not found.":"Unable to manage teams."},{status:s});
}
export async function GET(request: Request, context:{params:Promise<{auctionId:string}>}) {
  try { const {auction}=await authorize(request,(await context.params).auctionId); const snap=await auction.ref.collection("teams").orderBy("createdAt").get();
    return NextResponse.json({teams:snap.docs.map(d=>({id:d.id,...d.data(),initialPurse:Number(d.data().initialPurse??0),spentPurse:Number(d.data().spentPurse??0),minSquadSize:Number(d.data().minSquadSize??0),maxSquadSize:Number(d.data().maxSquadSize??0)}))});
  } catch(e){return fail(e);}
}
export async function POST(request:Request,context:{params:Promise<{auctionId:string}>}) {
  try { const {db,auction}=await authorize(request,(await context.params).auctionId); const b=await request.json(); const name=typeof b.name==="string"?b.name.trim():""; const initialPurse=Number(b.initialPurse); const minSquadSize=Number(b.minSquadSize??0); const maxSquadSize=Number(b.maxSquadSize??20);
    if(!name) return NextResponse.json({error:"Team name is required."},{status:400});
    if(!Number.isFinite(initialPurse)||initialPurse<0) return NextResponse.json({error:"Initial purse must be non-negative."},{status:400});
    if(!Number.isInteger(minSquadSize)||minSquadSize<0||!Number.isInteger(maxSquadSize)||maxSquadSize<minSquadSize) return NextResponse.json({error:"Invalid squad limits."},{status:400});
    const dup=await auction.ref.collection("teams").where("name","==",name).limit(1).get(); if(!dup.empty) return NextResponse.json({error:"A team with this name already exists."},{status:409});
    const bidderId=typeof b.bidderId==="string"&&b.bidderId.trim()?b.bidderId.trim():null;
    if(bidderId){const x=await auction.ref.collection("bidders").doc(bidderId).get();if(!x.exists)return NextResponse.json({error:"Selected bidder assignment does not exist."},{status:400});}
    const now=Timestamp.now(); const ref=auction.ref.collection("teams").doc(); await ref.set({name, bidderId, initialPurse, spentPurse:0, minSquadSize, maxSquadSize, active:true, createdAt:now, updatedAt:now});
    return NextResponse.json({id:ref.id},{status:201});
  } catch(e){return fail(e);}
}
export async function PATCH(request:Request,context:{params:Promise<{auctionId:string}>}) {
  try { const {auction}=await authorize(request,(await context.params).auctionId); const b=await request.json(); const id=String(b.teamId??"").trim(); if(!id)return NextResponse.json({error:"Team is required."},{status:400});
    const ref=auction.ref.collection("teams").doc(id); const snap=await ref.get(); if(!snap.exists)return NextResponse.json({error:"Team not found."},{status:404}); const cur=snap.data()!;
    const update:Record<string,unknown>={updatedAt:Timestamp.now()};
    if(b.name!==undefined){const name=String(b.name).trim();if(!name)return NextResponse.json({error:"Team name is required."},{status:400});update.name=name;}
    if(b.bidderId!==undefined){const bidderId=b.bidderId?String(b.bidderId).trim():null;if(bidderId){const x=await auction.ref.collection("bidders").doc(bidderId).get();if(!x.exists)return NextResponse.json({error:"Bidder assignment does not exist."},{status:400});}update.bidderId=bidderId;}
    if(b.initialPurse!==undefined){const n=Number(b.initialPurse);if(!Number.isFinite(n)||n<Number(cur.spentPurse??0))return NextResponse.json({error:"Initial purse cannot be below spent purse."},{status:400});update.initialPurse=n;}
    if(b.minSquadSize!==undefined)update.minSquadSize=Math.max(0,Math.floor(Number(b.minSquadSize)));
    if(b.maxSquadSize!==undefined)update.maxSquadSize=Math.max(0,Math.floor(Number(b.maxSquadSize)));
    if(b.active!==undefined)update.active=Boolean(b.active);
    await ref.update(update); return NextResponse.json({ok:true});
  } catch(e){return fail(e);}
}
export async function DELETE(request:Request,context:{params:Promise<{auctionId:string}>}) {
  try {const {auction}=await authorize(request,(await context.params).auctionId);const id=new URL(request.url).searchParams.get("teamId")?.trim();if(!id)return NextResponse.json({error:"Team is required."},{status:400});const ref=auction.ref.collection("teams").doc(id);if(!(await ref.get()).exists)return NextResponse.json({error:"Team not found."},{status:404});const bidders=await auction.ref.collection("bidders").where("teamId","==",id).limit(1).get();if(!bidders.empty)return NextResponse.json({error:"Remove the team assignment from its bidder before deleting the team."},{status:409});await ref.delete();return NextResponse.json({ok:true});}catch(e){return fail(e);}
}