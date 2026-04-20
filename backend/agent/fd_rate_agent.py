"""Azure OpenAI-powered agent for extracting FD rates from bank web pages."""

import json
import logging
import os
import re
from datetime import datetime

from dotenv import load_dotenv

load_dotenv(override=False)

from openai import AsyncAzureOpenAI
from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider

from backend.agent.scraper_tool import fetch_page_content

logger = logging.getLogger(__name__)


EXTRACTION_PROMPT = """You are an expert financial data extraction agent. Extract Fixed Deposit (FD) interest rates from the content provided.

RULES:
1. Extract FD rates for ALL categories present: General, Senior Citizen, Super Senior Citizen, NRI, Women, Staff, etc.
2. For each rate entry, capture these fields:
   - category: The customer category (e.g., "General", "Senior Citizen")
   - tenor_description: The tenure/tenor period exactly as shown
   - tenor_min_days: Minimum days if determinable
   - tenor_max_days: Maximum days if determinable
   - rate_percent: The interest rate as a number (e.g., 7.50)
   - amount_slab: Use the slab label provided in the prompt
   - scheme_name: Any specific scheme name if mentioned
   - effective_date: The effective date if mentioned
   - additional_info: Any other relevant detail
3. Return ONLY a valid JSON array. No markdown, no explanation.

Example:
[
  {
    "category": "General",
    "tenor_description": "1 year to less than 2 years",
    "tenor_min_days": 365,
    "tenor_max_days": 729,
    "rate_percent": 6.25,
    "amount_slab": "Less than 3 Cr",
    "scheme_name": null,
    "effective_date": "2026-03-06",
    "additional_info": null
  }
]
"""


def _split_tabs(content: str) -> list[tuple[str, str]]:
    """Split scraped content into (tab_label, tab_content) pairs."""
    pattern = r'=== TAB \d+:\s*"([^"]+)"\s*==='
    splits = list(re.finditer(pattern, content))

    if not splits:
        return [("Full Page", content)]

    tabs: list[tuple[str, str]] = []
    for i, m in enumerate(splits):
        label = m.group(1)
        start = m.end()
        end = splits[i + 1].start() if i + 1 < len(splits) else len(content)
        section = content[start:end].strip()
        if "--- TABLE" in section or "--- CHANGED TABLE" in section:
            tabs.append((label, section))

    return tabs if tabs else [("Full Page", content)]


async def _extract_rates_for_section(
    client: AsyncAzureOpenAI,
    deployment: str,
    section_content: str,
    tab_label: str,
    bank_name: str,
) -> list[dict]:
    """Send a single tab section to Azure OpenAI and extract rates."""
    user_prompt = (
        f"Bank: {bank_name}\n"
        f"Amount Slab / Category: {tab_label}\n\n"
        f"Extract ALL FD rates from this data. "
        f'Set amount_slab to "{tab_label}" for every rate.\n\n'
        f"{section_content}"
    )

    response = await client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=16000,
    )

    response_text = response.choices[0].message.content or ""
    return _parse_agent_response(response_text)


async def extract_fd_rates_from_url(url: str, bank_name: str) -> dict:
    """Extract FD rates by scraping the page and processing each tab separately."""
    # Step 1: Scrape the page
    logger.info("Scraping %s for %s", url, bank_name)
    page_content = await fetch_page_content(url)

    # Step 2: Split into per-tab sections
    tabs = _split_tabs(page_content)
    logger.info(
        "Found %d tab(s) for %s: %s", len(tabs), bank_name, [t[0] for t in tabs]
    )

    # Step 3: Set up Azure OpenAI client
    endpoint = os.getenv("FOUNDRY_PROJECT_ENDPOINT", "").rstrip("/")
    deployment = os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME", "gpt-4o")

    credential = DefaultAzureCredential()
    token_provider = get_bearer_token_provider(
        credential, "https://cognitiveservices.azure.com/.default"
    )

    try:
        client = AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            azure_ad_token_provider=token_provider,
            api_version="2024-10-21",
        )

        # Step 4: Process each tab individually
        all_rates: list[dict] = []
        for tab_label, tab_content in tabs:
            try:
                logger.info("Extracting rates for tab '%s' (%s)", tab_label, bank_name)
                rates = await _extract_rates_for_section(
                    client, deployment, tab_content, tab_label, bank_name
                )
                logger.info("Got %d rates from tab '%s'", len(rates), tab_label)
                all_rates.extend(rates)
            except Exception as e:
                logger.warning("Failed to extract tab '%s': %s", tab_label, e)

        return {
            "bank_name": bank_name,
            "source_url": url,
            "scraped_at": datetime.utcnow().isoformat() + "Z",
            "rates": all_rates,
        }
    finally:
        await credential.close()


def _parse_agent_response(response_text: str) -> list[dict]:
    """Parse the agent's response into a list of rate dicts."""
    text = response_text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    # Find JSON array boundaries
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1:
        text = text[start : end + 1]

    try:
        rates = json.loads(text)
        if isinstance(rates, list):
            return rates
    except json.JSONDecodeError:
        pass

    return []


async def extract_fd_rates_batch(urls: list[dict]) -> dict:
    """Extract FD rates from multiple bank URLs.

    Args:
        urls: List of dicts with 'url' and 'bank_name' keys.

    Returns:
        Consolidated FD data dict.
    """
    banks_data = []

    for bank_info in urls:
        try:
            bank_data = await extract_fd_rates_from_url(
                url=bank_info["url"],
                bank_name=bank_info["bank_name"],
            )
            banks_data.append(bank_data)
        except Exception as e:
            banks_data.append(
                {
                    "bank_name": bank_info["bank_name"],
                    "source_url": bank_info["url"],
                    "scraped_at": datetime.utcnow().isoformat() + "Z",
                    "rates": [],
                    "error": str(e),
                }
            )

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_banks": len(banks_data),
        "banks": banks_data,
    }
