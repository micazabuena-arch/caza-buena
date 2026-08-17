import { useEffect, useState } from 'react';

import api, { getApiError } from '../api/client';

import Loading from '../components/ui/Loading';

import SubmitButton from '../components/ui/SubmitButton';

import UploadLabelButton from '../components/ui/UploadLabelButton';

import { useToast } from '../context/ToastContext';

import { useConfirm } from '../context/ConfirmContext';

import { getAssetUrl } from '../utils/assetUrl';
import { useDirtySnapshot, useUnsavedNavigation } from '../hooks/useConfirmLeave';



const EMPTY_SLIDE = { image_url: '', heading: '', text: '' };



const EMPTY_FORM = {

  heading: '',

  text: '',

  slides: [EMPTY_SLIDE, EMPTY_SLIDE, EMPTY_SLIDE],

};



function normalizeData(data) {

  const slides = Array.isArray(data?.slides) ? data.slides : [];

  const images = Array.isArray(data?.images) ? data.images : [];

  return {

    heading: data?.heading || '',

    text: data?.text || '',

    slides: [0, 1, 2].map((i) => ({

      image_url: slides[i]?.image_url || images[i] || '',

      heading: slides[i]?.heading || '',

      text: slides[i]?.text || '',

    })),

  };

}



export default function WhatsNewAdmin() {

  const [form, setForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [uploadingSlot, setUploadingSlot] = useState(null);

  const [error, setError] = useState('');

  const toast = useToast();

  const confirm = useConfirm();
  const [whatsNewBaselineKey, setWhatsNewBaselineKey] = useState(0);
  const whatsNewDirty = useDirtySnapshot(form, !loading, whatsNewBaselineKey);
  useUnsavedNavigation(whatsNewDirty);



  const load = () =>

    api

      .get('/whats-new')

      .then((r) => setForm(normalizeData(r.data)))

      .catch(() => setForm(EMPTY_FORM))

      .finally(() => setLoading(false));



  useEffect(() => {

    load();

  }, []);



  const updateSlide = (index, patch) => {

    setForm((prev) => {

      const nextSlides = [...prev.slides];

      nextSlides[index] = { ...nextSlides[index], ...patch };

      return { ...prev, slides: nextSlides };

    });

  };



  const handleUpload = async (slot, file) => {

    if (!file) return;



    const ok = await confirm({

      title: `Upload image ${slot}?`,

      message: 'This will replace the current slide image.',

      confirmLabel: 'Yes, upload',

    });

    if (!ok) return;



    setUploadingSlot(slot);

    try {

      const body = new FormData();

      body.append('slot', String(slot));

      body.append('image', file);

      const { data } = await api.post('/whats-new/admin/upload', body);

      setForm(normalizeData(data));

      toast.success(`Image ${slot} uploaded.`);
      setWhatsNewBaselineKey((n) => n + 1);

    } catch (err) {

      toast.error(getApiError(err));

    } finally {

      setUploadingSlot(null);

    }

  };



  const save = async (e) => {

    e.preventDefault();

    const ok = await confirm({

      title: "Save What's New page?",

      message: 'This updates the public page heading, intro text, and all slide content.',

      confirmLabel: 'Yes, save',

    });

    if (!ok) return;



    setSaving(true);

    setError('');

    try {

      const payload = {

        heading: form.heading.trim(),

        text: form.text.trim(),

        slides: form.slides.map((slide) => ({

          image_url: String(slide.image_url || '').trim(),

          heading: String(slide.heading || '').trim(),

          text: String(slide.text || '').trim(),

        })),

      };

      const { data } = await api.put('/whats-new/admin', payload);

      setForm(normalizeData(data));

      toast.success("What's New page updated.");
      setWhatsNewBaselineKey((n) => n + 1);

    } catch (err) {

      const msg = getApiError(err);

      setError(msg);

      toast.error(msg);

    } finally {

      setSaving(false);

    }

  };



  if (loading) return <Loading />;



  return (

    <div className="space-y-6">

      <div>

        <h1 className="text-3xl font-serif text-aegean-800 mb-2">What&apos;s New</h1>

        <p className="text-sm text-aegean-600">

          Three slides with image, heading, and paragraph each. Page heading and intro appear above the slider.

        </p>

      </div>



      <form onSubmit={save} className="bg-white rounded-xl p-6 shadow-sm space-y-5">

        {error && <p className="text-sm text-red-600">{error}</p>}



        <div className="border-b border-aegean-100 pb-5 space-y-4">

          <p className="text-sm font-medium text-aegean-800">Page intro (above slider)</p>

          <div>

            <label className="block text-sm font-medium text-aegean-700 mb-1.5">Heading</label>

            <input

              value={form.heading}

              onChange={(e) => setForm((prev) => ({ ...prev, heading: e.target.value }))}

              className="w-full border border-aegean-200 rounded-lg px-3 py-2.5"

              placeholder="What's New at Caza Buena"

              required

            />

          </div>

          <div>

            <label className="block text-sm font-medium text-aegean-700 mb-1.5">Intro text</label>

            <textarea

              value={form.text}

              onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}

              className="w-full border border-aegean-200 rounded-lg px-3 py-2.5"

              rows={3}

              placeholder="Short intro above the slider."

              required

            />

          </div>

        </div>



        <div className="grid md:grid-cols-3 gap-4">

          {[1, 2, 3].map((slot) => {

            const index = slot - 1;

            const slide = form.slides[index] || EMPTY_SLIDE;

            return (

              <div key={slot} className="border border-aegean-100 rounded-xl p-3 space-y-3">

                <p className="text-sm font-medium text-aegean-700">Slide {slot}</p>



                <div>

                  <label className="block text-xs font-medium text-aegean-600 mb-1">Slide heading</label>

                  <input

                    value={slide.heading}

                    onChange={(e) => updateSlide(index, { heading: e.target.value })}

                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm"

                    placeholder="e.g. New pool hours"

                  />

                </div>



                <div>

                  <label className="block text-xs font-medium text-aegean-600 mb-1">Slide paragraph</label>

                  <textarea

                    value={slide.text}

                    onChange={(e) => updateSlide(index, { text: e.target.value })}

                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm"

                    rows={3}

                    placeholder="Describe this update..."

                  />

                </div>



                <div className="aspect-[4/3] rounded-lg overflow-hidden bg-aegean-50 border border-aegean-100">

                  {slide.image_url ? (

                    <img

                      src={getAssetUrl(slide.image_url)}

                      alt={slide.heading || `What's New slide ${slot}`}

                      className="w-full h-full object-cover"

                    />

                  ) : (

                    <div className="w-full h-full grid place-items-center text-xs text-aegean-400">

                      No image yet

                    </div>

                  )}

                </div>



                <UploadLabelButton

                  loading={uploadingSlot === slot}

                  inputProps={{

                    accept: 'image/*',

                    onChange: (e) => {

                      const file = e.target.files?.[0];

                      handleUpload(slot, file);

                      e.target.value = '';

                    },

                  }}

                  className="w-full text-sm"

                >

                  Upload slide {slot}

                </UploadLabelButton>



                <input

                  value={slide.image_url}

                  onChange={(e) => updateSlide(index, { image_url: e.target.value })}

                  className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-xs"

                  placeholder="Paste image URL (optional)"

                />

              </div>

            );

          })}

        </div>



        <div className="pt-2">

          <SubmitButton loading={saving} loadingLabel="Saving..." className="text-sm">

            Save What&apos;s New

          </SubmitButton>

        </div>

      </form>

    </div>

  );

}

