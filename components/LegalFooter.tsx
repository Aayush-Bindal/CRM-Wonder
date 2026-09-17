import Link from 'next/link';
import { LEGAL, LEGAL_DOCS } from '@/lib/legal';

// The dark footer that carries the legal links. It appears on the sign-in screen
// and on both legal documents, so the disclosure is never more than one click
// from anyone who is about to sign in.
export default function LegalFooter() {
  return (
    <footer className="bg-[#202020]">
      <div className="mx-auto max-w-5xl px-5 py-4 sm:py-6">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-[#ff682c]" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-widest text-white">
              {LEGAL.productName}
            </span>
          </div>

          <nav aria-label="Legal" className="flex items-center gap-5 sm:gap-6">
            {LEGAL_DOCS.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className="font-mono text-[10px] uppercase tracking-widest text-[#8f8f8f] transition-colors hover:text-white"
              >
                {doc.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-3 border-t border-[#3a3a3a] pt-3 sm:mt-4 sm:pt-4">
          <p className="text-center text-[10px] leading-snug text-[#8f8f8f] sm:text-left sm:text-[11px] sm:leading-relaxed">
            © {new Date().getFullYear()} {LEGAL.productName}. Team accounts and customer records are stored
            and processed on Supabase (PostgreSQL and Supabase Auth).
          </p>
        </div>
      </div>
    </footer>
  );
}
