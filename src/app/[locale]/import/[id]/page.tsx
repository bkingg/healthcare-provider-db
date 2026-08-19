import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getImportBatchDetail } from "@/data/importBatches";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmImportDialog, type DuplicateCandidate } from "../_components/confirm-import-dialog";

export default async function ImportBatchDetailPage(props: PageProps<"/[locale]/import/[id]">) {
  const t = await getTranslations("Import");
  const { id } = await props.params;
  const batch = await getImportBatchDetail(id);
  if (!batch) notFound();

  const validatedCount = batch.stagingRows.filter((r) => r.validationStatus === "VALIDATED").length;
  const canCommit = validatedCount > 0 && batch.approvedCount === 0;

  const duplicates: DuplicateCandidate[] = batch.stagingRows.flatMap((row) =>
    row.exceptions
      .filter((e) => e.rule.code === "DUPLICATE_CANDIDATE" && e.provider)
      .map((e) => ({
        stagingRowName: row.rawProviderName ?? `Row ${row.rowNumber}`,
        existingProviderId: e.provider!.id,
        existingProviderName: e.provider!.names[0]?.fullNameText ?? e.provider!.id,
      })),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{batch.fileName}</h1>
          <p className="text-sm text-muted-foreground">
            {t("loadedBy", { name: batch.loadedBy.name ?? batch.loadedBy.email, date: batch.loadedAt.toLocaleString() })}
          </p>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4 text-sm md:grid-cols-5">
        <Stat label={t("statInput")} value={batch.totalRecordCount} />
        <Stat label={t("statStaged")} value={batch.stagedCount} />
        <Stat label={t("statApproved")} value={batch.approvedCount} />
        <Stat label={t("statRejected")} value={batch.rejectedCount} />
        <Stat label={t("statExceptions")} value={batch.exceptionCount} />
      </div>

      {batch.aiPrompt && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase">{t("aiInstructionsLabel")}</span>
          <p className="rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap">{batch.aiPrompt}</p>
        </div>
      )}

      <p className="text-sm">
        {batch.reconciledAt ? (
          <span>
            {t("reconciled", {
              approved: batch.approvedCount,
              rejected: batch.rejectedCount,
              staged: batch.stagedCount,
              date: batch.reconciledAt.toLocaleString(),
            })}
          </span>
        ) : validatedCount > 0 ? (
          <span className="text-muted-foreground">{t("validatedReady", { count: validatedCount })}</span>
        ) : (
          <span className="text-muted-foreground">{t("noneValidated")}</span>
        )}
      </p>

      {canCommit && (
        <ConfirmImportDialog batchId={batch.id} validatedCount={validatedCount} aiPrompt={batch.aiPrompt} duplicates={duplicates} />
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colRow")}</TableHead>
            <TableHead>{t("colName")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            <TableHead>{t("colProvider")}</TableHead>
            <TableHead>{t("colExceptions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batch.stagingRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
              <TableCell>{row.rawProviderName ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge status={row.validationStatus} />
              </TableCell>
              <TableCell>
                {row.matchedProvider ? (
                  <Link href={`/providers/${row.matchedProvider.id}`} className="hover:underline">
                    {row.matchedProvider.names[0]?.fullNameText ?? row.matchedProvider.id}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {row.exceptions.length === 0
                  ? "—"
                  : row.exceptions.map((exception) => (
                      <div key={exception.id} className="flex items-center gap-1 text-xs">
                        <StatusBadge status={exception.severity} /> {exception.rule.description}
                      </div>
                    ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
