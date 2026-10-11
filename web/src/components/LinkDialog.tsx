import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorCode, errorMessage } from "@/lib/errors";
import { shortLabel } from "@/lib/links";
import { strings } from "@/lib/strings";

const s = strings.form;
const SLUG_ERRORS = new Set(["invalidSlug", "slugReserved", "slugTaken"]);
const TARGET_ERRORS = new Set(["invalidUrl", "targetTooLong"]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Edit this link; create a new one when absent.
  link?: Doc<"links">;
};

export function LinkDialog({ open, onOpenChange, link }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remounts per open, so the fields start from the link each time. */}
        {open && <LinkForm link={link} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({ link, onDone }: { link?: Doc<"links">; onDone: () => void }) {
  const create = useMutation(api.links.create);
  const update = useMutation(api.links.update);
  const [target, setTarget] = useState(link?.target ?? "");
  const [slug, setSlug] = useState("");
  const [enabled, setEnabled] = useState(link?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [targetError, setTargetError] = useState<string>();
  const [slugError, setSlugError] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTargetError(undefined);
    setSlugError(undefined);
    setError(undefined);
    setBusy(true);
    try {
      if (link) {
        await update({ id: link._id, target: target.trim(), enabled });
        toast.success(s.saved);
      } else {
        const created = await create({ target: target.trim(), slug: slug.trim() || undefined });
        // New links start enabled; honour the switch if it was turned off.
        if (!enabled) await update({ id: created._id, enabled: false });
        toast.success(s.created(shortLabel(created.slug)));
      }
      onDone();
    } catch (e) {
      const code = errorCode(e);
      const message = errorMessage(e);
      if (code && TARGET_ERRORS.has(code)) setTargetError(message);
      else if (code && SLUG_ERRORS.has(code)) setSlugError(message);
      else setError(message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{link ? s.editTitle : s.newTitle}</DialogTitle>
        <DialogDescription>{link ? shortLabel(link.slug) : s.newDescription}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="target">{s.target}</Label>
        <Input
          id="target"
          type="url"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={s.targetPlaceholder}
          aria-invalid={!!targetError}
          autoComplete="off"
          autoFocus
          required
        />
        {targetError && <p className="text-sm text-destructive">{targetError}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="slug">{s.slug}</Label>
        {link ? (
          <>
            <Input id="slug" value={link.slug} disabled />
            <p className="text-xs text-muted-foreground">{s.slugFixed}</p>
          </>
        ) : (
          <>
            <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="pl-2.5 text-sm text-muted-foreground select-none">{shortLabel("")}</span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={s.slugPlaceholder}
                aria-invalid={!!slugError}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                className="h-8 min-w-0 flex-1 bg-transparent pr-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {slugError ? (
              <p className="text-sm text-destructive">{slugError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{s.slugHint}</p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-0.5">
          <Label htmlFor="enabled">{s.enabled}</Label>
          <p className="text-xs text-muted-foreground">{s.enabledHint}</p>
        </div>
        <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {strings.cancel}
        </Button>
        <Button type="submit" disabled={busy || !target.trim()}>
          {busy && <Loader2Icon className="animate-spin" />}
          {link ? s.save : s.create}
        </Button>
      </DialogFooter>
    </form>
  );
}
