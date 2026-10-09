"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center" role="alert">
      <h1 className="text-2xl font-semibold">Bir şeyler ters gitti</h1>
      <p className="mt-2 text-muted">Sayfa yüklenemedi. Biraz sonra tekrar deneyebilirsin.</p>
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Tekrar dene
        </button>
        <Link href="/" className="btn">
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
