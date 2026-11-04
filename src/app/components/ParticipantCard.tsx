import type { ReactNode } from 'react';
import type { CardSettings, ISODate } from '@/shared/api/types';
import { formatDateTime, formatTime } from '@/shared/lib/format';

export interface CardParticipant {
  full_name: string;
  username: string;
  external_id: string | null;
  seat: string | null;
}

export interface CardSession {
  exam_title: string;
  name: string;
  room: string | null;
  starts_at: ISODate;
  ends_at: ISODate;
}

/**
 * ParticipantCard is one printed participant card (66 mm tall, see .card-cut in styles.css),
 * laid out by the institution's card settings. Name, username and password always show:
 * the card is how the participant signs in. Used by the print page and the settings preview.
 */
export function ParticipantCard({
  institution,
  card,
  participant: p,
  session: s,
  password,
  qr,
}: {
  institution: { name: string; logo_url: string | null };
  card: CardSettings;
  participant: CardParticipant;
  session: CardSession;
  password?: string;
  qr?: string;
}) {
  const signer = !!(card.signer_title || card.signer_name || card.signature_url);
  // with a signature block the right column is taller, so the QR shrinks and the exam title
  // keeps to one line: everything has to fit 66 mm, notes included
  const qrSize = signer ? 'h-[14mm] w-[14mm]' : 'h-[22mm] w-[22mm]';
  return (
    <section className="card-cut flex flex-col">
      <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5">
        {institution.logo_url && <img src={institution.logo_url} alt="" className="h-7 w-7 object-contain" />}
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-600">{institution.name}</p>
          <p className="truncate text-[12px] font-bold">{card.title}</p>
        </div>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 gap-3 overflow-hidden">
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] content-start gap-x-2 gap-y-0.5">
          <Row label="Nama">
            <span className="font-semibold">{p.full_name}</span>
          </Row>
          <Row label="Username">
            <span className="font-mono font-semibold">{p.username}</span>
          </Row>
          {card.show_external_id && p.external_id && (
            <Row label={card.id_label}>
              <span className="font-mono">{p.external_id}</span>
            </Row>
          )}
          <dt className="max-w-[26mm] truncate text-slate-500">Password</dt>
          {password ? <dd className="font-mono text-[12px] font-bold tracking-wider">{password}</dd> : <dd className="border-b border-dotted border-slate-400">&nbsp;</dd>}
          {card.show_exam && (
            <>
              <dt className="max-w-[26mm] truncate text-slate-500">Ujian</dt>
              <dd className={signer ? 'truncate' : 'line-clamp-2'}>{s.exam_title}</dd>
            </>
          )}
          {card.show_session && (
            <Row label="Sesi">
              {s.name}
              {s.room && ` · ${s.room}`}
            </Row>
          )}
          {card.show_seat && p.seat && (
            <Row label="Kursi">
              <span className="font-semibold tabular-nums">{p.seat}</span>
            </Row>
          )}
          {card.show_schedule && (
            <Row label="Jadwal" wrap>
              <span className="tabular-nums">
                {formatDateTime(s.starts_at)}–{formatTime(s.ends_at)}
              </span>
            </Row>
          )}
        </dl>
        {(card.show_qr || signer) && (
          <div className={`flex shrink-0 flex-col items-center gap-1 text-center ${signer ? 'w-[30mm]' : 'w-[22mm]'}`}>
            {card.show_qr && (
              <>
                {qr ? <img src={qr} alt={`QR masuk ${p.username}`} className={qrSize} /> : <span className={qrSize} />}
                {!signer && <span className="text-[9px] leading-tight text-slate-500">Pindai untuk membuka halaman masuk</span>}
              </>
            )}
            {signer && (
              <div className="flex w-full flex-col items-center text-[9px] leading-tight">
                {card.signer_title && <p className="w-full truncate">{card.signer_title}</p>}
                {card.signature_url ? <img src={card.signature_url} alt="" className="my-0.5 h-[8mm] max-w-full object-contain" /> : <span className="h-[8mm]" />}
                {card.signer_name && <p className="w-full truncate font-semibold underline underline-offset-1">{card.signer_name}</p>}
                {card.signer_number && <p className="line-clamp-2 w-full">{card.signer_number}</p>}
              </div>
            )}
          </div>
        )}
      </div>
      {card.note && <p className="mt-1 line-clamp-2 border-t border-slate-200 pt-1 text-[9px] leading-tight text-slate-600">{card.note}</p>}
    </section>
  );
}

function Row({ label, wrap, children }: { label: string; wrap?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="max-w-[26mm] truncate text-slate-500">{label}</dt>
      <dd className={wrap ? 'line-clamp-2' : 'truncate'}>{children}</dd>
    </>
  );
}
