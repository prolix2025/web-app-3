// static/app.js

// ===== Clock (nice-to-have UI detail) =====
const clockEl = document.getElementById("clock");
if (clockEl) {
  const tick = () => {
    const d = new Date();
    const z = (n) => String(n).padStart(2, "0");
    clockEl.textContent = `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
}

// ===== Element hooks =====
const form = document.getElementById("form");
const fileInput = document.getElementById("file");
const dz = document.getElementById("dropzone");
const preview = document.getElementById("preview");
const clearBtn = document.getElementById("btn2");
const extractBtn = document.getElementById("btnExtract");
const saveBtn = document.getElementById("btnSave");

// Field refs (make sure these IDs exist in your HTML)
const f_supplier       = document.getElementById("supplier");
const f_invoice_date   = document.getElementById("invoice_date");
const f_invoice_amount = document.getElementById("invoice_amount");
const f_btw_amount     = document.getElementById("btw_amount");
const f_btw_number     = document.getElementById("btw_number");
const f_kvk            = document.getElementById("kvk");
const f_notes          = document.getElementById("notes");

// ===== Helpers =====
function isImage(file) {
  return file && file.type && file.type.startsWith("image/");
}
function isPdf(file) {
  return file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || ""));
}

function clearPreview() {
  if (!preview) return;
  preview.innerHTML = `
    <div class="empty">
      <div class="hint">Drop a PDF/JPG/PNG here or click to choose a file</div>
    </div>
  `;
}

function showPreview(file) {
  if (!preview || !file) return clearPreview();

  const reader = new FileReader();
  if (isImage(file)) {
    reader.onload = () => {
      preview.innerHTML = `
        <img class="preview-img" src="${reader.result}" alt="preview"/>
      `;
    };
    reader.readAsDataURL(file);
  } else if (isPdf(file)) {
    // Browser PDF preview (fallback: icon + filename)
    const url = URL.createObjectURL(file);
    preview.innerHTML = `
      <object data="${url}" type="application/pdf" class="preview-pdf">
        <div class="preview-fallback">
          <span class="file-icon">📄</span>
          <div>${file.name}</div>
        </div>
      </object>
    `;
  } else {
    preview.innerHTML = `
      <div class="preview-fallback">
        <span class="file-icon">📎</span>
        <div>${file.name}</div>
      </div>
    `;
  }
}

function populateFields(data = {}) {
  if (f_supplier)       f_supplier.value       = data.supplier       ?? "";
  if (f_invoice_date)   f_invoice_date.value   = data.invoice_date   ?? "";
  if (f_invoice_amount) f_invoice_amount.value = data.invoice_amount ?? "";
  if (f_btw_amount)     f_btw_amount.value     = data.btw_amount     ?? "";
  if (f_btw_number)     f_btw_number.value     = data.btw_number     ?? "";
  if (f_kvk)            f_kvk.value            = data.kvk            ?? "";
  if (f_notes && data.notes != null) f_notes.value = data.notes;
}

function collectFields() {
  return {
    file_name: fileInput?.files?.[0]?.name || null,
    supplier:       f_supplier?.value ?? "",
    invoice_date:   f_invoice_date?.value ?? "",
    invoice_amount: f_invoice_amount?.value ?? "",
    btw_amount:     f_btw_amount?.value ?? "",
    btw_number:     f_btw_number?.value ?? "",
    kvk:            f_kvk?.value ?? "",
    notes:          f_notes?.value ?? ""
  };
}

function setBusy(btn, busyText) {
  if (!btn) return () => {};
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = busyText;
  return () => {
    btn.disabled = false;
    btn.textContent = prev;
  };
}

function toast(msg) {
  // Simple alert; swap for a nicer toast if you have one.
  alert(msg);
}

// ===== Drag & drop wiring =====
if (dz && fileInput) {
  ["dragenter", "dragover"].forEach((evt) =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.remove("drag");
    })
  );
  dz.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      showPreview(file);
    }
  });
  dz.addEventListener("click", () => fileInput.click());
}

if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) showPreview(file);
    else clearPreview();
  });
}

// Initialize preview on load
clearPreview();

// ===== Clear button =====
if (clearBtn && form) {
  clearBtn.addEventListener("click", () => {
    form.reset();
    clearPreview();
    // Optional: clear last extraction cache
    try { localStorage.removeItem("lastExtraction"); } catch {}
  });
}

// ===== Extract button (calls /extract) =====
if (extractBtn) {
  extractBtn.addEventListener("click", async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      toast("Please choose a PDF/JPG/PNG first.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("notes", f_notes?.value || "");

    const done = setBusy(extractBtn, "Extracting…");
    try {
      const res = await fetch("/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);

      populateFields(data);

      // Cache in localStorage so a reload shows the last result
      try { localStorage.setItem("lastExtraction", JSON.stringify(data)); } catch {}
    } catch (err) {
      console.error(err);
      toast("Extraction failed: " + (err?.message || "Unknown error"));
    } finally {
      done();
    }
  });
}

// ===== Save button (calls /save) =====
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const payload = collectFields();

    const done = setBusy(saveBtn, "Saving…");
    try {
      const res = await fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);

      toast("Saved! Record ID: " + data.id);
    } catch (err) {
      console.error(err);
      toast("Save failed: " + (err?.message || "Unknown error"));
    } finally {
      done();
    }
  });
}

// ===== Form submit (optional: keep as no-op or wire to /save as well) =====
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // Prefer clicking Save button to control state/UX
    saveBtn?.click();
  });
}

// ===== Restore last extraction on load (optional) =====
(() => {
  try {
    const s = localStorage.getItem("lastExtraction");
    if (!s) return;
    const data = JSON.parse(s);
    populateFields(data);
  } catch {}
})();
