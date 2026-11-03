import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import type { Session } from '@/shared/api/types';
import { usePublicTenant } from '@/shared/auth/pages';
import { formatClock, formatTime } from '@/shared/lib/format';
import { Loading } from '@/shared/ui';
import { sessionApi } from '../api';
import { useToken } from './SessionDetailPage';

/** TokenBoardPage is shown on the room projector: the current token, big. */
export function TokenBoardPage() {
  const { id = '' } = useParams();
  const session = useQuery({ queryKey: ['session', id], queryFn: () => sessionApi.get(id), refetchInterval: 60_000 });
  if (!session.data) return <Loading />;
  return <Board session={session.data} />;
}

function Board({ session }: { session: Session }) {
  const { token, left, enabled } = useToken(session);
  const { data: tenant } = usePublicTenant();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-8 text-center text-white">
      <p className="text-lg text-slate-400">{tenant?.name}</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{session.exam.title}</h1>
      <p className="mt-2 text-xl text-slate-300">
        {session.name}
        {session.room && ` · ${session.room}`} · {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
      </p>
      <div className="mt-12 rounded-3xl border border-slate-700 bg-slate-900 px-12 py-10">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Token ruang</p>
        {!enabled ? (
          <p className="mt-6 text-3xl text-slate-400">{session.token_required ? 'Token tidak aktif' : 'Tanpa token'}</p>
        ) : token.data ? (
          <>
            <p className="mt-4 font-mono text-[18vw] font-extrabold leading-none tracking-[0.15em] text-white sm:text-[10rem]">{token.data.code}</p>
            <p className="mt-4 font-mono text-2xl text-slate-400">berganti dalam {formatClock(left)}</p>
          </>
        ) : (
          <p className="mt-6 text-2xl text-slate-500">memuat…</p>
        )}
      </div>
      <p className="mt-10 text-lg text-slate-500">Buka /exam di komputer Anda, pilih ujian, lalu masukkan token di atas.</p>
    </div>
  );
}
