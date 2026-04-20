"""URL management — simple JSON file-based store for bank URLs."""

import json
import os
import uuid
from datetime import datetime

URLS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "urls.json")


def _ensure_data_file():
    os.makedirs(os.path.dirname(URLS_FILE), exist_ok=True)
    if not os.path.exists(URLS_FILE):
        with open(URLS_FILE, "w") as f:
            json.dump([], f)


def get_all_urls() -> list[dict]:
    _ensure_data_file()
    with open(URLS_FILE, "r") as f:
        return json.load(f)


def add_url(url: str, bank_name: str) -> dict:
    urls = get_all_urls()
    entry = {
        "id": str(uuid.uuid4()),
        "url": url,
        "bank_name": bank_name,
        "added_at": datetime.utcnow().isoformat() + "Z",
    }
    urls.append(entry)
    with open(URLS_FILE, "w") as f:
        json.dump(urls, f, indent=2)
    return entry


def delete_url(url_id: str) -> bool:
    urls = get_all_urls()
    new_urls = [u for u in urls if u["id"] != url_id]
    if len(new_urls) == len(urls):
        return False
    with open(URLS_FILE, "w") as f:
        json.dump(new_urls, f, indent=2)
    return True
