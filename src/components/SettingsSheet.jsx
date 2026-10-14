import { useRef, useState } from 'react';
import { Download, Upload, Trash2, ShieldCheck } from 'lucide-react';
import Sheet from './Sheet.jsx';

export default function SettingsSheet({ count, onClose, onExport, onImport, onClearAll, onClearChecks }) {
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef(null);
  return (
    <Sheet title="Wallet settings" onClose={onClose}>
      <div className="settings">
        <p className="privacy">
          <ShieldCheck size={20} aria-hidden />
          Your tickets and photos live only in this browser on this device. Back them up before switching phones or
          clearing browser data.
        </p>

        <div className="settings-group">
          <button type="button" className="setting" onClick={onExport} disabled={!count}>
            <Download size={22} aria-hidden />
            <span>
              <strong>Export backup</strong>
              <small>Saves all {count} tickets with photos to one file.</small>
            </span>
          </button>
          <button type="button" className="setting" onClick={() => fileRef.current?.click()}>
            <Upload size={22} aria-hidden />
            <span>
              <strong>Import backup</strong>
              <small>Adds tickets from a backup file. Tickets you already have are skipped.</small>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onImport(f);
            }}
          />
          <button type="button" className="setting" onClick={onClearChecks}>
            <Trash2 size={22} aria-hidden />
            <span>
              <strong>Clear checked numbers</strong>
              <small>Empties the “Checked so far” list for a new draw.</small>
            </span>
          </button>
        </div>

        <div className="danger-zone">
          {confirm ? (
            <>
              <p>Delete all {count} tickets and photos? This can’t be undone.</p>
              <div className="row">
                <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>
                  Keep them
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setConfirm(false);
                    onClearAll();
                  }}
                >
                  Delete all
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn-ghost-danger" disabled={!count} onClick={() => setConfirm(true)}>
              <Trash2 size={18} aria-hidden /> Delete all tickets
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
