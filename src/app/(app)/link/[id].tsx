import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpConfirmDialog } from "@/components/cmp/cmp-confirm-dialog";
import { CmpText } from "@/components/cmp/cmp-text";
import { CopyButton } from "@/components/copy-button";
import { LinkForm } from "@/components/link-form";
import { errorMessage } from "@/lib/errors";
import { shortLabel, shortUrl } from "@/lib/links";
import { strings } from "@/lib/strings";

const s = strings.form;

export default function EditLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const linkId = id as Id<"links">;
  const link = useQuery(api.links.get, { id: linkId });
  const update = useMutation(api.links.update);
  const remove = useMutation(api.links.remove);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  if (link === undefined) return <ActivityIndicator className="mt-10" />;
  if (link === null) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <CmpText variant="muted" className="text-center">
          {strings.links.notFound}
        </CmpText>
      </View>
    );
  }

  const clicks = strings.links.clicks(link.clicks);

  return (
    <>
      <LinkForm
        key={link._id}
        mode="edit"
        initial={{ target: link.target, slug: link.slug, enabled: link.enabled }}
        submitLabel={s.save}
        onSubmit={async ({ target, enabled }) => {
          await update({ id: link._id, target, enabled });
          router.dismissTo("/");
        }}
        header={
          <View className="gap-1">
            <View className="flex-row items-center gap-1">
              <CmpText variant="large" className="flex-1" numberOfLines={1}>
                {shortLabel(link.slug)}
              </CmpText>
              <CopyButton text={shortUrl(link.slug)} />
            </View>
            <CmpText variant="muted" className="text-sm">
              {link.lastClickedAt
                ? s.stats(clicks, new Date(link.lastClickedAt).toLocaleString())
                : clicks}
            </CmpText>
            <CmpText variant="muted" className="text-xs">
              {s.slugFixed}
            </CmpText>
          </View>
        }
        footer={
          <View className="gap-2">
            <CmpButton
              variant="outline"
              tone="destructive"
              icon={Trash2}
              label={s.delete}
              loading={deleting}
              onPress={() => setConfirmDelete(true)}
            />
            {deleteError && <CmpText className="text-destructive text-sm">{deleteError}</CmpText>}
          </View>
        }
      />
      <CmpConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={s.deleteTitle}
        description={s.deleteDescription(shortLabel(link.slug))}
        confirmLabel={s.delete}
        cancelLabel={strings.cancel}
        destructive
        onConfirm={async () => {
          setDeleting(true);
          setDeleteError(undefined);
          try {
            await remove({ id: link._id });
            router.dismissTo("/");
          } catch (e) {
            setDeleteError(errorMessage(e));
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
