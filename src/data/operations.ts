import "server-only";
import { prisma } from "@/lib/prisma";
import type { NoteAttachmentInput, ProviderVisitInput } from "@/lib/validation/operations";

export async function addProviderVisit(input: ProviderVisitInput, actorId: string) {
  const { documentUrlsRaw, ...rest } = input;
  const documentUrls = documentUrlsRaw
    ? documentUrlsRaw
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean)
    : [];

  return prisma.providerVisit.create({
    data: { ...rest, documentUrls, createdBy: actorId, updatedBy: actorId },
  });
}

export async function deleteProviderVisit(id: string) {
  return prisma.providerVisit.delete({ where: { id } });
}

export async function addNoteAttachment(input: NoteAttachmentInput, actorId: string) {
  return prisma.noteAttachment.create({
    data: { ...input, ownerId: actorId, createdBy: actorId, updatedBy: actorId },
  });
}

export async function deleteNoteAttachment(id: string) {
  return prisma.noteAttachment.delete({ where: { id } });
}
