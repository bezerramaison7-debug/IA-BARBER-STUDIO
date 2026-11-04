import type { Metadata } from "next";
import { AdminAvailability } from "@/components/app/admin-pages";

export const metadata: Metadata = { title: "Horários" };

export default function Page() {
  return <AdminAvailability />;
}
