import type { Enums } from "@/lib/database.types";

const LABELS: Record<Enums<"appointment_status">, string> = {
  pending: "Onay bekliyor",
  confirmed: "Onaylandı",
  cancelled: "İptal edildi",
  completed: "Tamamlandı",
  no_show: "Gelinmedi",
};

const STYLES: Record<Enums<"appointment_status">, string> = {
  pending: "bg-accent-soft text-foreground",
  confirmed: "bg-success-soft text-success",
  cancelled: "bg-danger-soft text-danger",
  completed: "bg-border text-foreground",
  no_show: "bg-danger-soft text-danger",
};

export function statusLabel(status: Enums<"appointment_status">): string {
  return LABELS[status];
}

export function StatusBadge({ status }: { status: Enums<"appointment_status"> }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
