import Link from 'next/link';
import { LEGAL, LEGAL_DOCS } from '@/lib/legal';

// The dark footer that carries the legal links and the storage disclosure.
//
// Desktop only: hidden below md, where the height is not worth the screen it
// costs. That is why none of the sm: variants this component used to carry for a
// stacked phone layout remain — the row it renders is always the wide one, so
// there is no phone arrangement left to keep in step.
//
// A phone still reaches both documents from the sign-in screen, which states the
// acceptance and links them in components/LoginScreen.tsx.
export default function LegalFooter() {
  return (
    <footer className="hidden md:block bg-[#202020]">
      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-[#ff682c]" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-widest text-white">
              {LEGAL.productName}
            </span>
          </div>

          <nav aria-label="Legal" className="flex items-center gap-6">
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

        <div className="mt-4 border-t border-[#3a3a3a] pt-4">
          <p className="text-left text-[11px] leading-relaxed text-[#8f8f8f]">
            © {new Date().getFullYear()} {LEGAL.productName}. Team accounts and customer records are stored
            and processed on Supabase (PostgreSQL and Supabase Auth).
          </p>
        </div>
      </div>
    </footer>
  );
}
