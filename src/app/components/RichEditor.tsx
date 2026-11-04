import { AudioLines, Bold, ImagePlus, Italic, List, ListOrdered, Sigma, Subscript, Superscript, Trash2, Underline } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { hydrateMedia, useMedia } from '@/shared/item/media';
import { RichContent, sanitize } from '@/shared/item/RichContent';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { Button, Checkbox, cx, Input, Spinner } from '@/shared/ui';
import { mediaApi } from '../api';
import { shrinkImage } from './imageResize';
import { panelMedia } from './MediaProvider';

// Light rich-text editor for item stems, options, stimuli and explanations. Output is HTML
// within the server allowlist (§4.1); formulas are stored as <span data-math="LaTeX">.
// TipTap + MathLive can replace it later without changing the stored format.

function prepare(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-math], [data-math-block]').forEach((n) => {
    n.contentEditable = 'false';
    n.textContent = n.getAttribute('data-math') ?? n.getAttribute('data-math-block') ?? '';
  });
}

// execCommand writes <b>/<i>; the server allowlist only keeps <strong>/<em>.
const renames: Record<string, string> = { B: 'strong', I: 'em', STRIKE: 's' };
function normalizeTags(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  root.querySelectorAll('b, i, strike').forEach((el) => {
    const repl = document.createElement(renames[el.tagName]);
    repl.append(...el.childNodes);
    el.replaceWith(repl);
  });
  return root.innerHTML;
}

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 'min-h-24',
  invalid,
  preview = true,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  invalid?: boolean;
  preview?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>('');
  const [mathOpen, setMathOpen] = useState(false);
  const [tex, setTex] = useState('');
  const saved = useRef<Range | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string>();
  const [picked, setPicked] = useState<HTMLImageElement | null>(null);
  const [alt, setAlt] = useState('');
  // audio: null = closed; target null = inserting a new clip
  const [audioBar, setAudioBar] = useState<{ target: HTMLAudioElement | null; maxPlays: string; allowPause: boolean } | null>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const media = useMedia();
  const mediaVersion = media.version();

  useEffect(() => {
    const el = ref.current;
    if (!el || value === last.current) return;
    el.innerHTML = sanitize(value);
    prepare(el);
    // pictures right away: the layout effect below ran before this innerHTML was set
    const missing = hydrateMedia(el, media);
    if (missing.length) media.request(missing);
    last.current = value;
    setPicked(null);
  }, [value, media]);

  // Show pictures in the editor too (src is never stored: emit() sanitizes it away).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const missing = hydrateMedia(el, media);
    if (missing.length) media.request(missing);
  }, [value, media, mediaVersion]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = sanitize(normalizeTags(el.innerHTML)).trim();
    const out = html === '<br>' ? '' : html;
    last.current = out;
    onChange(out);
  };

  const cmd = (name: string) => {
    ref.current?.focus();
    document.execCommand(name);
    emit();
  };

  const openMath = () => {
    const sel = window.getSelection();
    saved.current = sel && sel.rangeCount && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setTex('');
    setMathOpen(true);
  };

  const insertMath = () => {
    const el = ref.current;
    if (!el || !tex.trim()) return;
    el.focus();
    const sel = window.getSelection();
    if (saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    } else if (sel) {
      sel.selectAllChildren(el);
      sel.collapseToEnd();
    }
    document.execCommand('insertHTML', false, `<span data-math="${escapeAttr(tex.trim())}">${escapeAttr(tex.trim())}</span>&nbsp;`);
    prepare(el);
    setMathOpen(false);
    emit();
  };

  const rememberCaret = () => {
    const sel = window.getSelection();
    saved.current = sel && sel.rangeCount && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  };

  const placeCaret = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (saved.current && sel && el.contains(saved.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    } else if (sel) {
      sel.selectAllChildren(el);
      sel.collapseToEnd();
    }
  };

  const insertImages = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setUploadError(undefined);
    setUploading((n) => n + images.length);
    for (const file of images) {
      try {
        const { blob, name } = await shrinkImage(file);
        const m = await mediaApi.upload(blob, name);
        panelMedia().add(m.id, { url: m.url, mime: m.mime_type, w: m.width ?? undefined, h: m.height ?? undefined });
        placeCaret();
        document.execCommand('insertHTML', false, `<img data-media-id="${m.id}" alt="">`);
        const el = ref.current;
        if (el) hydrateMedia(el, panelMedia());
        rememberCaret();
        emit();
      } catch (err) {
        setUploadError(`${file.name}: ${fieldErrors(err).file ?? errorMessage(err)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const audioAttrs = (maxPlays: string, allowPause: boolean) => {
    const n = Number(maxPlays);
    return n >= 1 && n <= 10 ? ` data-max-plays="${n}" data-allow-pause="${allowPause}"` : '';
  };

  const insertAudio = async (file: File | undefined) => {
    if (!file || !audioBar) return;
    setUploadError(undefined);
    setUploading((n) => n + 1);
    try {
      const m = await mediaApi.upload(file, file.name);
      panelMedia().add(m.id, { url: m.url, mime: m.mime_type });
      placeCaret();
      document.execCommand('insertHTML', false, `<audio data-media-id="${m.id}" controls${audioAttrs(audioBar.maxPlays, audioBar.allowPause)}></audio><p><br></p>`);
      const el = ref.current;
      if (el) hydrateMedia(el, panelMedia());
      setAudioBar(null);
      emit();
    } catch (err) {
      setUploadError(`${file.name}: ${fieldErrors(err).file ?? errorMessage(err)}`);
    } finally {
      setUploading((n) => n - 1);
    }
  };

  /** applyAudio writes the bar's settings onto the clip being edited. */
  const applyAudio = (next: { maxPlays: string; allowPause: boolean }) => {
    setAudioBar((b) => (b ? { ...b, ...next } : b));
    const a = audioBar?.target;
    if (!a) return;
    const n = Number(next.maxPlays);
    if (n >= 1 && n <= 10) {
      a.setAttribute('data-max-plays', String(n));
      a.setAttribute('data-allow-pause', String(next.allowPause));
    } else {
      a.removeAttribute('data-max-plays');
      a.removeAttribute('data-allow-pause');
    }
    emit();
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    rememberCaret();
    void insertImages(files);
  };

  const onDrop = (e: DragEvent) => {
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) saved.current = range;
    void insertImages(files);
  };

  const onEditorClick = (e: MouseEvent) => {
    const t = e.target;
    if (t instanceof HTMLImageElement) {
      setPicked(t);
      setAlt(t.alt);
      setAudioBar(null);
    } else if (t instanceof HTMLAudioElement) {
      setPicked(null);
      setAudioBar({ target: t, maxPlays: t.getAttribute('data-max-plays') ?? '', allowPause: t.getAttribute('data-allow-pause') !== 'false' });
    } else {
      setPicked(null);
    }
  };

  const saveAlt = (text: string) => {
    setAlt(text);
    if (!picked) return;
    picked.alt = text;
    emit();
  };

  const removePicked = () => {
    picked?.remove();
    setPicked(null);
    emit();
  };

  const tool = (label: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {icon}
    </button>
  );
  const i = 'h-3.5 w-3.5';

  return (
    <div className="space-y-2">
      <div className={cx('overflow-hidden rounded-xl border bg-white dark:bg-slate-800', invalid ? 'border-rose-400' : 'border-slate-300 dark:border-slate-700')}>
        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-slate-700 dark:bg-slate-900">
          {tool('Tebal', <Bold className={i} />, () => cmd('bold'))}
          {tool('Miring', <Italic className={i} />, () => cmd('italic'))}
          {tool('Garis bawah', <Underline className={i} />, () => cmd('underline'))}
          {tool('Subskrip', <Subscript className={i} />, () => cmd('subscript'))}
          {tool('Superskrip', <Superscript className={i} />, () => cmd('superscript'))}
          {tool('Daftar', <List className={i} />, () => cmd('insertUnorderedList'))}
          {tool('Daftar bernomor', <ListOrdered className={i} />, () => cmd('insertOrderedList'))}
          {tool('Sisipkan rumus (LaTeX)', <Sigma className={i} />, openMath)}
          {tool('Sisipkan gambar', <ImagePlus className={i} />, () => {
            rememberCaret();
            fileInput.current?.click();
          })}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void insertImages([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
          {tool('Sisipkan audio', <AudioLines className={i} />, () => {
            rememberCaret();
            setPicked(null);
            setAudioBar({ target: null, maxPlays: '', allowPause: true });
          })}
          {uploading > 0 && (
            <span className="ml-auto flex items-center gap-1.5 pr-1 text-[11px] text-slate-500">
              <Spinner className="h-3.5 w-3.5" /> Mengunggah…
            </span>
          )}
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          onDrop={onDrop}
          onClick={onEditorClick}
          className={cx('rich rich-editor px-3 py-2 text-sm text-slate-900 dark:text-white', minHeight)}
        />
      </div>
      {uploadError && <p className="text-xs text-rose-600 dark:text-rose-400">File gagal diunggah. {uploadError}</p>}
      {audioBar && (!audioBar.target || ref.current?.contains(audioBar.target)) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
          <AudioLines className="h-4 w-4 shrink-0 text-slate-500" />
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            Batas putar
            <Input
              type="number"
              min={1}
              max={10}
              value={audioBar.maxPlays}
              onChange={(e) => applyAudio({ maxPlays: e.target.value, allowPause: audioBar.allowPause })}
              placeholder="bebas"
              aria-describedby="audio-limit-hint"
              className="w-20"
            />
            <span id="audio-limit-hint" className="text-slate-500">kali (kosong = bebas)</span>
          </label>
          <Checkbox
            label="Boleh dijeda"
            checked={audioBar.allowPause}
            disabled={!audioBar.maxPlays}
            onChange={(e) => applyAudio({ maxPlays: audioBar.maxPlays, allowPause: e.target.checked })}
          />
          <div className="ml-auto flex items-center gap-2">
            {audioBar.target ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  audioBar.target?.remove();
                  setAudioBar(null);
                  emit();
                }}
              >
                Hapus audio
              </Button>
            ) : (
              <>
                <input
                  ref={audioInput}
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    void insertAudio(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <Button size="sm" onClick={() => audioInput.current?.click()} loading={uploading > 0}>
                  Pilih file audio
                </Button>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={() => setAudioBar(null)}>
              {audioBar.target ? 'Selesai' : 'Batal'}
            </Button>
          </div>
          {!audioBar.target && <p className="w-full text-xs text-slate-500">MP3, M4A, Ogg, atau WAV, maks. 20 MB. Peserta memutar lewat tombol; bila dibatasi, tidak bisa digeser maju-mundur.</p>}
        </div>
      )}
      {picked && ref.current?.contains(picked) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
          <ImagePlus className="h-4 w-4 shrink-0 text-slate-500" />
          <Input
            autoFocus
            value={alt}
            onChange={(e) => saveAlt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                setPicked(null);
              }
            }}
            aria-label="Teks alternatif gambar"
            placeholder="Teks alternatif, mis. Grafik kecepatan terhadap waktu"
            className="min-w-0 flex-1"
          />
          <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={removePicked}>
            Hapus gambar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPicked(null)}>
            Selesai
          </Button>
        </div>
      )}
      {mathOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/40">
          <Sigma className="h-4 w-4 shrink-0 text-blue-600" />
          <Input
            autoFocus
            value={tex}
            onChange={(e) => setTex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                insertMath();
              }
              if (e.key === 'Escape') setMathOpen(false);
            }}
            placeholder="mis. \frac{a}{b} atau x^2 + y^2 = r^2"
            className="font-mono"
          />
          {tex && <RichContent html={`<span data-math="${escapeAttr(tex)}"></span>`} className="shrink-0 text-sm" inline />}
          <Button size="sm" onClick={insertMath}>
            Sisipkan
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMathOpen(false)}>
            Batal
          </Button>
        </div>
      )}
      {preview && value && /data-math=/.test(value) && (
        <div className="rounded-xl border border-dashed border-slate-300 p-2.5 text-sm dark:border-slate-700">
          <p className="mb-1 text-xs font-medium text-slate-500">Pratinjau</p>
          <RichContent html={value} />
        </div>
      )}
    </div>
  );
}
