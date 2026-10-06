import "server-only";
import { NextResponse } from "next/server";
import { quoteByToken } from "@/data/pharmacyQuotes";
import { fileResponse } from "@/data/files";
import { prisma } from "@/lib/prisma";

/** A pharmacy opens a document attached to the order it was asked about —
 * only through its live quote link, and only that order's documents. */
export async function GET(_request: Request, ctx: RouteContext<"/api/q/[token]/files/[id]">) {
  const { token, id } = await ctx.params;
  const quote = await quoteByToken(token);
  const doc = quote?.order.documents.find((d) => d.file.id === id);
  if (!doc) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const file = await prisma.storedFile.findUniqueOrThrow({ where: { id: doc.file.id } });
  return fileResponse(file);
}
