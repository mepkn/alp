import { usePaginatedQuery } from "convex/react";
import { router, Stack } from "expo-router";
import { Plus, Settings } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { api } from "@convex/_generated/api";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpInput } from "@/components/cmp/cmp-field";
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
  const [search, setSearch] = useState("");

  // v1 searches the pages loaded so far, on the client.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter(
      (l) => l.slug.toLowerCase().includes(q) || l.target.toLowerCase().includes(q),
    );
  }, [results, search]);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerRight: () => (
            <View className="flex-row items-center gap-1">
              <CmpButton
                size="sm"
                icon={Plus}
                label={s.newLink}
                onPress={() => router.push("/link/new")}
              />
              <CmpButton
                variant="ghost"
                size="icon"
                icon={Settings}
                label={s.settings}
                onPress={() => router.push("/settings")}
              />
            </View>
          ),
        }}
      />
      <FlatList
        data={visible}
        keyExtractor={(l) => l._id}
        renderItem={({ item }) => <LinkRow link={item} />}
        contentContainerClassName="mx-auto w-full max-w-2xl gap-2 p-4 pb-12"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <CmpInput
            value={search}
            onChangeText={setSearch}
            placeholder={s.search}
            autoCapitalize="none"
            autoCorrect={false}
            className="mb-2"
          />
        }
        ListEmptyComponent={
          status === "LoadingFirstPage" ? (
            <ActivityIndicator className="mt-10" />
          ) : (
            <CmpText variant="muted" className="mt-10 text-center">
              {search.trim() ? s.noMatches : s.empty}
            </CmpText>
          )
        }
        ListFooterComponent={
          status === "CanLoadMore" ? (
            <CmpButton variant="outline" label={s.loadMore} onPress={() => loadMore(PAGE_SIZE)} />
          ) : status === "LoadingMore" ? (
            <ActivityIndicator />
          ) : null
        }
      />
    </View>
  );
}
