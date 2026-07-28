import { getAssetUrl } from '../../utils/assetUrl';
import { isSeniorPassenger, isPwdPassenger } from '../../data/islandHoppingRates';
import { formatDateTimePHT } from '../../utils/datetime';

/** Printable island hopping manifest (booking + parsed island_hopping_data) */
export default function IslandHoppingManifest({ booking, islandHop }) {
  if (!booking || !islandHop) return null;

  const passengers = islandHop.passengers || [];

  return (
    <article className="text-[#0D4F6C] max-w-3xl mx-auto">
      <header className="border-b-2 border-[#1E6B8C] pb-4 mb-6">
        <h1 className="text-2xl font-serif m-0">Caza Buena — Island Hopping Manifest</h1>
        <p className="text-sm mt-2">
          <strong>Reference:</strong> {booking.reference_code}
        </p>
        <p className="text-sm">
          <strong>Guest:</strong> {booking.guest_name} · {booking.guest_email}
          {booking.guest_phone ? ` · ${booking.guest_phone}` : ''}
        </p>
        <p className="text-sm">
          <strong>Room stay:</strong> {booking.check_in} → {booking.check_out} ({booking.nights}{' '}
          nights)
        </p>
        <p className="text-sm">
          <strong>Room:</strong> {booking.room_name}
        </p>
        {islandHop.boat_label && (
          <p className="text-sm">
            <strong>Boat:</strong> {islandHop.boat_label}
          </p>
        )}
        <p className="text-sm font-semibold mt-2">
          <strong>Tour total:</strong> ₱
          {Number(booking.island_hopping_amount || islandHop.total || 0).toLocaleString()}
        </p>
      </header>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wide text-[#1E6B8C] mb-2">Passengers</h2>
        {islandHop.soa_summary ? (
          <p className="text-sm">
            SOA summary: <strong>{islandHop.summary_pax || islandHop.passenger_count || 0} pax</strong>{' '}
            · total recorded on this booking
          </p>
        ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#f0f7fa]">
              <th className="border border-gray-300 p-2 text-left">#</th>
              <th className="border border-gray-300 p-2 text-left">Name</th>
              <th className="border border-gray-300 p-2 text-left">Age</th>
              <th className="border border-gray-300 p-2 text-left">Gender</th>
              <th className="border border-gray-300 p-2 text-left">First timer</th>
              <th className="border border-gray-300 p-2 text-left">Senior</th>
              <th className="border border-gray-300 p-2 text-left">Senior ID</th>
              <th className="border border-gray-300 p-2 text-left">PWD</th>
              <th className="border border-gray-300 p-2 text-left">PWD ID</th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((p, i) => {
              const senior = isSeniorPassenger(p);
              const pwd = isPwdPassenger(p);
              return (
                <tr key={i}>
                  <td className="border border-gray-300 p-2">{i + 1}</td>
                  <td className="border border-gray-300 p-2">{p.full_name}</td>
                  <td className="border border-gray-300 p-2">{p.age}</td>
                  <td className="border border-gray-300 p-2">{p.gender}</td>
                  <td className="border border-gray-300 p-2">
                    {p.is_first_timer ? 'Yes' : 'No'}
                  </td>
                  <td className="border border-gray-300 p-2">{senior ? 'Yes' : 'No'}</td>
                  <td className="border border-gray-300 p-2">
                    {senior && p.senior_id_url ? (
                      String(p.senior_id_url).toLowerCase().includes('.pdf') ? (
                        <span>PDF on file — {getAssetUrl(p.senior_id_url)}</span>
                      ) : (
                        <img
                          src={getAssetUrl(p.senior_id_url)}
                          alt={`Senior ID — ${p.full_name}`}
                          className="max-w-[140px] max-h-[100px] object-contain"
                        />
                      )
                    ) : senior ? (
                      <em>Not uploaded</em>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="border border-gray-300 p-2">{pwd ? 'Yes' : 'No'}</td>
                  <td className="border border-gray-300 p-2">
                    {pwd && p.pwd_id_url ? (
                      String(p.pwd_id_url).toLowerCase().includes('.pdf') ? (
                        <span>PDF on file — {getAssetUrl(p.pwd_id_url)}</span>
                      ) : (
                        <img
                          src={getAssetUrl(p.pwd_id_url)}
                          alt={`PWD ID — ${p.full_name}`}
                          className="max-w-[140px] max-h-[100px] object-contain"
                        />
                      )
                    ) : pwd ? (
                      <em>Not uploaded</em>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </section>

      <section className="mb-4 text-sm">
        <h2 className="text-sm uppercase tracking-wide text-[#1E6B8C] mb-1">
          Address of passengers
        </h2>
        <p>{islandHop.passenger_address}</p>
      </section>

      <section className="mb-4 text-sm">
        <h2 className="text-sm uppercase tracking-wide text-[#1E6B8C] mb-1">Payor</h2>
        <p>{islandHop.payor_name}</p>
        <p>{islandHop.payor_address}</p>
        <p>{islandHop.payor_phone}</p>
      </section>

      <section className="mb-6 text-sm">
        <h2 className="text-sm uppercase tracking-wide text-[#1E6B8C] mb-1">
          Emergency contact (not on tour)
        </h2>
        <p>{islandHop.emergency_contact_name}</p>
        <p>{islandHop.emergency_contact_phone}</p>
      </section>

      {islandHop.breakdown?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-wide text-[#1E6B8C] mb-2">Fee breakdown</h2>
          <table className="w-full text-xs border-collapse">
            <tbody>
              {islandHop.breakdown.map((line, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 p-2">{line.description}</td>
                  <td className="border border-gray-300 p-2 text-right whitespace-nowrap">
                    ₱{Number(line.subtotal).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-[11px] text-gray-500">Printed {formatDateTimePHT(new Date())}</p>
    </article>
  );
}
