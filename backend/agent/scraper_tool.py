"""Web scraping tool for the FD Rate Agent.

Delegates the actual Playwright work to `_scrape_worker.py` which runs in
a separate subprocess with its own ProactorEventLoop, avoiding the Windows
event-loop limitation inside uvicorn.
"""

import asyncio
import json
import logging
import subprocess
import sys

logger = logging.getLogger(__name__)


def _run_scrape_worker(url: str) -> str:
    """Run the scrape worker in a subprocess (blocking)."""
    result = subprocess.run(
        [sys.executable, "-m", "backend.agent._scrape_worker", url],
        capture_output=True,
        timeout=120,
    )

    if result.returncode != 0:
        err_msg = result.stderr.decode("utf-8", errors="replace").strip()
        logger.error("Scrape worker failed for %s: %s", url, err_msg)
        raise RuntimeError(f"Scrape worker failed (rc={result.returncode}): {err_msg}")

    data = json.loads(result.stdout.decode("utf-8"))
    return data["content"]


async def fetch_page_content(url: str) -> str:
    """Fetch and extract text content from a bank's FD rates page.

    Spawns `_scrape_worker.py` in a subprocess via `asyncio.to_thread`
    so Playwright gets its own event loop on Windows.
    """
    return await asyncio.to_thread(_run_scrape_worker, url)
