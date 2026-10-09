import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingWizard } from "@/components/BookingWizard";
import { getPublicBusiness } from "@/lib/booking/data";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[slug]/randevu">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicBusiness(slug);
  return { title: data ? `Randevu al: ${data.business.name}` : "İşletme bulunamadı", robots: { index: false } };
}

export default async function BookPage({ params, searchParams }: PageProps<"/[slug]/randevu">) {
  const { slug } = await params;
  const query = await searchParams;
  const [data, user] = await Promise.all([getPublicBusiness(slug), getCurrentUser()]);
  if (!data) notFound();

  return (
    <BookingWizard
      data={data}
      user={user ? { email: user.email } : null}
      autoComplete={query.tamamla === "1"}
    />
  );
}
