import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthProvider } from "@/components/app/auth-context";
import { LoginForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Acesso da equipe" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-36 pb-24 sm:px-8">
      <AuthProvider>
        <Suspense>
          <LoginForm />
        </Suspense>
      </AuthProvider>
    </div>
  );
}
