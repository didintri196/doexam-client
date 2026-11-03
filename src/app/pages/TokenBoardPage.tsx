import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import type { Session } from '@/shared/api/types';
import { Brand, usePublicTenant } from '@/shared/auth/pages';
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
  const period = session.token_rotation_minutes ? session.token_rotation_minutes * 60 : 0;
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 px-8 py-10 text-white">
      <div className="flex items-center gap-3">
        <Brand tenant={tenant} />
        <p className="text-lg font-medium text-slate-300">{tenant?.name}</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">{session.exam.title}</h1>
        <p className="mt-3 text-xl tabular-nums text-slate-400">
          {session.name}
          {session.room && ` · ${session.room}`} · {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
        </p>
        <div className="mt-14 w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 px-10 py-12">
          <p className="text-lg font-medium text-slate-400">Token ruang</p>
          {!enabled ? (
            <p className="mt-6 text-3xl text-slate-400">{session.token_required ? 'Token tidak aktif' : 'Tanpa token'}</p>
          ) : token.data ? (
            <>
              <p className="mt-6 font-mono text-[16vw] font-semibold leading-none tracking-[0.12em] sm:text-[9rem]">{token.data.code}</p>
              <div className="mx-auto mt-10 max-w-md">
                {period > 0 && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-blue-500 transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (left / period) * 100)}%` }} />
                  </div>
                )}
                <p className="mt-3 text-xl tabular-nums text-slate-400">Berganti dalam {formatClock(left)}</p>
              </div>
            </>
          ) : (
            <p className="mt-6 text-2xl text-slate-500">Memuat…</p>
          )}
        </div>
        <p className="mt-12 text-xl text-slate-400">
          Buka <span className="font-mono text-white">/exam</span> di komputer Anda, pilih ujian, lalu masukkan token di atas.
        </p>
      </div>
    </div>
  );
}
