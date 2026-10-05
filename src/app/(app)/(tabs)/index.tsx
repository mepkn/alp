import { usePaginatedQuery } from "convex/react";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { ActivityIndicator, FlatList, View } from "react-native";
import { api } from "@convex/_generated/api";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpText } from "@/components/cmp/cmp-text";
import { LinkRow } from "@/components/link-row";
import { strings } from "@/lib/strings";

const s = strings.links;
const PAGE_SIZE = 50;

export default function LinksScreen() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.links.list,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <View className="bg-background flex-1">
      <FlatList
        data={results}
        keyExtractor={(l) => l._id}
        renderItem={({ item }) => <LinkRow link={item} />}
        contentContainerClassName="mx-auto w-full max-w-2xl gap-2 px-4 pb-28 pt-3"
        onEndReached={() => status === "CanLoadMore" && loadMore(PAGE_SIZE)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          status === "LoadingFirstPage" ? (
            <ActivityIndicator className="mt-10" />
          ) : (
            <CmpText variant="muted" className="mt-10 text-center">
              {s.empty}
            </CmpText>
          )
        }
        ListFooterComponent={status === "LoadingMore" ? <ActivityIndicator /> : null}
      />
      {/* label stays as the accessibility label. */}
      <View className="absolute bottom-6 right-6" pointerEvents="box-none">
        <CmpButton
          size="icon"
          icon={Plus}
          label={s.newLink}
          className="size-14 rounded-full shadow-lg shadow-black/20 sm:size-14"
          onPress={() => router.push("/link/new")}
        />
      </View>
    </View>
  );
}
