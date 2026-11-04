import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingFlow } from "@/components/app/booking-flow";

export const metadata: Metadata = { title: "Agendar horário" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-36 pb-24 sm:px-8">
      <Suspense>
        <BookingFlow />
      </Suspense>
    </div>
  );
}
