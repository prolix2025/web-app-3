// Clock
const clockEl = document.getElementById("clock");
const tick = () => {
  const d = new Date();
  clockEl.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
setInterval(tick, 1000); tick();

// Elements
const dz = document.getElementById("dropzone");
const placeholder = document.getElementById("placeholder");
const previewWrap = document.getElementById("preview");
const imgPreview = document.getElementById("imgPreview");
const pdfPreview = document.getElementById("pdfPreview");
const fileInput = document.getElementById("file");
const form = document.getElementById("detailsForm");
const saveDraftBtn = document.getElementById("saveDraft");
const extractBtn = document.getElementById("btn1");
const clearBtn = document.getElementById("btn2");

// Helpers
function showPreview(file) {
  const url = URL.createObjectURL(file);
  placeholder.style.display = "none";
  previewWrap.classList.add("active");
  imgPreview.style.display = "none";
  pdfPreview.style.display = "none";

  if (file.type === "application/pdf") {
    pdfPreview.src = url;
    pdfPreview.style.display = "block";
  } else {
    imgPreview.src = url;
    imgPreview.style.display = "block";
  }
}

function clearPreview() {
  placeholder.style.display = "";
  previewWrap.classList.remove("active");
  imgPreview.removeAttribute("src");
  pdfPreview.removeAttribute("src");
}

// Drag & drop
["dragenter", "dragover"].forEach(evt =>
  dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.add("drag"); })
);
["dragleave", "drop"].forEach(evt =>
  dz.addEventListener(evt, (e) => { e.preventDefault(); dz.classList.remove("drag"); })
);
dz.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files?.[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
    showPreview(file);
  }
});
dz.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) showPreview(file);
});

// Wire "Extract with AI" button
extractBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    alert("Please select a file first.");
    return;
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("notes", document.getElementById("notes").value || "");

  extractBtn.disabled = true;
  extractBtn.textContent = "Extracting…";
  try {
    const res = await fetch("/api/extract", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Extraction error.");

    // Populate fields
    ["invoice_date", "invoice_amount", "btw_amount", "btw_number", "kvk", "supplier"].forEach(id => {
      if (data[id] !== undefined) document.getElementById(id).value = data[id];
    });
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to extract.");
  } finally {
    extractBtn.disabled = false;
    extractBtn.textContent = "Extract with AI";
  }
});

// Save draft to localStorage
saveDraftBtn.addEventListener("click", () => {
  const payload = Object.fromEntries(new FormData(form).entries());
  localStorage.setItem("draft", JSON.stringify(payload));
  alert("Draft saved locally.");
});

// Load draft on start
(() => {
  const raw = localStorage.getItem("draft");
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([k, v]) => {
      const el = document.querySelector(`[name="${k}"]`);
      if (el) el.value = v;
    });
  } catch {}
})();

// Clear
clearBtn.addEventListener("click", () => {
  form.reset();
  clearPreview();
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  alert("Saved! (wire this up to your real save target)");
});
