import type { Metadata } from "next";
import { AdminPrivacy } from "@/components/app/admin-pages";

export const metadata: Metadata = { title: "Privacidade" };

export default function Page() {
  return <AdminPrivacy />;
}
