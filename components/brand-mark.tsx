import Image from "next/image";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
        <Image src="/book.png" alt="Kakeibo Logo" width={24} height={24} className="object-contain" />
      </span>
      {compact ? null : (
        <span className="text-lg font-semibold tracking-[-0.04em] text-white">
          Kakeibo
        </span>
      )}
    </span>
  );
}
