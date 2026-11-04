import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPasswordForm } from "@/components/app/auth-forms";
import { PageTitle } from "@/components/app/ui";
import { appTexts } from "@/config/texts-app";

export const metadata: Metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-36 pb-24 sm:px-8">
      <Suspense>
        <PageTitle>{appTexts.auth.resetTitle}</PageTitle>
        <NewPasswordForm />
      </Suspense>
    </div>
  );
}
