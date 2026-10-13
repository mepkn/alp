// Every user-facing string, in one place. English only.
export const strings = {
  appName: "Alp",
  somethingWentWrong: "Something went wrong. Please try again.",
  cancel: "Cancel",
  loading: "Loading…",

  auth: {
    email: "Email",
    password: "Password",
    passwordHint: "At least 8 characters.",
    signInTitle: "Welcome back",
    signInSubtitle: "Sign in to manage your short links.",
    signUpTitle: "Create your account",
    signUpSubtitle: "Only invited emails can sign up.",
    logIn: "Log in",
    signUp: "Sign up",
    logOut: "Log out",
    noAccount: "No account yet? Sign up",
    haveAccount: "Already have an account? Log in",
  },

  tabs: {
    links: "Links",
    search: "Search",
  },

  links: {
    newLink: "New link",
    settings: "Settings",
    search: "Search by slug or target",
    searchHint: "Searches all your links, by whole words and word starts.",
    empty: "No links yet. Tap + to create one.",
    noMatches: "No links match your search.",
    copy: "Copy short URL",
    copied: "Copied",
    disabled: "Disabled",
    clicks: (n: number) => (n === 1 ? "1 click" : `${n} clicks`),
    notFound: "This link doesn't exist or was deleted.",
  },

  form: {
    newTitle: "New link",
    editTitle: "Edit link",
    target: "Target URL",
    targetPlaceholder: "https://example.com/a/long/page",
    slug: "Custom slug (optional)",
    slugHint: "Letters, digits, - and _. Case-sensitive. Leave empty for a random one.",
    slugFixed: "The slug can't be changed. Delete the link and create a new one instead.",
    enabled: "Enabled",
    enabledHint: "Disabled links return “not found”.",
    create: "Create",
    save: "Save",
    delete: "Delete",
    deleteTitle: "Delete this link?",
    deleteDescription: (shortUrl: string) =>
      `${shortUrl} stops working right away, and its click count is lost. This can't be undone.`,
    stats: (clicks: string, last: string) => `${clicks} · last ${last}`,
  },

  settings: {
    title: "Settings",
    account: "Account",
    signedInAs: "Signed in as",
    appearance: "Theme",
    themes: { light: "Light", dark: "Dark", system: "System" },
  },

  // Server error codes (plain-string ConvexErrors).
  errors: {
    notAuthenticated: "Your session has expired. Please log in again.",
    notAllowed: "This account isn't allowed to use this app.",
    linkNotFound: "This link doesn't exist or was deleted.",
    invalidUrl: "Enter a full http:// or https:// URL that isn't an alp link.",
    targetTooLong: "The URL is over 2048 characters.",
    invalidSlug: "Use 1–64 letters, digits, - or _.",
    slugReserved: "This slug is reserved by the app. Pick another.",
    slugTaken: "This slug is already taken.",
    invalidEmail: "Enter a valid email address.",
    passwordTooShort: "The password must be at least 8 characters.",
    invalidCredentials: "Wrong email or password.",
    accountExists: "An account with this email already exists. Log in instead.",
  } as Record<string, string>,
};
