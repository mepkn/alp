import { useState } from "react";
import { useMutation } from "convex/react";
import { CheckIcon, CopyIcon, ExternalLinkIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { errorMessage } from "@/lib/errors";
import { shortLabel, shortUrl, timeAgo } from "@/lib/links";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

const s = strings.links;

export function LinkCard({ link, onEdit }: { link: Doc<"links">; onEdit: () => void }) {
  const remove = useMutation(api.links.remove);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shortUrl(link.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function confirmDelete() {
    try {
      await remove({ id: link._id });
      toast.success(s.deleted);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <li className="flex items-center gap-2 rounded-xl border bg-card py-3 pr-2 pl-4 shadow-xs">
      <button type="button" onClick={onEdit} className="grid min-w-0 flex-1 gap-0.5 text-left">
        <span className="flex items-center gap-2">
          <span className={cn("truncate font-medium", !link.enabled && "text-muted-foreground line-through")}>
            {shortLabel(link.slug)}
          </span>
          {!link.enabled && <Badge variant="secondary">{s.disabled}</Badge>}
        </span>
        <span className="truncate text-sm text-muted-foreground">{link.target}</span>
        <span className="text-xs text-muted-foreground">
          {s.clicks(link.clicks)}
          {link.lastClickedAt !== undefined && ` · ${s.lastClick(timeAgo(link.lastClickedAt))}`}
        </span>
      </button>

      <Button variant="ghost" size="icon" onClick={copy} aria-label={copied ? s.copied : s.copy} title={s.copy}>
        {copied ? <CheckIcon className="text-green-600 dark:text-green-400" /> : <CopyIcon />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={s.actions} />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon /> {s.edit}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open(link.target, "_blank", "noopener,noreferrer")}>
            <ExternalLinkIcon /> {s.open}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2Icon /> {s.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={s.deleteTitle}
        description={s.deleteDescription(shortLabel(link.slug))}
        confirmLabel={s.delete}
        onConfirm={() => void confirmDelete()}
      />
    </li>
  );
}
