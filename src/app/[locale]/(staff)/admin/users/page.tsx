import { getTranslations } from "next-intl/server";
import { UserCheck, UserX } from "lucide-react";
import { getCurrentActor } from "@/lib/actor";
import { requireManageUsers } from "@/lib/rbac";
import { listUsers, listActiveRoles } from "@/data/users";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setUserActiveAction } from "./actions";
import { CreateUserDialog, EditUserDialog, ResetPasswordDialog } from "./_components/user-dialogs";

export default async function UsersAdminPage() {
  const t = await getTranslations("Admin");
  const actor = await getCurrentActor();
  requireManageUsers(actor);

  const [rows, roles] = await Promise.all([listUsers(), listActiveRoles()]);
  const roleOptions = roles.map((r) => ({ id: r.id, label: r.name }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("usersTitle")}</h1>
          <p className="mt-[5px] text-xs text-pn-gray-2">{t("itemCount", { count: rows.length })}</p>
        </div>
        <CreateUserDialog roles={roleOptions} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colEmail")}</TableHead>
            <TableHead>{t("colHandle")}</TableHead>
            <TableHead>{t("colName")}</TableHead>
            <TableHead>{t("colRole")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            <TableHead>{t("colCreated")}</TableHead>
            <TableHead>{t("colLastLogin")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.email}</TableCell>
              <TableCell className="font-semibold">@{user.handle}</TableCell>
              <TableCell>{user.name ?? "—"}</TableCell>
              <TableCell>{user.role?.name ?? t("noRole")}</TableCell>
              <TableCell>
                <Badge variant={user.isActive ? "default" : "outline"}>{user.isActive ? t("active") : t("inactive")}</Badge>
              </TableCell>
              <TableCell className="text-pn-gray-2">{user.createdAt.toLocaleDateString()}</TableCell>
              <TableCell className="text-pn-gray-2">{user.lastLoginAt ? user.lastLoginAt.toLocaleString() : t("neverLoggedIn")}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <EditUserDialog user={user} roles={roleOptions} />
                  <ResetPasswordDialog userId={user.id} email={user.email} />
                  {user.id === actor.id ? (
                    // Deactivating your own account locks you out immediately
                    // (every request re-checks User.isActive — see
                    // src/lib/actor.ts) with no way back into this page to
                    // undo it yourself. Disabled rather than hidden so the
                    // row layout stays consistent and it's clear this is a
                    // deliberate restriction, not a missing feature.
                    <span className="cursor-not-allowed text-pn-gray-4" title={t("cannotDeactivateSelf")} aria-label={t("cannotDeactivateSelf")}>
                      <UserX size={14} />
                    </span>
                  ) : (
                    <form action={setUserActiveAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="isActive" value={String(!user.isActive)} />
                      <button
                        type="submit"
                        className="cursor-pointer text-pn-gray-2 hover:text-pn-ink"
                        aria-label={user.isActive ? t("deactivate") : t("activate")}
                      >
                        {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </form>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {t("noItems")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
