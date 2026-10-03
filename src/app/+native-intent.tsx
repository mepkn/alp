// A share opens the app through a deep link that isn't a route; send it to the
// list, where the root layout picks the share up and opens New link.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return path.includes("dataUrl=") ? "/" : path;
}
