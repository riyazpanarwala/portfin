// ── db.js — IndexedDB storage layer for PortFin ──────────────────────────────
//
// Replaces all direct localStorage calls with an async IndexedDB wrapper.
// On first load, automatically migrates any existing localStorage data so
// users lose nothing after the upgrade.
//
// Public API (all async, return Promise):
//   PortFinDB.get(key)            → value string | null
//   PortFinDB.set(key, value)     → true | false
//   PortFinDB.remove(key)         → true | false
//   PortFinDB.ready               → Promise that resolves when DB is open
//
// Keys used by the app:
//   'portfin-data-v1'             main portfolio payload
//   'portfin-snapshots-v1'        snapshot history array
//   'portfin-theme'               'light' | 'dark'
//   'pas-checklist-week-N'        weekly checklist bitmask
//
// IndexedDB schema:
//   database : 'PortFinDB'   version : 1
//   store    : 'kv'          keyPath : 'k'   (k: string, v: string)
// ─────────────────────────────────────────────────────────────────────────────

const PortFinDB = (() => {
  const DB_NAME    = 'PortFinDB';
  const DB_VERSION = 1;
  const STORE      = 'kv';

  // Keys that should be migrated from localStorage (exact matches)
  const MIGRATE_KEYS = [
    'portfin-data-v1',
    'portfin-snapshots-v1',
    'portfin-theme',
  ];
  // Prefix keys (checklist weeks) — migrated by prefix scan
  const MIGRATE_PREFIXES = ['pas-checklist-week-'];

  // ── Internal state ──────────────────────────────────────────
  let _db     = null;   // IDBDatabase once open
  let _failed = false;  // true if IDB is unavailable → fall back to localStorage

  // ── Open / initialise DB ────────────────────────────────────
  const _open = new Promise((resolve, reject) => {
    // Guard: some private-mode browsers throw on open()
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'k' });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = (e) => {
        console.warn('PortFinDB: IndexedDB open failed, falling back to localStorage', e.target.error);
        _failed = true;
        resolve(null); // resolve (not reject) so callers don't break
      };

      req.onblocked = () => {
        console.warn('PortFinDB: open blocked (another tab may have an older version open)');
      };
    } catch (err) {
      console.warn('PortFinDB: IndexedDB unavailable, falling back to localStorage', err);
      _failed = true;
      resolve(null);
    }
  });

  // ── localStorage fallback helpers ───────────────────────────
  const _lsGet    = (k)    => { try { return localStorage.getItem(k); }    catch (_) { return null;  } };
  const _lsSet    = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } };
  const _lsRemove = (k)    => { try { localStorage.removeItem(k); return true; } catch (_) { return false; } };

  // ── IDB transaction helpers ─────────────────────────────────
  function _tx(mode) {
    return _db.transaction(STORE, mode).objectStore(STORE);
  }

  function _idbGet(key) {
    return new Promise((resolve) => {
      try {
        const req = _tx('readonly').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.v : null);
        req.onerror   = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }

  function _idbSet(key, value) {
    return new Promise((resolve) => {
      try {
        const req = _tx('readwrite').put({ k: key, v: value });
        req.onsuccess = () => resolve(true);
        req.onerror   = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }

  function _idbRemove(key) {
    return new Promise((resolve) => {
      try {
        const req = _tx('readwrite').delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }

  // ── Migration: copy localStorage → IndexedDB, then clear LS ─
  async function _migrate() {
    if (_failed) return; // IDB not available — nothing to do

    // Collect all keys to migrate
    const keysToMigrate = [...MIGRATE_KEYS];

    // Scan localStorage for prefixed checklist keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && MIGRATE_PREFIXES.some(p => k.startsWith(p))) {
          keysToMigrate.push(k);
        }
      }
    } catch (_) { /* private mode may throw */ }

    let migrated = 0;
    for (const key of keysToMigrate) {
      const lsVal = _lsGet(key);
      if (lsVal !== null) {
        // Only write to IDB if IDB doesn't already have it
        const existing = await _idbGet(key);
        if (existing === null) {
          await _idbSet(key, lsVal);
        }
        // Remove from localStorage after successful migration
        _lsRemove(key);
        migrated++;
      }
    }

    if (migrated > 0) {
      console.info(`PortFinDB: migrated ${migrated} key(s) from localStorage → IndexedDB`);
    }
  }

  // ── ready: opens DB then runs migration ─────────────────────
  const ready = _open.then(() => _migrate());

  // ── Public API ───────────────────────────────────────────────

  async function get(key) {
    await ready;
    if (_failed) return _lsGet(key);
    return _idbGet(key);
  }

  async function set(key, value) {
    await ready;
    if (_failed) return _lsSet(key, value);
    const ok = await _idbSet(key, value);
    if (!ok) {
      // IDB write failed (e.g. storage quota) — fall back
      console.warn('PortFinDB: IDB write failed for key', key, '— trying localStorage');
      return _lsSet(key, value);
    }
    return ok;
  }

  async function remove(key) {
    await ready;
    if (_failed) return _lsRemove(key);
    return _idbRemove(key);
  }

  // Convenience: read a JSON value (returns parsed object or null)
  async function getJSON(key) {
    const raw = await get(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  // Convenience: write a JSON-serialisable value
  async function setJSON(key, value) {
    try {
      return set(key, JSON.stringify(value));
    } catch (_) {
      return false;
    }
  }

  return { ready, get, set, remove, getJSON, setJSON };
})();
