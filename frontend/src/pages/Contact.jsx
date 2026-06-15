import { useState } from 'react';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import api, { getApiError } from '../api/client';
import StaticPageLayout from '../components/layout/StaticPageLayout';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { pages, images, resort } from '../data/placeholders';

export default function Contact() {
  const { contact } = pages;
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Send message?',
      message: 'We will receive your inquiry and reply as soon as we can.',
      confirmLabel: 'Yes, send message',
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.post('/contact', form);
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      toast.success('Message sent! We will reply soon.');
    } catch (err) {
      toast.error(getApiError(err) || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StaticPageLayout hero={{ ...contact, image: images.contact }}>
      <div className="space-y-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:items-start">
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif text-aegean-800">{contact.introTitle}</h2>
              <p className="mt-4 text-aegean-600/90 leading-relaxed">{contact.introText}</p>
            </div>

            <div className="space-y-4">
              {[
                { icon: MapPin, text: resort.location, href: resort.mapsUrl },
                { icon: Phone, text: resort.phone, href: `tel:${resort.phoneTel}` },
                { icon: Mail, text: resort.email, href: `mailto:${resort.email}` },
              ].map(({ icon: Icon, text, href }) => (
                <p key={text} className="flex items-start gap-3 text-aegean-700">
                  <Icon className="text-aegean-500 shrink-0 mt-0.5" size={20} />
                  {href ? <a href={href} className="hover:text-aegean-600">{text}</a> : text}
                </p>
              ))}
            </div>

            <div>
              <p className="flex items-center gap-2 font-medium text-aegean-800 mb-3">
                <Clock size={18} /> Hours
              </p>
              <ul className="space-y-2 text-sm text-aegean-600">
                {contact.hours.map((h) => (
                  <li key={h.day} className="flex justify-between gap-4 border-b border-aegean-100 pb-2">
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded-2xl shadow-md space-y-4 border border-aegean-100"
          >
            {['name', 'email', 'phone', 'subject'].map((field) => (
              <input
                key={field}
                type={field === 'email' ? 'email' : 'text'}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required={['name', 'email', 'message'].includes(field)}
                className="w-full border border-aegean-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-aegean-400"
              />
            ))}
            <textarea
              placeholder="Message"
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
              className="w-full border border-aegean-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-aegean-400"
            />
            <SubmitButton loading={loading} loadingLabel="Sending..." className="w-full">
              Send Message
            </SubmitButton>
          </form>
        </div>

        <div className="w-full rounded-2xl overflow-hidden border border-aegean-100 shadow-sm">
          <iframe
            title="Caza Buena on Google Maps"
            src={resort.mapsEmbedUrl}
            className="w-full h-[min(420px,50vh)] border-0 block"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <a
            href={resort.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm font-medium text-aegean-600 bg-aegean-50 py-3 hover:bg-aegean-100 transition-colors"
          >
            Open in Google Maps →
          </a>
        </div>
      </div>
    </StaticPageLayout>
  );
}
