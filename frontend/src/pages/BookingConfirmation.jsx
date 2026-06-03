import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Upload, QrCode, CheckCircle, Copy, Mail } from 'lucide-react';
import api, { getApiError } from '../api/client';
import PageHero from '../components/ui/PageHero';
import PaymentWorkflowSteps, { PAYMENT_METHOD_LABELS } from '../components/booking/PaymentWorkflowSteps';
import PaymentMethodSelect from '../components/booking/PaymentMethodSelect';
import SeniorIdUploadPanel from '../components/booking/SeniorIdUploadPanel';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { images } from '../data/placeholders';
import { parseIslandHoppingData } from '../data/islandHoppingRates';

function workflowStep(status) {
  if (status === 'confirmed') return 5;
  if (status === 'payment_submitted') return 4;
  return 2;
}

export default function BookingConfirmation() {
  const { reference } = useParams();
  const [booking, setBooking] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/bookings/reference/${reference}`),
      api.get('/payment-methods'),
    ])
      .then(([b, p]) => {
        setBooking(b.data);
        setPaymentMethods(p.data);
        if (b.data.payment_method_id) {
          setPaymentMethodId(String(b.data.payment_method_id));
        } else if (p.data[0]?.id) {
          setPaymentMethodId(String(p.data[0].id));
        }
      })
      .finally(() => setLoading(false));
  }, [reference]);

  const copyRef = () => {
    navigator.clipboard.writeText(booking.reference_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const ok = await confirm({
      title: 'Submit payment proof?',
      message: 'Make sure your screenshot or receipt is clear and shows the correct amount.',
      confirmLabel: 'Yes, submit proof',
    });
    if (!ok) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('proof', file);
    if (paymentMethodId) formData.append('payment_method_id', paymentMethodId);

    try {
      const { data } = await api.post(`/bookings/${reference}/payment-proof`, formData);
      setUploadSuccess(true);
      setBooking((b) => ({ ...b, status: 'payment_submitted' }));
      if (data.email_sent) {
        toast.success(
          `Payment proof submitted. A booking request email was sent to ${booking.guest_email}.`
        );
      } else if (data.email_hint) {
        toast.warning(`Payment proof saved. ${data.email_hint}`);
      } else {
        toast.success('Payment proof submitted. We will verify and confirm your booking.');
      }
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Loading />;
  if (!booking) return <p className="text-center py-24">Booking not found.</p>;

  const selectedPayment =
    paymentMethods.find((p) => String(p.id) === paymentMethodId) ||
    (booking?.payment_method_id
      ? {
          id: booking.payment_method_id,
          name: booking.payment_method_name,
          type: booking.payment_method_type,
          qr_image_url: booking.payment_qr_image_url,
          account_name: booking.payment_account_name,
          account_number: booking.payment_account_number,
          instructions: booking.payment_instructions,
        }
      : null);
  const islandHop = booking?.island_hopping ? parseIslandHoppingData(booking.island_hopping_data) : null;

  const handleSeniorIdUpdated = (passengerIndex, seniorIdUrl) => {
    setBooking((prev) => {
      if (!prev?.island_hopping) return prev;
      const data = parseIslandHoppingData(prev.island_hopping_data);
      if (!data?.passengers?.[passengerIndex]) return prev;
      data.passengers[passengerIndex] = {
        ...data.passengers[passengerIndex],
        senior_id_url: seniorIdUrl,
      };
      return { ...prev, island_hopping_data: data };
    });
  };
  const step = uploadSuccess ? 4 : workflowStep(booking.status);
  const showPayment = !['confirmed', 'payment_submitted'].includes(booking.status) && !uploadSuccess;

  return (
    <>
      <PageHero
        eyebrow="Booking Reference"
        title={booking.reference_code}
        subtitle="Complete your QR payment and upload proof below."
        image={images.pageHero}
        imagePosition={images.pageHeroObjectPosition}
      />
      <section className="section-padding">
        <div className="container-narrow max-w-4xl">
          <div className="mb-10">
            <h2 className="text-lg font-serif text-aegean-800 mb-4">Booking process</h2>
            <PaymentWorkflowSteps currentStep={step} />
          </div>

          <div className="bg-aegean-50 rounded-2xl p-6 mb-8 space-y-3 text-aegean-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-lg font-medium">{booking.reference_code}</p>
              <button type="button" onClick={copyRef} className="text-sm text-aegean-600 flex items-center gap-1 hover:text-aegean-800">
                <Copy size={14} /> {copied ? 'Copied!' : 'Copy reference'}
              </button>
            </div>
            <p><strong>Guest:</strong> {booking.guest_name} · {booking.guest_email} · {booking.guest_phone}</p>
            <p><strong>Room:</strong> {booking.room_name}</p>
            <p><strong>Check-in / Check-out:</strong> {booking.check_in} → {booking.check_out} ({booking.nights} nights)</p>
            <p className="text-2xl font-serif text-aegean-700">
              <strong>Pay now:</strong> ₱{Number(booking.amount_to_pay ?? booking.total_amount).toLocaleString()}
            </p>
            {Number(booking.amount_to_pay) < Number(booking.total_amount) && (
              <p className="text-sm text-aegean-600">
                Booking total: ₱{Number(booking.total_amount).toLocaleString()} · Balance: ₱
                {(Number(booking.total_amount) - Number(booking.amount_to_pay)).toLocaleString()}
              </p>
            )}
            <p className="text-sm capitalize">
              <strong>Status:</strong>{' '}
              <span className="inline-block px-2 py-0.5 rounded-full bg-white">{booking.status.replace(/_/g, ' ')}</span>
            </p>
          </div>

          {booking.status === 'awaiting_payment' && (
            <p className="flex items-start gap-2 text-sm text-aegean-600 mb-6 p-4 bg-white rounded-xl border border-aegean-100">
              <Mail className="shrink-0 mt-0.5" size={18} />
              After you upload payment proof, we will email {booking.guest_email} to confirm we received it.
              Your final booking confirmation email is sent once our team verifies payment.
            </p>
          )}

          {booking.status === 'confirmed' ? (
            <div className="flex items-center gap-3 p-6 bg-green-50 text-green-800 rounded-2xl">
              <CheckCircle size={24} /> Your booking is confirmed! We sent a confirmation email. See you at Caza Buena.
            </div>
          ) : uploadSuccess || booking.status === 'payment_submitted' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-6 bg-green-50 text-green-800 rounded-2xl">
                <CheckCircle size={24} /> Payment proof received. Check {booking.guest_email} for a receipt email.
                Our team will verify payment and send your booking confirmation when approved.
              </div>
              <Link to="/" className="btn-outline inline-block text-center">Back to home</Link>
            </div>
          ) : showPayment && (
            <>
              <h3 className="font-serif text-2xl text-aegean-800 mb-2 flex items-center gap-2">
                <QrCode /> QR payment instructions
              </h3>
              <p className="text-aegean-600 text-sm mb-6">
                {booking.payment_method_id
                  ? `You chose ${PAYMENT_METHOD_LABELS[booking.payment_method_type] || booking.payment_method_name}. Scan the QR below to pay.`
                  : 'Choose how you will pay, then scan the QR code shown.'}{' '}
                Use reference <strong>{booking.reference_code}</strong> in the payment notes.
              </p>

              <div className="mb-8">
                <PaymentMethodSelect
                  methods={paymentMethods}
                  value={paymentMethodId}
                  onChange={setPaymentMethodId}
                  reference={booking.reference_code}
                  amountDue={booking.amount_to_pay ?? booking.total_amount}
                  required
                />
              </div>

              <form onSubmit={handleUpload} className="bg-white p-6 rounded-2xl border border-aegean-100 space-y-4 shadow-sm">
                <h4 className="font-medium flex items-center gap-2 text-aegean-800">
                  <Upload size={18} /> Step 3: Upload payment proof
                </h4>
                <p className="text-xs text-aegean-500">JPG, PNG, WebP, or PDF — max 10MB</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                  className="w-full text-sm border border-aegean-200 rounded-lg p-2"
                />
                <SubmitButton loading={uploading} loadingLabel="Uploading..." className="w-full">
                  Submit payment proof
                </SubmitButton>
              </form>
            </>
          )}

          {islandHop && (
            <SeniorIdUploadPanel
              reference={booking.reference_code}
              islandHop={islandHop}
              onUpdated={handleSeniorIdUpdated}
            />
          )}
        </div>
      </section>
    </>
  );
}
