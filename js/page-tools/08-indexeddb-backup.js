// IndexedDB backup import/export for PortFin.
// Uses the same [{ k, v }] shape as PortFinDB's kv object store.

const PORTFIN_BACKUP_PREFIX = "portfin-indexeddb-backup";

function initIndexedDBBackupListeners() {
  const exportBtn = document.getElementById("idb-export-btn");
  const importBtn = document.getElementById("idb-import-btn");
  const fileInput = document.getElementById("idb-import-file");

  if (exportBtn) exportBtn.addEventListener("click", exportIndexedDBBackup);
  if (importBtn && fileInput) importBtn.addEventListener("click", () => fileInput.click());
  if (fileInput) fileInput.addEventListener("change", handleIndexedDBBackupFile);
}

function setIndexedDBBackupStatus(message, tone = "muted") {
  const el = document.getElementById("idb-backup-status");
  if (!el) return;
  const colors = {
    green: "var(--green)",
    red: "var(--red)",
    amber: "var(--amber)",
    muted: "var(--muted)",
  };
  el.style.color = colors[tone] || colors.muted;
  el.textContent = message;
}

async function exportIndexedDBBackup() {
  try {
    setIndexedDBBackupStatus("Preparing backup...", "amber");
    const rows = await PortFinDB.entries();
    if (!rows.length) {
      setIndexedDBBackupStatus("No IndexedDB data found to export.", "red");
      return;
    }

    const json = JSON.stringify(rows.sort((a, b) => a.k.localeCompare(b.k)), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    const a = document.createElement("a");
    a.href = url;
    a.download = `${PORTFIN_BACKUP_PREFIX}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setIndexedDBBackupStatus(`Exported ${rows.length} record${rows.length === 1 ? "" : "s"}.`, "green");
  } catch (err) {
    console.warn("PortFin: IndexedDB export failed", err);
    setIndexedDBBackupStatus("Export failed. Check the browser console for details.", "red");
  }
}

function normaliseIndexedDBBackup(parsed) {
  const rows = Array.isArray(parsed) ? parsed : parsed?.entries;
  if (!Array.isArray(rows)) {
    throw new Error("Backup must be a JSON array of { k, v } records.");
  }

  const cleanRows = rows.map((row, idx) => {
    if (!row || typeof row.k !== "string" || !row.k.trim()) {
      throw new Error(`Record ${idx + 1} is missing a string key.`);
    }
    return {
      k: row.k,
      v: typeof row.v === "string" ? row.v : JSON.stringify(row.v ?? null),
    };
  });

  if (!cleanRows.length) throw new Error("Backup file does not contain any records.");
  return cleanRows;
}

function handleIndexedDBBackupFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      setIndexedDBBackupStatus(`Importing ${file.name}...`, "amber");
      const rows = normaliseIndexedDBBackup(JSON.parse(reader.result));
      const result = await PortFinDB.importEntries(rows);
      if (!result.ok) throw new Error("One or more records could not be saved.");

      setIndexedDBBackupStatus(`Imported ${result.count} record${result.count === 1 ? "" : "s"}. Reloading...`, "green");
      setTimeout(() => location.reload(), 500);
    } catch (err) {
      console.warn("PortFin: IndexedDB import failed", err);
      setIndexedDBBackupStatus(err.message || "Import failed. Choose a valid PortFin backup JSON file.", "red");
    }
  };
  reader.onerror = () => setIndexedDBBackupStatus("Could not read the selected file.", "red");
  reader.readAsText(file);
}
