import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listExceptions } from "@/data/dataQualityExceptions";
import { parseExceptionFilters } from "@/lib/validation/import";
import { DqStatus } from "@/lib/enums";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignExceptionAction } from "./actions";
import { ResolveDialog } from "./_components/resolve-dialog";
import { staffLabel } from "@/lib/handle";

export default async function ExceptionsPage(props: PageProps<"/[locale]/exceptions">) {
  const t = await getTranslations("Exceptions");
  const rawSearchParams = await props.searchParams;
  const filters = parseExceptionFilters(rawSearchParams);
  const exceptions = await listExceptions(filters);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("matching", { count: exceptions.length })}</p>
      </div>

      <div className="flex gap-2 text-sm">
        <Link href="/exceptions" className={!filters.status ? "font-semibold" : "text-muted-foreground"}>
          {t("all")}
        </Link>
        {Object.values(DqStatus).map((value) => (
          <Link
            key={value}
            href={`/exceptions?status=${value}`}
            className={filters.status === value ? "font-semibold" : "text-muted-foreground"}
          >
            {value.replaceAll("_", " ")}
          </Link>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colSeverity")}</TableHead>
            <TableHead>{t("colRule")}</TableHead>
            <TableHead>{t("colProvider")}</TableHead>
            <TableHead>{t("colBatch")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            <TableHead>{t("colOwner")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {exceptions.map((exception) => (
            <TableRow key={exception.id}>
              <TableCell>
                <StatusBadge status={exception.severity} />
              </TableCell>
              <TableCell>
                {exception.rule.description}
                {exception.fieldName ? <div className="text-xs text-muted-foreground">{exception.fieldName}</div> : null}
              </TableCell>
              <TableCell>
                {exception.provider ? (
                  <Link href={`/providers/${exception.provider.id}`} className="hover:underline">
                    {exception.provider.names[0]?.fullNameText ?? exception.provider.id}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {exception.importBatch ? (
                  <Link href={`/import/${exception.importBatch.id}`} className="hover:underline">
                    {exception.importBatch.fileName}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={exception.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{exception.owner ? staffLabel(exception.owner) : t("unassigned")}</TableCell>
              <TableCell className="flex items-center gap-1">
                {exception.status === DqStatus.OPEN && (
                  <form action={assignExceptionAction}>
                    <input type="hidden" name="id" value={exception.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {t("assignToMe")}
                    </Button>
                  </form>
                )}
                {exception.status !== DqStatus.RESOLVED && <ResolveDialog exceptionId={exception.id} />}
              </TableCell>
            </TableRow>
          ))}
          {exceptions.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {t("noExceptions")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
