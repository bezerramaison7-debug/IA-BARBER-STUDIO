import type { ReactNode } from "react";
import { AdminShell } from "@/components/app/admin-shared";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-36 pb-24 sm:px-8">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
