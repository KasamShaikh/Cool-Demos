"""Pydantic models for FD Rate Scraper."""

from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


class BankUrl(BaseModel):
    """A bank URL submitted by the user."""

    id: Optional[str] = None
    url: str
    bank_name: str
    added_at: Optional[str] = None


class FDRate(BaseModel):
    """A single FD rate entry."""

    category: str  # e.g., "Senior Citizen", "General", "Super Senior Citizen"
    tenor_min_days: Optional[int] = None
    tenor_max_days: Optional[int] = None
    tenor_description: str  # e.g., "1 year to 2 years", "365 days to 729 days"
    rate_percent: float
    amount_slab: Optional[str] = None  # e.g., "< 2 Cr", ">= 2 Cr"
    scheme_name: Optional[str] = None
    effective_date: Optional[str] = None
    additional_info: Optional[str] = None


class BankFDData(BaseModel):
    """FD rate data for a single bank."""

    bank_name: str
    source_url: str
    scraped_at: str
    rates: list[FDRate]


class ConsolidatedFDData(BaseModel):
    """Consolidated FD data across all banks."""

    generated_at: str
    total_banks: int
    banks: list[BankFDData]


class ScrapeRequest(BaseModel):
    """Request to scrape FD rates."""

    urls: list[BankUrl]


class ScrapeResponse(BaseModel):
    """Response from scraping."""

    status: str
    message: str
    blob_url: Optional[str] = None
    data: Optional[ConsolidatedFDData] = None
