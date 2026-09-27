"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Copy, Check, KeyRound } from "lucide-react";
import { createUserAction, resetUserPasswordAction, updateUserAction } from "@/app/[locale]/(staff)/admin/users/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";
import { suggestHandle } from "@/lib/handle";

type RoleOption = { id: string; label: string };
type UserRow = { id: string; email: string; handle: string; name: string | null; roleId: string | null; maxSearchResults: number | null };

/** Shown once, right after createUserAction/resetUserPasswordAction return a
 * temporary password — there's no other way to retrieve it afterward (only
 * the bcrypt hash is stored), so this is the one chance to hand it to the
 * admin before the dialog closes. */
function TempPasswordReveal({ password, onDone }: { password: string; onDone: () => void }) {
  const t = useTranslations("Admin");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Clipboard access can be denied (permissions, non-secure context);
      // the password is still shown selectable in the input either way.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-pn-gray-2">{t("tempPasswordHint")}</p>
      <div className="flex items-center gap-2">
        <Input readOnly value={password} onFocus={(e) => e.currentTarget.select()} className="font-mono" />
        <Button type="button" variant="outline" size="icon" onClick={() => void copy()} aria-label={t("copyPassword")}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </Button>
      </div>
      <Button type="button" variant="outline" className="self-start" onClick={onDone}>
        {t("done")}
      </Button>
    </div>
  );
}

/** Handle field with a fixed "@" in front — the "@" isn't stored. */
function HandleInput({ value, defaultValue, onChange }: { value?: string; defaultValue?: string; onChange?: (v: string) => void }) {
  return (
    <div className="flex items-stretch">
      <span className="flex items-center border-2 border-r-0 border-pn-border-muted bg-pn-panel px-2 text-[13px] text-pn-gray-2">@</span>
      <Input
        id="handle"
        name="handle"
        required
        autoComplete="off"
        spellCheck={false}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </div>
  );
}

function CreateUserForm({ roles, onDone }: { roles: RoleOption[]; onDone: () => void }) {
  const t = useTranslations("Admin");
  const [state, formAction] = useActionState<ActionResult<{ tempPassword: string }> | null, FormData>(createUserAction, null);
  const errors = state && !state.success ? state.errors : {};
  const tempPassword = state?.success ? state.data?.tempPassword : undefined;
  // Controlled so a failed save keeps what was typed; the handle follows the
  // email as a suggestion until the admin edits it themselves.
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);

  if (tempPassword) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("userCreatedTitle")}</DialogTitle>
        </DialogHeader>
        <TempPasswordReveal password={tempPassword} onDone={onDone} />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("addUser")}</DialogTitle>
      </DialogHeader>
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("colEmail")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (!handleEdited) setHandle(suggestHandle(e.target.value));
            }}
          />
          <FieldError messages={errors.email} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="handle">{t("colHandle")}</Label>
          <HandleInput
            value={handle}
            onChange={(v) => {
              setHandle(v);
              setHandleEdited(true);
            }}
          />
          <p className="text-xs text-pn-gray-3">{t("handleHint")}</p>
          <FieldError messages={errors.handle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t("colName")}</Label>
          <Input id="name" name="name" />
          <FieldError messages={errors.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("colRole")}</Label>
          <RefSelect name="roleId" options={roles} placeholder={t("noRole")} />
          <FieldError messages={errors.roleId} />
        </div>
        <p className="text-xs text-pn-gray-3">{t("addUserHint")}</p>
        <SubmitButton variant="outline" className="self-start">
          {t("addUser")}
        </SubmitButton>
      </form>
    </>
  );
}

export function CreateUserDialog({ roles }: { roles: RoleOption[] }) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  // Bumped on every open — remounts CreateUserForm so a stale "here's the
  // password" screen from a previous create never reappears when the admin
  // reopens this dialog to add someone else.
  const [instance, setInstance] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setInstance((n) => n + 1);
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex h-7 items-center gap-[6px] border-none bg-pn-accent px-2.5 text-[11px] font-semibold text-white hover:bg-pn-accent-hover"
          >
            <Plus size={13} /> {t("addUser")}
          </button>
        }
      />
      <DialogContent>
        <CreateUserForm key={instance} roles={roles} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditUserDialog({ user, roles }: { user: UserRow; roles: RoleOption[] }) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateUserAction, null);
  const errors = state && !state.success ? state.errors : {};

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" className="cursor-pointer text-pn-gray-2 hover:text-pn-ink" aria-label={t("editItem")}>
            <Pencil size={14} />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.email}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={user.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="handle">{t("colHandle")}</Label>
            <HandleInput defaultValue={user.handle} />
            <p className="text-xs text-pn-gray-3">{t("handleHint")}</p>
            <FieldError messages={errors.handle} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{t("colName")}</Label>
            <Input id="name" name="name" defaultValue={user.name ?? ""} />
            <FieldError messages={errors.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("colRole")}</Label>
            <RefSelect name="roleId" options={roles} defaultValue={user.roleId ?? undefined} placeholder={t("noRole")} />
            <FieldError messages={errors.roleId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxSearchResults">{t("maxSearchResultsOverride")}</Label>
            <Input id="maxSearchResults" name="maxSearchResults" type="number" min={1} step={1} defaultValue={user.maxSearchResults ?? ""} />
            <p className="text-xs text-pn-gray-3">{t("maxSearchResultsOverrideHint")}</p>
            <FieldError messages={errors.maxSearchResults} />
          </div>
          <SubmitButton variant="outline" className="self-start">
            {t("save")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordForm({ userId, email, onDone }: { userId: string; email: string; onDone: () => void }) {
  const t = useTranslations("Admin");
  const [state, formAction] = useActionState<ActionResult<{ tempPassword: string }> | null, FormData>(resetUserPasswordAction, null);
  const tempPassword = state?.success ? state.data?.tempPassword : undefined;

  if (tempPassword) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("passwordResetTitle")}</DialogTitle>
        </DialogHeader>
        <TempPasswordReveal password={tempPassword} onDone={onDone} />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("resetPasswordConfirmTitle", { email })}</DialogTitle>
      </DialogHeader>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={userId} />
        <p className="text-[12.5px] text-pn-gray-2">{t("resetPasswordHint")}</p>
        <SubmitButton variant="outline" className="self-start">
          {t("resetPassword")}
        </SubmitButton>
      </form>
    </>
  );
}

export function ResetPasswordDialog({ userId, email }: { userId: string; email: string }) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [instance, setInstance] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setInstance((n) => n + 1);
      }}
    >
      <DialogTrigger
        render={
          <button type="button" className="cursor-pointer text-pn-gray-2 hover:text-pn-ink" aria-label={t("resetPassword")}>
            <KeyRound size={14} />
          </button>
        }
      />
      <DialogContent>
        <ResetPasswordForm key={instance} userId={userId} email={email} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
