import { Link } from "expo-router";
import { Pressable, View } from "react-native";
import type { Doc } from "@convex/_generated/dataModel";
import { CmpText } from "@/components/cmp/cmp-text";
import { CopyButton } from "@/components/copy-button";
import { shortLabel, shortUrl } from "@/lib/links";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

const s = strings.links;

export function LinkRow({ link }: { link: Doc<"links"> }) {
  return (
    <View className="border-border bg-card flex-row items-center gap-2 rounded-lg border py-2 pl-4 pr-1">
      <Link href={{ pathname: "/link/[id]", params: { id: link._id } }} asChild>
        <Pressable className="min-w-0 flex-1 gap-0.5 py-1">
          <CmpText
            className={cn("font-medium", !link.enabled && "text-muted-foreground line-through")}
            numberOfLines={1}>
            {shortLabel(link.slug)}
          </CmpText>
          <CmpText variant="muted" className="text-sm" numberOfLines={1}>
            {link.target}
          </CmpText>
          <CmpText variant="muted" className="text-xs">
            {s.clicks(link.clicks)}
            {!link.enabled && ` · ${s.disabled}`}
          </CmpText>
        </Pressable>
      </Link>
      <CopyButton text={shortUrl(link.slug)} />
    </View>
  );
}
