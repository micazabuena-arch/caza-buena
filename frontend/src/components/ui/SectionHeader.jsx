export default function SectionHeader({ eyebrow, title, subtitle, center = true }) {
  return (
    <div className={`mb-12 ${center ? 'text-center' : ''}`}>
      {eyebrow && (
        <p className="text-aegean-500 text-sm uppercase tracking-[0.2em] mb-2">{eyebrow}</p>
      )}
      <h2 className="text-3xl md:text-4xl lg:text-5xl text-aegean-800">{title}</h2>
      {subtitle && (
        <p className={`mt-4 text-aegean-600/80 text-lg max-w-2xl ${center ? 'mx-auto' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
