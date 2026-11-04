import type { Metadata } from "next";
import { AdminSettings } from "@/components/app/admin-pages";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return <AdminSettings />;
}
