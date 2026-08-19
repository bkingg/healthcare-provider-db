import "server-only";
import { prisma } from "@/lib/prisma";
import { ApprovalStatus, AuditAction } from "@/lib/enums";
import { writeAudit } from "./audit";
import type { BankingPaymentInput, RateInput } from "@/lib/validation/financial";
import type { User } from "../../generated/prisma/client";

// TODO(Phase 5): replace with real role checks (Finance role) once RBAC lands.
// Structured as functions now, called from every banking read/write path
// below and from the profile page's banking section, so Phase 5 only needs
// to change these two bodies.
export function canViewBanking(actor: User): boolean {
  void actor;
  return true;
}

export function canManageBanking(actor: User): boolean {
  void actor;
  return true;
}

export function getPaymentType(id: string) {
  return prisma.paymentTypeRef.findUnique({ where: { id } });
}

export async function addBankingPayment(input: BankingPaymentInput, actorId: string) {
  const { countrySpecificFieldsRaw, ...rest } = input;
  const payment = await prisma.bankingPayment.create({
    data: {
      ...rest,
      countrySpecificFields: countrySpecificFieldsRaw ? JSON.parse(countrySpecificFieldsRaw) : undefined,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
  await writeAudit({ entityType: "BankingPayment", entityId: payment.id, action: AuditAction.CREATE, actorId });
  return payment;
}

export async function approveBankingPayment(id: string, actorId: string) {
  const existing = await prisma.bankingPayment.findUniqueOrThrow({ where: { id } });
  const payment = await prisma.bankingPayment.update({
    where: { id },
    data: { approvalStatus: ApprovalStatus.APPROVED, approvedById: actorId, approvedAt: new Date(), updatedBy: actorId },
  });
  await writeAudit({
    entityType: "BankingPayment",
    entityId: payment.id,
    action: AuditAction.APPROVE,
    actorId,
    fieldName: "approvalStatus",
    previousValue: existing.approvalStatus,
    newValue: payment.approvalStatus,
  });
  return payment;
}

export async function deleteBankingPayment(id: string, actorId: string) {
  const payment = await prisma.bankingPayment.delete({ where: { id } });
  await writeAudit({ entityType: "BankingPayment", entityId: payment.id, action: AuditAction.DELETE, actorId });
  return payment;
}

export async function addRate(input: RateInput, actorId: string) {
  const rate = await prisma.rate.create({
    data: { ...input, price: input.price, discountPercent: input.discountPercent, createdBy: actorId, updatedBy: actorId },
  });
  await writeAudit({ entityType: "Rate", entityId: rate.id, action: AuditAction.CREATE, actorId });
  return rate;
}

export async function approveRate(id: string, actorId: string) {
  const existing = await prisma.rate.findUniqueOrThrow({ where: { id } });
  const rate = await prisma.rate.update({
    where: { id },
    data: { approvalStatus: ApprovalStatus.APPROVED, approvedById: actorId, updatedBy: actorId },
  });
  await writeAudit({
    entityType: "Rate",
    entityId: rate.id,
    action: AuditAction.APPROVE,
    actorId,
    fieldName: "approvalStatus",
    previousValue: existing.approvalStatus,
    newValue: rate.approvalStatus,
  });
  return rate;
}

export async function deleteRate(id: string, actorId: string) {
  const rate = await prisma.rate.delete({ where: { id } });
  await writeAudit({ entityType: "Rate", entityId: rate.id, action: AuditAction.DELETE, actorId });
  return rate;
}
