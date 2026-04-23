// ── Excel parsing ─────────────────────────────────────────────
function handleExcel(file, type) {
  if (!file) return;
  const MAX_SIZE_MB = 50;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    const statusEl = document
      .getElementById(type === "mf" ? "drop-zone-mf" : "drop-zone-st")
      ?.querySelector(".upload-status");
    if (statusEl) {
      statusEl.textContent = `✗ File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_SIZE_MB}MB.`;
    }
    return;
  }
  const dz = document.getElementById(
    type === "mf" ? "drop-zone-mf" : "drop-zone-st",
  );
  const statusEl = dz && dz.querySelector(".upload-status");
  if (!statusEl) return;
  statusEl.textContent = "⏳ Parsing " + file.name + "…";
  if (dz) {
    dz.style.borderColor = "var(--gold)";
    dz.style.color = "var(--gold)";
  }

  if (typeof XLSX === "undefined") {
    statusEl.textContent = "⚠ SheetJS not loaded — check internet connection";
    if (dz) {
      dz.style.borderColor = "var(--red)";
      dz.style.color = "var(--red)";
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    // Yield to browser before heavy processing
    setTimeout(() => {
      try {
        const wb = XLSX.read(e.target.result, {
          type: "array",
          cellDates: true,
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

        if (rows.length > 3000) {
          // Use chunked processing for large datasets
          processRowsInChunks(rows, type, dz, statusEl, file.name);
        } else {
          // Direct processing for small datasets
          if (type === "mf") parseMFRows(rows, dz, statusEl, file.name);
          else parseSTRows(rows, dz, statusEl, file.name);
        }
      } catch (err) {
        statusEl.textContent = "✗ Error: " + err.message;
        if (dz) {
          dz.style.borderColor = "var(--red)";
          dz.style.color = "var(--red)";
        }
      }
    }, 10);
  };
  reader.readAsArrayBuffer(file);
}

// Chunked processing with progress updates
function processRowsInChunks(rows, type, dz, statusEl, fname) {
  const CHUNK_SIZE = 1000;
  const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
  let currentChunk = 0;

  // Pre-filter valid rows in chunks to avoid multiple passes
  const validRows = [];

  function processChunk() {
    const start = currentChunk * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, rows.length);
    const chunk = rows.slice(start, end);

    // Filter chunk
    for (const row of chunk) {
      const schemeStr =
        type === "mf"
          ? String(
              row["Scheme"] || row["scheme"] || row["Fund Name"] || "",
            ).trim()
          : String(
              row["Stock"] ||
                row["stock"] ||
                row["Symbol"] ||
                row["Company"] ||
                "",
            ).trim();

      if (
        schemeStr &&
        schemeStr.toUpperCase() !== "TOTAL" &&
        !schemeStr.startsWith("*")
      ) {
        validRows.push(row);
      }
    }

    currentChunk++;

    // Update progress
    const progress = Math.round((currentChunk / totalChunks) * 100);
    statusEl.textContent = `⏳ Processing... ${progress}% (${validRows.length} valid rows found)`;

    if (currentChunk < totalChunks) {
      // Yield to browser between chunks
      setTimeout(processChunk, 0);
    } else {
      // All chunks processed, now parse the valid rows
      statusEl.textContent = `⏳ Analyzing ${validRows.length} rows...`;

      setTimeout(() => {
        if (type === "mf") {
          parseMFRows(validRows, dz, statusEl, fname);
        } else {
          parseSTRows(validRows, dz, statusEl, fname);
        }
      }, 10);
    }
  }

  processChunk();
}

function parseInvDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m1) {
    const y = parseInt(m1[3]);
    const d = new Date(
      `${y < 100 ? 2000 + y : y}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`,
    );
    return !isNaN(d) && d <= new Date() ? d : null;
  }
  const d = new Date(s);
  return isNaN(d) || d > new Date() ? null : d;
}