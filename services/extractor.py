# /services/extractor.py
from typing import Dict, Optional
import os, re, mimetypes

from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient

_ENDPOINT = os.getenv("AZURE_DI_ENDPOINT")
_KEY = os.getenv("AZURE_DI_KEY")
_MODEL_ID = os.getenv("AZURE_DI_MODEL_ID", "prebuilt-invoice")

_client: Optional[DocumentIntelligenceClient] = None

def _client_singleton() -> DocumentIntelligenceClient:
    global _client
    if _client is None:
        if not _ENDPOINT or not _KEY:
            raise RuntimeError("Missing AZURE_DI_ENDPOINT or AZURE_DI_KEY")
        _client = DocumentIntelligenceClient(_ENDPOINT, AzureKeyCredential(_KEY))
    return _client

_KVK_RE = re.compile(r"\b(?:kvk|k.v.k)[\s:]*([0-9]{8})\b", re.IGNORECASE)
_VAT_RE = re.compile(r"\b(NL[0-9]{9}B[0-9]{2})\b", re.IGNORECASE)  # common NL VAT pattern

def _guess_content_type(path: str) -> str:
    t, _ = mimetypes.guess_type(path)
    return t or "application/octet-stream"

def extract_invoice(file_path: str, notes: str = "") -> Dict:
    """
    Returns a dict with keys:
      invoice_date, invoice_amount, btw_amount, btw_number, kvk, supplier
    """
    client = _client_singleton()

    with open(file_path, "rb") as f:
        poller = client.begin_analyze_document(
            model_id=_MODEL_ID,
            analyze_request=f,
            content_type=_guess_content_type(file_path)
        )
    result = poller.result()

    # DI "prebuilt-invoice" returns documents with fields you can map directly.
    invoice_date = ""
    invoice_total = ""
    total_tax = ""
    supplier = ""
    vat_number = ""

    if result.documents:
        doc = result.documents[0]
        fields = getattr(doc, "fields", {}) or {}

        # Field names for prebuilt-invoice
        # (VendorName, InvoiceDate, InvoiceTotal, TotalTax, VendorTaxId or VendorVatId vary by SDK version)
        def fv(name):
            v = fields.get(name)
            # In DI v4+ Python SDK you often need .value or .content depending on the type
            return (getattr(v, "value", None) 
                    or getattr(v, "content", None) 
                    or (isinstance(v, dict) and v.get("value")) 
                    or "")

        supplier     = fv("VendorName") or fv("SupplierName") or ""
        invoice_date = fv("InvoiceDate") or fv("DueDate") or ""
        invoice_total = fv("InvoiceTotal") or fv("AmountDue") or ""
        total_tax    = fv("TotalTax") or fv("TaxAmount") or ""

        # VAT / BTW might appear under different names depending on locale/model
        vat_number = fv("VendorTaxId") or fv("VendorVatId") or fv("VatRegistrationNumber") or ""

    # Fallbacks via raw content regex (KVK, VAT/BTW)
    raw_text = (getattr(result, "content", "") or "")
    if not vat_number:
        m = _VAT_RE.search(raw_text)
        if m:
            vat_number = m.group(1)

    kvk = ""
    m = _KVK_RE.search(raw_text)
    if m:
        kvk = m.group(1)

    return {
        "invoice_date": str(invoice_date) if invoice_date else "",
        "invoice_amount": str(invoice_total) if invoice_total else "",
        "btw_amount": str(total_tax) if total_tax else "",
        "btw_number": vat_number or "",
        "kvk": kvk or "",
        "supplier": supplier or "",
    }
