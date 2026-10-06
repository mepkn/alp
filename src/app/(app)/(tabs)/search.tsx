import { usePaginatedQuery } from "convex/react";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, type TextInput, View } from "react-native";
import { api } from "@convex/_generated/api";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpText } from "@/components/cmp/cmp-text";
import { LinkRow } from "@/components/link-row";
import { PAGE_SIZE } from "@/lib/links";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

const s = strings.links;
const DEBOUNCE_MS = 250;

// Searches all of the user's links on the server, not just a loaded page.
// The query stays while the app is open (tab screens stay mounted).
export default function SearchScreen() {
  const input = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Opening the tab puts the cursor in the box.
  useFocusEffect(
    useCallback(() => {
      input.current?.focus();
    }, []),
  );

  const { results, status, loadMore } = usePaginatedQuery(
    api.links.search,
    query ? { query } : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <View className="bg-background flex-1">
      {/* The box stays put; its border shows once the list scrolls under it. */}
      <View
        className={cn(
          "border-b px-4 pb-3 pt-3",
          scrolled ? "border-border" : "border-transparent",
        )}>
        <CmpInput
          ref={input}
          value={text}
          onChangeText={setText}
          placeholder={s.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="mx-auto w-full max-w-2xl"
        />
      </View>
      <FlatList
        data={query ? results : []}
        keyExtractor={(l) => l._id}
        renderItem={({ item }) => <LinkRow link={item} />}
        contentContainerClassName="mx-auto w-full max-w-2xl gap-2 px-4 pb-10 pt-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 0)}
        scrollEventThrottle={32}
        onEndReached={() => status === "CanLoadMore" && loadMore(PAGE_SIZE)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !query ? (
            <CmpText variant="muted" className="mt-10 text-center">
              {s.searchHint}
            </CmpText>
          ) : status === "LoadingFirstPage" ? (
            <ActivityIndicator className="mt-10" />
          ) : (
            <CmpText variant="muted" className="mt-10 text-center">
              {s.noMatches}
            </CmpText>
          )
        }
        ListFooterComponent={status === "LoadingMore" ? <ActivityIndicator /> : null}
      />
    </View>
  );
}
