"""FastAPI routes for the FD Rate Scraper."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.api.url_store import get_all_urls, add_url, delete_url
from backend.agent.fd_rate_agent import extract_fd_rates_batch
from backend.storage.blob_client import save_to_blob, get_latest_from_blob

router = APIRouter()


# ── URL Management ───────────────────────────────────────────────


class AddUrlRequest(BaseModel):
    url: str
    bank_name: str


@router.get("/urls")
def list_urls():
    return get_all_urls()


@router.post("/urls")
def create_url(req: AddUrlRequest):
    entry = add_url(req.url, req.bank_name)
    return entry


@router.delete("/urls/{url_id}")
def remove_url(url_id: str):
    deleted = delete_url(url_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="URL not found")
    return {"status": "deleted"}


# ── Scraping ─────────────────────────────────────────────────────


@router.post("/scrape")
async def trigger_scrape():
    """Trigger FD rate extraction for all saved URLs."""
    urls = get_all_urls()
    if not urls:
        raise HTTPException(
            status_code=400, detail="No URLs configured. Add bank URLs first."
        )

    # Run the Foundry agent batch extraction
    consolidated = await extract_fd_rates_batch(urls)

    # Save to Azure Blob Storage
    try:
        blob_url = save_to_blob(consolidated)
    except Exception as e:
        return {
            "status": "partial_success",
            "message": f"Scraping completed but Blob upload failed: {e}",
            "data": consolidated,
            "blob_url": None,
        }

    return {
        "status": "success",
        "message": f"Extracted FD rates from {consolidated['total_banks']} banks and saved to Blob.",
        "blob_url": blob_url,
        "data": consolidated,
    }


@router.get("/results/latest")
def get_latest_results():
    """Get the latest scraped FD rates from Blob Storage."""
    data = get_latest_from_blob()
    if data is None:
        raise HTTPException(
            status_code=404, detail="No results found. Run a scrape first."
        )
    return data


# ── Excel Export ─────────────────────────────────────────────────


@router.post("/export-excel")
def export_excel():
    """Generate an Excel file from latest results and upload to Blob Storage."""
    from backend.api.excel_export import export_excel_to_blob

    try:
        result = export_excel_to_blob()
        return {
            "status": "success",
            "message": "Excel file generated and uploaded to Blob Storage.",
            "excel_url": result["excel_url"],
            "file_name": result["file_name"],
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel export failed: {e}")
