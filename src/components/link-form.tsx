import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpSwitch } from "@/components/cmp/cmp-switch";
import { CmpText } from "@/components/cmp/cmp-text";
import { errorCode, errorMessage } from "@/lib/errors";
import { strings } from "@/lib/strings";

const s = strings.form;

export type LinkFormValues = { target: string; slug: string; enabled: boolean };

type Props = {
  initial: LinkFormValues;
  // Create mode shows the slug field; edit mode shows the slug as fixed.
  mode: "create" | "edit";
  submitLabel: string;
  onSubmit: (values: LinkFormValues) => Promise<void>;
  header?: ReactNode;
  footer?: ReactNode;
};

const SLUG_ERRORS = new Set(["invalidSlug", "slugReserved", "slugTaken"]);

export function LinkForm({ initial, mode, submitLabel, onSubmit, header, footer }: Props) {
  const [target, setTarget] = useState(initial.target);
  const [slug, setSlug] = useState(initial.slug);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [submitting, setSubmitting] = useState(false);
  const [targetError, setTargetError] = useState<string>();
  const [slugError, setSlugError] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit() {
    setTargetError(undefined);
    setSlugError(undefined);
    setError(undefined);
    setSubmitting(true);
    try {
      await onSubmit({ target: target.trim(), slug: slug.trim(), enabled });
    } catch (e) {
      const code = errorCode(e);
      const message = errorMessage(e);
      if (code === "invalidUrl" || code === "targetTooLong") setTargetError(message);
      else if (code && SLUG_ERRORS.has(code)) setSlugError(message);
      else setError(message);
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} className="bg-background flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerClassName="mx-auto w-full max-w-xl gap-5 p-4 pb-12"
          keyboardShouldPersistTaps="handled">
          {header}
          <CmpInput
            label={s.target}
            value={target}
            onChangeText={setTarget}
            placeholder={s.targetPlaceholder}
            error={targetError}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            autoFocus={mode === "create" && !initial.target}
          />
          {mode === "create" && (
            <CmpInput
              label={s.slug}
              hint={s.slugHint}
              value={slug}
              onChangeText={setSlug}
              error={slugError}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={64}
              onSubmitEditing={submit}
            />
          )}
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-0.5">
              <CmpText>{s.enabled}</CmpText>
              <CmpText variant="muted" className="text-sm">
                {s.enabledHint}
              </CmpText>
            </View>
            <CmpSwitch checked={enabled} onCheckedChange={setEnabled} />
          </View>
          {error && <CmpText className="text-destructive text-sm">{error}</CmpText>}
          <CmpButton
            label={submitLabel}
            loading={submitting}
            disabled={!target.trim()}
            onPress={submit}
          />
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
