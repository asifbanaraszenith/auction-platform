import { NextResponse } from "next/server";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function app() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
export async function GET(request: Request) {
  try {
    const header = request.headers.get("authorization"); if (!header?.startsWith("Bearer ")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const firebase = app(); const decoded = await getAuth(firebase).verifyIdToken(header.slice(7), true); const db = getFirestore(firebase);
    const auctions = await db.collection("auctions").get(); const result = [];
    for (const auction of auctions.docs) {
      const assignment = await auction.ref.collection("bidders").doc(decoded.uid).get(); if (!assignment.exists) continue;
      const a = auction.data(); const b = assignment.data()!;
      const [participantsSnapshot, biddersSnapshot] = await Promise.all([auction.ref.collection("participants").orderBy("createdAt").get(), auction.ref.collection("bidders").orderBy("createdAt").get()]);
      result.push({ id: auction.id, name: a.name, status: a.status, startAtMillis: a.startAt?.toMillis?.() ?? null, endAtMillis: a.endAt?.toMillis?.() ?? null, initialPurse: Number(b.initialPurse ?? 0), bidderStatus: b.status ?? "active", participants: participantsSnapshot.docs.map(doc => ({ id: doc.id, name: String(doc.data().playerName ?? ""), category: String(doc.data().categoryName ?? ""), status: String(doc.data().status ?? "eligible") })), bidders: biddersSnapshot.docs.map(doc => ({ id: doc.id, name: String(doc.data().displayName ?? ""), email: String(doc.data().email ?? ""), status: String(doc.data().status ?? "active") })) });
    }
    return NextResponse.json({ auctions: result });
  } catch (error) { console.error("Bidder auctions failed", error); return NextResponse.json({ error: "Unable to load your bidder auctions." }, { status: 500 }); }
}
