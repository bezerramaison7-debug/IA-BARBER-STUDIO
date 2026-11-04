import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPage } from "@/components/app/account-page";
import { RequireAuth } from "@/components/app/auth-context";

export const metadata: Metadata = { title: "Minha conta" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-36 pb-24 sm:px-8">
      <Suspense>
        <RequireAuth><AccountPage /></RequireAuth>
      </Suspense>
    </div>
  );
}
