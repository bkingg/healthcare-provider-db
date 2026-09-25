import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listImportBatches } from "@/data/importBatches";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadForm } from "./_components/upload-form";

export default async function ImportPage() {
  const t = await getTranslations("Import");
  const batches = await listImportBatches();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <UploadForm />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colFile")}</TableHead>
            <TableHead>{t("colLoaded")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            <TableHead>{t("colRows")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>
                <Link href={`/import/${batch.id}`} className="font-medium hover:underline">
                  {batch.fileName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{batch.loadedAt.toLocaleString()}</TableCell>
              <TableCell>
                <StatusBadge status={batch.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {t("rowsSummary", { approved: batch.approvedCount, total: batch.totalRecordCount, rejected: batch.rejectedCount })}
              </TableCell>
            </TableRow>
          ))}
          {batches.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                {t("noBatches")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
