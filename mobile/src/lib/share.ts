const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

// Apps often share "Title https://…", so take the first http(s) URL in the
// text, minus trailing punctuation. Undefined when there's none.
export function sharedUrl(webUrl: string | null | undefined, text: string | null | undefined) {
  const found = webUrl?.trim() || text?.match(URL_IN_TEXT)?.[0];
  return found?.replace(/[.,;:!?)\]]+$/, "") || undefined;
}
