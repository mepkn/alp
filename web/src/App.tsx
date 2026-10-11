import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AccountMenu } from "@/components/AccountMenu";
import { Logo } from "@/components/Logo";
import { LinksPage } from "@/components/LinksPage";
import { SignInPage } from "@/components/SignInPage";
import { ThemeToggle } from "@/components/ThemeToggle";

function Shell() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <LinksPage />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <AuthLoading>
        <div className="grid min-h-svh place-items-center">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignInPage />
      </Unauthenticated>
      <Authenticated>
        <Shell />
      </Authenticated>
      <Toaster />
    </>
  );
}
