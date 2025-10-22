# Plug your current extraction scripts in this function.
# You can import your own models, OCR, rules, etc.

from typing import Dict

def extract_invoice(file_path: str, notes: str = "") -> Dict:
    """
    Return a dict with keys:
    invoice_date, invoice_amount, btw_amount, btw_number, kvk, supplier
    """
    # --- PLACEHOLDER LOGIC ---
    # TODO: replace with your actual script calls, e.g.:
    # data = my_parser.run(file_path, user_notes=notes)
    # return data
    return {
        "invoice_date": "",
        "invoice_amount": "",
        "btw_amount": "",
        "btw_number": "",
        "kvk": "",
        "supplier": "",
    }
