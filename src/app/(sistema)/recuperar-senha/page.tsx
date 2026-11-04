import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-36 pb-24 sm:px-8">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
