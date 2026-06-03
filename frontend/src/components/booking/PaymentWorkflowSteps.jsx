import { ClipboardList, QrCode, Upload, UserCheck, Mail } from 'lucide-react';

const steps = [
  { icon: ClipboardList, title: 'Submit request', desc: 'Complete the form with room, stay dates, guest details, and valid ID.' },
  { icon: QrCode, title: 'Pay downpayment', desc: 'Pay the required deposit via GCash, Maya, BDO, or BPI QR with your booking reference.' },
  { icon: Upload, title: 'Upload proof', desc: 'Submit payment proof — we email you once it is received.' },
  { icon: UserCheck, title: 'Staff verifies', desc: 'Our booking team confirms your payment is reflected on our end.' },
  { icon: Mail, title: 'Confirmation email', desc: 'Once verified, you receive your booking confirmation by email.' },
];

export default function PaymentWorkflowSteps({ currentStep = 1 }) {
  return (
    <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const active = i + 1 === currentStep;
        const done = i + 1 < currentStep;
        return (
          <li
            key={step.title}
            className={`p-4 rounded-xl border text-sm ${
              active
                ? 'border-aegean-600 bg-aegean-50'
                : done
                  ? 'border-green-200 bg-green-50'
                  : 'border-aegean-100 bg-white'
            }`}
          >
            <Icon
              className={`w-6 h-6 mb-2 ${active ? 'text-aegean-600' : done ? 'text-green-600' : 'text-aegean-300'}`}
            />
            <p className="font-medium text-aegean-800">{step.title}</p>
            <p className="text-aegean-600/80 mt-1 text-xs leading-relaxed">{step.desc}</p>
          </li>
        );
      })}
    </ol>
  );
}

export const PAYMENT_METHOD_LABELS = {
  gcash: 'GCash QR',
  maya: 'Maya QR',
  bdo: 'BDO QR',
  bpi: 'BPI QR',
  other: 'Bank Transfer',
};
