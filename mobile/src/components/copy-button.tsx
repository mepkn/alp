import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
import { useEffect, useState } from "react";
import { CmpButton } from "@/components/cmp/cmp-button";
import { strings } from "@/lib/strings";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <CmpButton
      variant="ghost"
      size="icon"
      icon={copied ? Check : Copy}
      label={copied ? strings.links.copied : strings.links.copy}
      onPress={async () => {
        await Clipboard.setStringAsync(text);
        setCopied(true);
      }}
    />
  );
}
