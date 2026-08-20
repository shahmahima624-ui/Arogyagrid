import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <Link className="font-bold text-emerald-800" href="/dashboard">
          AAROGYAGRID
        </Link>
        <Link href="/facilities">Facilities</Link>
        <Link href="/inventory">Inventory</Link>
        <Link href="/consumption">Consumption</Link>
      </div>
    </nav>
  );
}
