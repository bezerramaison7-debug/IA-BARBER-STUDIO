import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-36 pb-24 sm:px-8">
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
