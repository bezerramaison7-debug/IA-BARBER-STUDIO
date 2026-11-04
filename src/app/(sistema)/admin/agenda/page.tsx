import type { Metadata } from "next";
import { AdminAgenda } from "@/components/app/admin-pages";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return <AdminAgenda />;
}
