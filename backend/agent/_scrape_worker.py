"""Standalone Playwright scraper worker.

Run as:  python -m backend.agent._scrape_worker <url>

Prints the scraped text content to stdout.
Uses its own ProactorEventLoop so subprocess spawning works on Windows.
"""

import asyncio
import json
import logging
import sys

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Page, Locator

logger = logging.getLogger(__name__)

TAB_SELECTORS = [
    '[role="tab"]',
    ".nav-tabs a",
    ".nav-tabs button",
    ".nav-pills a",
    ".nav-pills button",
    '[class*="tab-item"]',
    '[class*="tab-link"]',
    '[class*="tab-btn"]',
    '[class*="tablink"]',
    '[class*="amount"] button',
    '[class*="slab"] button',
    '[class*="toggle"] button',
    '[class*="accordion"] button',
    '[class*="accordion"] a',
    '[class*="collapse"] button',
    '[class*="segment"] button',
    '[class*="segment"] a',
    '[data-toggle="tab"]',
    '[data-toggle="pill"]',
    '[data-bs-toggle="tab"]',
    '[data-bs-toggle="pill"]',
]

MAX_TABS = 20


async def _extract_table_text(table: Locator) -> str | None:
    rows_text = []
    rows = table.locator("tr")
    row_count = await rows.count()
    for r in range(row_count):
        row = rows.nth(r)
        cells = row.locator("th, td")
        cell_count = await cells.count()
        cell_texts = []
        for c in range(cell_count):
            cell_texts.append((await cells.nth(c).text_content() or "").strip())
        if any(cell_texts):
            rows_text.append(" | ".join(cell_texts))
    return "\n".join(rows_text) if rows_text else None


async def _snapshot_visible_tables(page: Page) -> list[tuple[int, str]]:
    snapshot: list[tuple[int, str]] = []
    all_tables = page.locator("table")
    count = await all_tables.count()
    for idx in range(count):
        table = all_tables.nth(idx)
        try:
            if not await table.is_visible(timeout=500):
                continue
        except Exception:
            continue
        text = await _extract_table_text(table)
        if text:
            snapshot.append((idx, text))
    return snapshot


def _diff_tables(
    baseline: list[tuple[int, str]], current: list[tuple[int, str]]
) -> list[str]:
    base_map = {idx: text for idx, text in baseline}
    changed: list[str] = []
    table_num = 0
    for idx, text in current:
        table_num += 1
        old_text = base_map.get(idx)
        if old_text is None or old_text != text:
            changed.append(f"--- CHANGED TABLE {table_num} ---\n{text}")
    return changed


async def _extract_visible_tables(page: Page) -> list[str]:
    tables_text = []
    all_tables = page.locator("table")
    count = await all_tables.count()
    table_num = 0
    for idx in range(count):
        table = all_tables.nth(idx)
        try:
            if not await table.is_visible(timeout=500):
                continue
        except Exception:
            continue
        table_num += 1
        text = await _extract_table_text(table)
        if text:
            tables_text.append(f"--- TABLE {table_num} ---\n" + text)
    return tables_text


async def _get_visible_text(page: Page, max_chars: int = 15000) -> str:
    try:
        text = await page.locator("body").inner_text(timeout=5000)
        return text[:max_chars]
    except Exception:
        html = await page.content()
        return _get_body_text(html, max_chars)


def _get_body_text(html: str, max_chars: int = 15000) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(
        ["script", "style", "nav", "footer", "header", "noscript", "iframe"]
    ):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)[:max_chars]


async def _find_tab_elements(page: Page) -> list[Locator]:
    found: list[Locator] = []
    seen_texts: set[str] = set()
    for selector in TAB_SELECTORS:
        try:
            elements = page.locator(selector)
            count = await elements.count()
            for idx in range(count):
                el = elements.nth(idx)
                if not await el.is_visible():
                    continue
                text = (await el.text_content() or "").strip()
                if not text or len(text) > 200 or text in seen_texts:
                    continue
                seen_texts.add(text)
                found.append(el)
                if len(found) >= MAX_TABS:
                    return found
        except Exception:
            continue
    return found


async def scrape(url: str) -> str:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="networkidle", timeout=45000)
            await page.wait_for_timeout(2000)

            tab_elements = await _find_tab_elements(page)
            tab_labels = [
                (await el.text_content() or "").strip() for el in tab_elements
            ]

            all_sections: list[str] = []

            if not tab_elements:
                tables = await _extract_visible_tables(page)
                body = await _get_visible_text(page)
                all_sections.append(
                    f"=== FULL PAGE (no tabs detected) ===\n\n--- BODY TEXT ---\n{body}"
                )
                if tables:
                    all_sections.append("\n".join(tables))
            else:
                baseline = await _snapshot_visible_tables(page)
                body = await _get_visible_text(page, max_chars=500)
                all_sections.append(f"--- PAGE CONTEXT (brief) ---\n{body}")

                for i, tab_el in enumerate(tab_elements):
                    label = tab_labels[i]
                    try:
                        await tab_el.click(timeout=5000)
                        await page.wait_for_timeout(1500)
                        try:
                            await page.wait_for_load_state("networkidle", timeout=5000)
                        except Exception:
                            pass

                        current = await _snapshot_visible_tables(page)
                        changed = _diff_tables(baseline, current)

                        if not changed:
                            changed = [
                                f"--- TABLE {n + 1} ---\n{text}"
                                for n, (_, text) in enumerate(current[:2])
                            ]

                        section_parts = [
                            f'=== TAB {i + 1}: "{label}" ===',
                            f"NOTE: All rates in this section are for "
                            f'amount slab / category: "{label}"',
                        ]
                        section_parts.extend(changed)
                        all_sections.append("\n\n".join(section_parts))
                        baseline = current

                    except Exception as exc:
                        all_sections.append(
                            f'=== TAB {i + 1}: "{label}" === (CLICK FAILED)\n'
                        )

            return (
                f"=== PAGE CONTENT FROM: {url} ===\n"
                f"=== TABS FOUND: {len(tab_elements)} — {tab_labels} ===\n\n"
                + "\n\n".join(all_sections)
            )

        finally:
            await context.close()
            await browser.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m backend.agent._scrape_worker <url>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]

    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    result = asyncio.run(scrape(url))
    # Output as JSON so the caller can safely parse it
    sys.stdout.reconfigure(encoding="utf-8")
    json.dump({"content": result}, sys.stdout, ensure_ascii=False)
