import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { LinkForm, type LinkFormValues } from "@/components/link-form";
import { strings } from "@/lib/strings";

export default function NewLinkScreen() {
  // ?target= pre-fills the URL, e.g. from the Android share sheet.
  const params = useLocalSearchParams<{ target?: string }>();
  const create = useMutation(api.links.create);
  const update = useMutation(api.links.update);
  const [initial] = useState<LinkFormValues>(() => ({
    target: typeof params.target === "string" ? params.target : "",
    slug: "",
    enabled: true,
  }));

  return (
    <LinkForm
      mode="create"
      initial={initial}
      submitLabel={strings.form.create}
      onSubmit={async ({ target, slug, enabled }) => {
        const { _id } = await create({ target, slug: slug || undefined });
        if (!enabled) await update({ id: _id, enabled });
        router.dismissTo("/");
      }}
    />
  );
}
