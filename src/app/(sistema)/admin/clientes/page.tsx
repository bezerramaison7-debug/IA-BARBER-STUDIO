import type { Metadata } from "next";
import { AdminCustomers } from "@/components/app/admin-pages";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return <AdminCustomers />;
}
