import type { Metadata } from "next";
import { AdminToday } from "@/components/app/admin-pages";

export const metadata: Metadata = { title: "Painel" };

export default function Page() {
  return <AdminToday />;
}
