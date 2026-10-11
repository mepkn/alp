import { useEffect, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { Loader2Icon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { LinkCard } from "@/components/LinkCard";
import { LinkDialog } from "@/components/LinkDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_SIZE } from "@/lib/links";
import { strings } from "@/lib/strings";

const s = strings.links;
const DEBOUNCE_MS = 250;

// "new", a link being edited, or closed.
type Editing = "new" | Doc<"links"> | null;

export function LinksPage() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Searching hits every link on the server, not just the loaded page.
  const list = usePaginatedQuery(api.links.list, query ? "skip" : {}, { initialNumItems: PAGE_SIZE });
  const search = usePaginatedQuery(api.links.search, query ? { query } : "skip", {
    initialNumItems: PAGE_SIZE,
  });
  const { results, status, loadMore } = query ? search : list;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={s.search}
            aria-label={s.search}
            className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText("")}
              aria-label={s.clearSearch}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon /> <span className="max-sm:sr-only">{s.newLink}</span>
        </Button>
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="grid place-items-center py-16">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{query ? s.noMatches : s.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((link) => (
            <LinkCard key={link._id} link={link} onEdit={() => setEditing(link)} />
          ))}
        </ul>
      )}

      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <Button
          variant="outline"
          className="self-center"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          {status === "LoadingMore" && <Loader2Icon className="animate-spin" />}
          {s.loadMore}
        </Button>
      )}

      <LinkDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        link={editing !== null && editing !== "new" ? editing : undefined}
      />
    </div>
  );
}
