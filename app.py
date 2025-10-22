import os
import tempfile
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from services.extractor import extract_invoice

app = Flask(__name__)

# Basic config
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB
app.config["UPLOAD_EXTENSIONS"] = {".pdf", ".png", ".jpg", ".jpeg"}
app.config["ENV"] = os.getenv("FLASK_ENV", "production")

@app.route("/")
def home():
    return render_template("index.html")

@app.post("/api/extract")
def api_extract():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f = request.files["file"]
    filename = secure_filename(f.filename or "")
    ext = os.path.splitext(filename)[1].lower()

    if ext not in app.config["UPLOAD_EXTENSIONS"]:
        return jsonify({"error": f"Unsupported file type: {ext or 'unknown'}"}), 400

    notes = request.form.get("notes", "")

    # Save to temp and run extractor
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, filename or "upload")
        f.save(path)
        try:
            data = extract_invoice(path, notes=notes)
        except Exception as e:
            # Surface a friendly error to the UI
            return jsonify({"error": f"Extraction failed: {e}"}), 500

    # Expected keys; fill defaults so UI can safely map them
    result = {
        "invoice_date": data.get("invoice_date", ""),
        "invoice_amount": data.get("invoice_amount", ""),
        "btw_amount": data.get("btw_amount", ""),
        "btw_number": data.get("btw_number", ""),
        "kvk": data.get("kvk", ""),
        "supplier": data.get("supplier", ""),
        "notes": notes,
    }
    return jsonify(result), 200

if __name__ == "__main__":
    # Local dev: python app.py
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
