import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import QuotationDocument from '../components/admin/QuotationDocument';
import Loading from '../components/ui/Loading';
import { clearMirroredAdminToken } from '../utils/islandHoppingPrintCache';
import {
  clearQuotationPrintCache,
  readQuotationPrintCache,
} from '../utils/quotationPrintCache';

/** Standalone print page — no admin sidebar, no login required when quote is cached. */
export default function QuotationPrint() {
  const [quote, setQuote] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setQuote(readQuotationPrintCache());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(() => window.print(), 700);
    return () => clearTimeout(timer);
  }, [quote]);

  useEffect(() => {
    const onPageHide = () => {
      clearQuotationPrintCache();
      clearMirroredAdminToken();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  if (!ready) return <Loading />;

  if (!quote) {
    return (
      <div className="min-h-screen bg-white p-8 text-center">
        <p className="text-aegean-700 mb-4">No quotation to print. Build one first.</p>
        <Link to="/admin/quotation" className="text-aegean-600 underline">
          Back to quotation
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-6 md:p-10 print:p-0">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          .quotation-doc, .quotation-doc * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="no-print max-w-[8.5in] mx-auto mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aegean-600 text-white text-sm hover:bg-aegean-700"
        >
          <Printer size={16} /> Print
        </button>
        <Link
          to="/admin/quotation"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50"
        >
          <X size={16} /> Back to quotation
        </Link>
      </div>

      <QuotationDocument quote={quote} />
    </div>
  );
}
