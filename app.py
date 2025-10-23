import os
import tempfile
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from services.extractor import extract_invoice
import sqlite3
from datetime import datetime
from dotenv import load_dotenv



app = Flask(__name__)
load_dotenv(override=False)

# Basic config
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB
app.config["UPLOAD_EXTENSIONS"] = {".pdf", ".png", ".jpg", ".jpeg"}
app.config["ENV"] = os.getenv("FLASK_ENV", "production")
+app.config["DB_PATH"] = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "invoices.db"))

def _db():
    conn = sqlite3.connect(app.config["DB_PATH"])
    conn.row_factory = sqlite3.Row
    return conn

def _init_db():
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS invoices (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,
              file_name TEXT,
              invoice_date TEXT,
              invoice_amount TEXT,
              btw_amount TEXT,
              btw_number TEXT,
              kvk TEXT,
              supplier TEXT,
              notes TEXT
            );
        """)
_init_db()

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
            data = extract_invoice(tmp_path, notes=notes)
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
    

@app.post("/save")
def save():
    payload = request.get_json(silent=True) or {}
    with _db() as conn:
        cur = conn.execute("""
          INSERT INTO invoices
            (created_at, file_name, invoice_date, invoice_amount, btw_amount, btw_number, kvk, supplier, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
          datetime.utcnow().isoformat(timespec="seconds") + "Z",
          payload.get("file_name"),
          payload.get("invoice_date"),
          payload.get("invoice_amount"),
          payload.get("btw_amount"),
          payload.get("btw_number"),
          payload.get("kvk"),
          payload.get("supplier"),
          payload.get("notes"),
        ))
        new_id = cur.lastrowid
    return jsonify({"ok": True, "id": new_id}), 201
    
if __name__ == "__main__":
    # Local dev: python app.py
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
