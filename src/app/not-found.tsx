import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
      <p className="mt-2 text-muted">Aradığın sayfa yok ya da kaldırılmış olabilir.</p>
      <Link href="/" className="btn btn-primary mt-5">
        Ana sayfaya dön
      </Link>
    </div>
  );
}
