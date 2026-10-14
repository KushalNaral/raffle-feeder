import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Images, Plus, Settings, Ticket, Hash, CircleHelp } from 'lucide-react';
import Wallet from './components/Wallet.jsx';
import CheckPad from './components/CheckPad.jsx';
import ReviewSheet from './components/ReviewSheet.jsx';
import TicketSheet from './components/TicketSheet.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import Tour from './components/Tour.jsx';
import {
  clearTickets,
  exportBackup,
  loadTickets,
  parseBackup,
  removeTicket,
  requestPersistence,
  saveTicket,
} from './db.js';
import { warmUp } from './ocr.js';
import { readLocal, writeLocal } from './util.js';

const TOUR_STEPS = [
  {
    target: ['.tab-add', '[data-tour=add]'],
    round: false,
    title: 'Add your tickets',
    body: 'Snap one with the camera, or pick a whole booklet of photos from your gallery at once.',
  },
  {
    target: ['.deck > li:first-child .tcard', '.empty-card'],
    title: 'Every ticket is a scratch card',
    body: 'The shiny foil means it’s still waiting for the draw. Tap a card to see its photo, fix the number or delete it.',
  },
  {
    target: '.chips',
    title: 'Called and won at a glance',
    body: 'Filter your deck to the tickets that were called, or the ones that won you something.',
  },
  {
    target: ['[data-tour=check-tab]', '.check-card'],
    title: 'At the draw, check here',
    body: 'Key in each number as it’s announced. The foil scratches itself off to show IT’S YOURS, or not this time.',
  },
  {
    target: '[data-tour=settings]',
    title: 'Keep a backup',
    body: 'Tickets and photos live only on this device. Export a backup file before you switch phones.',
  },
  {
    target: '[data-tour=help]',
    title: 'Need a refresher?',
    body: 'Tap here any time to replay this tour.',
  },
];

const useWide = () => {
  const q = '(min-width: 960px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
};

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('wallet');
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [checksKey, setChecksKey] = useState(0);
  const [touring, setTouring] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const wide = useWide();

  const say = useCallback((msg) => {
    setToast({ msg, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    loadTickets()
      .then((t) => {
        setTickets(t);
        // Coming back with tickets saved usually means the draw is on: open straight to Check.
        if (t.length) setTab('check');
      })
      .catch(() => say('Couldn’t open saved tickets. Private browsing may block storage.'))
      .finally(() => setLoaded(true));
  }, [say]);

  useEffect(() => {
    if (!loaded || readLocal('rf:toured', false)) return;
    const id = setTimeout(() => setTouring(true), 700);
    return () => clearTimeout(id);
  }, [loaded]);

  const endTour = useCallback(() => {
    setTouring(false);
    writeLocal('rf:toured', true);
  }, []);

  // One object URL per thumbnail, revoked when the ticket goes away.
  const thumbCache = useRef(new Map());
  const thumbs = useMemo(() => {
    const cache = thumbCache.current;
    const next = {};
    const live = new Set();
    for (const t of tickets) {
      live.add(t.id);
      let entry = cache.get(t.id);
      if (!entry || entry.blob !== t.thumb) {
        if (entry) URL.revokeObjectURL(entry.url);
        entry = t.thumb ? { blob: t.thumb, url: URL.createObjectURL(t.thumb) } : { blob: null, url: null };
        cache.set(t.id, entry);
      }
      next[t.id] = entry.url;
    }
    for (const [id, entry] of cache)
      if (!live.has(id)) {
        if (entry.url) URL.revokeObjectURL(entry.url);
        cache.delete(id);
      }
    return next;
  }, [tickets]);

  const openFiles = (fileList) => {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return;
    warmUp();
    setSheet({ type: 'review', files });
  };

  const addTickets = async (list) => {
    try {
      for (const t of list) await saveTicket(t);
      setTickets((cur) => [...cur, ...list]);
      setSheet(null);
      setTab('wallet');
      say(list.length === 1 ? `Ticket ${list[0].number} added` : `${list.length} tickets added`);
      requestPersistence();
    } catch {
      say('Couldn’t save. Your device may be out of storage.');
    }
  };

  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;
  const update = useCallback(
    (id, patch) => {
      const t = ticketsRef.current.find((x) => x.id === id);
      if (!t) return;
      const saved = { ...t, ...patch };
      ticketsRef.current = ticketsRef.current.map((x) => (x.id === id ? saved : x));
      setTickets((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      saveTicket(saved).catch(() => say('Couldn’t save that change.'));
    },
    [say],
  );

  const remove = async (id) => {
    await removeTicket(id);
    setTickets((cur) => cur.filter((t) => t.id !== id));
    setSheet(null);
    say('Ticket deleted');
  };

  const doExport = async () => {
    const blob = await exportBackup(tickets);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `raffle-tickets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say('Backup saved');
  };

  const doImport = async (file) => {
    try {
      const incoming = await parseBackup(file);
      const have = new Set(tickets.map((t) => t.id));
      const fresh = incoming.filter((t) => !have.has(t.id));
      for (const t of fresh) await saveTicket(t);
      setTickets((cur) => [...cur, ...fresh]);
      say(fresh.length ? `Imported ${fresh.length} tickets` : 'Nothing new in that backup');
      setSheet(null);
    } catch (e) {
      say(e.message || 'That file couldn’t be imported.');
    }
  };

  // Drop photos anywhere on desktop.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e) => hasFiles(e) && e.preventDefault();
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      openFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const current = sheet?.type === 'ticket' ? tickets.find((t) => t.id === sheet.id) : null;
  const calledCount = tickets.filter((t) => t.called || t.prize).length;
  const showWallet = wide || tab === 'wallet';
  const showCheck = wide || tab === 'check';

  return (
    <div className={`app${wide ? ' is-wide' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 36 36" width="38" height="38" aria-hidden className="brand-mark">
            <g transform="rotate(-10 18 18)">
              <rect x="4" y="7" width="28" height="22" rx="5" fill="var(--coral)" />
              <rect x="8" y="19" width="20" height="6" rx="2" fill="var(--foil-flat)" />
              <path d="M9 13h9" stroke="var(--card-ink)" strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
          <div>
            <h1>Raffle Feeder</h1>
            <p className="summary">
              {loaded
                ? tickets.length
                  ? `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} · ${calledCount} called`
                  : 'No tickets yet'
                : 'Loading tickets…'}
            </p>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setTab('wallet');
              setTouring(true);
            }}
            aria-label="Show me around"
            data-tip="Show me around"
            data-tour="help"
          >
            <CircleHelp size={22} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSheet({ type: 'settings' })}
            aria-label="Settings"
            data-tip="Backup & settings"
            data-tour="settings"
          >
            <Settings size={22} />
          </button>
          {wide ? (
            <button type="button" className="btn btn-primary" onClick={() => galleryRef.current?.click()} data-tour="add">
              <Plus size={20} strokeWidth={2.6} aria-hidden /> Add tickets
            </button>
          ) : null}
        </div>
      </header>

      <main className="main">
        {showWallet && loaded ? (
          <Wallet
            tickets={tickets}
            thumbs={thumbs}
            onOpen={(id) => setSheet({ type: 'ticket', id })}
            onCamera={() => cameraRef.current?.click()}
            onGallery={() => galleryRef.current?.click()}
          />
        ) : null}
        {showCheck ? (
          <aside className="check-dock">
            <CheckPad
              key={checksKey}
              tickets={tickets}
              thumbs={thumbs}
              onUpdate={update}
              onOpen={(id) => setSheet({ type: 'ticket', id })}
              active={showCheck && !sheet}
            />
          </aside>
        ) : null}
      </main>

      {!wide ? (
        <nav className="tabbar" aria-label="Sections">
          <button type="button" className={tab === 'wallet' ? 'is-on' : ''} aria-current={tab === 'wallet' ? 'page' : undefined} onClick={() => setTab('wallet')}>
            <Ticket size={24} aria-hidden />
            <span>Tickets</span>
          </button>
          <button type="button" className="tab-add" onClick={() => galleryRef.current?.click()} aria-label="Add tickets">
            <Plus size={30} strokeWidth={2.6} aria-hidden />
          </button>
          <button
            type="button"
            className={tab === 'check' ? 'is-on' : ''}
            aria-current={tab === 'check' ? 'page' : undefined}
            onClick={() => setTab('check')}
            data-tour="check-tab"
          >
            <Hash size={24} aria-hidden />
            <span>Check</span>
          </button>
        </nav>
      ) : null}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          openFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          openFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {sheet?.type === 'review' ? (
        <ReviewSheet
          files={sheet.files}
          existing={tickets.map((t) => t.number)}
          onClose={() => setSheet(null)}
          onSave={addTickets}
        />
      ) : null}
      {current ? (
        <TicketSheet key={current.id} ticket={current} onClose={() => setSheet(null)} onUpdate={update} onDelete={remove} />
      ) : null}
      {sheet?.type === 'settings' ? (
        <SettingsSheet
          count={tickets.length}
          onClose={() => setSheet(null)}
          onExport={doExport}
          onImport={doImport}
          onClearChecks={() => {
            writeLocal('rf:checks', null);
            setChecksKey((k) => k + 1);
            say('Checked numbers cleared');
          }}
          onClearAll={async () => {
            await clearTickets();
            setTickets([]);
            setSheet(null);
            say('All tickets deleted');
          }}
        />
      ) : null}

      {dragging ? (
        <div className="dropzone" aria-hidden>
          <Images size={40} />
          <p>Drop ticket photos to add them</p>
        </div>
      ) : null}

      {touring && !sheet ? <Tour steps={TOUR_STEPS} onClose={endTour} /> : null}

      <div className="toast-region" role="status" aria-live="polite">
        {toast ? (
          <div className="toast" key={toast.id}>
            {toast.msg}
          </div>
        ) : null}
      </div>
    </div>
  );
}
