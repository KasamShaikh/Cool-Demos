# FD Rate Scraper — AI-Powered Fixed Deposit Rate Aggregator

An intelligent web application that **scrapes**, **extracts**, and **consolidates** Fixed Deposit interest rates from Indian bank websites using **Azure OpenAI GPT-4o** and **Playwright browser automation**.

Users add bank FD-rate page URLs via a React dashboard, trigger a scrape, and the system automatically navigates tabbed pages, extracts structured rate data through AI, and persists results to Azure Blob Storage.

---

## Architecture Overview

```
┌──────────────────┐        ┌─────────────────────────────────────────────┐
│   React Frontend │  HTTP  │              FastAPI Backend                │
│   (Port 3001)    │───────►│              (Port 8001)                    │
│                  │        │                                             │
│  • URL Manager   │        │  ┌──────────┐  ┌────────────┐  ┌────────┐ │
│  • Scrape Button │        │  │ API Layer │→ │  AI Agent   │→ │Scraper │ │
│  • Results View  │        │  │ routes.py │  │fd_rate_agent│  │_worker │ │
│                  │        │  └─────┬─────┘  └──────┬─────┘  └───┬────┘ │
└──────────────────┘        │        │               │             │      │
                            │        ▼               ▼             ▼      │
                            │  ┌──────────┐  ┌────────────┐  ┌────────┐ │
                            │  │URL Store │  │Azure OpenAI│  │Chromium│ │
                            │  │urls.json │  │  (GPT-4o)  │  │Browser │ │
                            │  └──────────┘  └────────────┘  └────────┘ │
                            │        │                                    │
                            │        ▼                                    │
                            │  ┌─────────────────┐                       │
                            │  │  Azure Blob      │                       │
                            │  │  Storage          │                       │
                            │  │  (fd-rates)       │                       │
                            │  └─────────────────┘                       │
                            └─────────────────────────────────────────────┘
```

### Data Flow

1. **Add URL** — User adds a bank's FD rate page URL via the React UI
2. **Trigger Scrape** — React calls `POST /api/scrape`
3. **Browser Automation** — Playwright (headless Chromium) opens the page in a subprocess, detects amount-slab tabs, clicks each, and captures all visible rate tables
4. **AI Extraction** — Each tab's content is sent to **Azure OpenAI GPT-4o** with a structured prompt; the model returns JSON with category, tenor, rate, slab, and scheme details
5. **Aggregation** — Results from all tabs and all banks are merged into a `ConsolidatedFDData` object
6. **Storage** — Results are saved to Azure Blob Storage as timestamped JSON + `latest.json`
7. **Display** — The React frontend renders bank-wise FD rates with category filters and expandable tables

---

## Technology Stack

| Layer            | Technology                          | Version    |
|------------------|-------------------------------------|------------|
| **Frontend**     | React                               | 18.3       |
| **Backend**      | FastAPI + Uvicorn                   | 0.115+     |
| **Language**     | Python                              | 3.10+      |
| **AI Model**     | Azure OpenAI — GPT-4o              | 2024-11-20 |
| **Scraping**     | Playwright (Chromium headless)      | 1.40+      |
| **Storage**      | Azure Blob Storage                  | SDK 12.20+ |
| **Auth**         | Azure Identity (DefaultAzureCredential) | 1.17+  |
| **IaC**          | Bicep                               | —          |
| **Deployment**   | Azure CLI + PowerShell              | —          |

---

## Azure Resources

Deployed via the Bicep template in `infra/main.bicep`:

| Resource              | Type                                  | Naming Pattern            | Purpose                                 |
|-----------------------|---------------------------------------|---------------------------|-----------------------------------------|
| **Resource Group**    | `Microsoft.Resources/resourceGroups`  | `rg-fd-rate-scraper`     | Logical container for all resources     |
| **Storage Account**   | `Microsoft.Storage/storageAccounts`   | `fdrates<suffix>`        | Stores scraped FD rate JSON files       |
| **Blob Container**    | Blob container within Storage Account | `fd-rates`               | Container holding rate snapshots        |
| **AI Services**       | `Microsoft.CognitiveServices/accounts`| `fd-scraper-ai-<suffix>` | Azure OpenAI endpoint for GPT-4o       |
| **GPT-4o Deployment** | Model deployment within AI Services   | `gpt-4o`                 | GPT-4o model (Standard, 30 TPM)        |

> `<suffix>` is auto-generated via `uniqueString(resourceGroup().id)` for global uniqueness.

---

## Project Structure

```
fd-rate-scraper/
├── backend/                        # Python FastAPI backend
│   ├── main.py                     # App entry: FastAPI init, CORS, router mount
│   ├── models.py                   # Pydantic models (BankUrl, FDRate, ScrapeResponse, etc.)
│   ├── requirements.txt            # Python dependencies
│   ├── agent/                      # AI + scraping logic
│   │   ├── fd_rate_agent.py        # Azure OpenAI agent: extracts FD rates from scraped content
│   │   ├── scraper_tool.py         # Async subprocess wrapper for _scrape_worker
│   │   └── _scrape_worker.py       # Playwright browser scraper (runs as subprocess)
│   ├── api/                        # REST API layer
│   │   ├── routes.py               # FastAPI endpoints (/urls, /scrape, /results)
│   │   └── url_store.py            # JSON file-based URL persistence
│   └── storage/                    # Azure storage integration
│       └── blob_client.py          # Blob Storage client (Entra ID auth)
├── frontend/                       # React.js frontend
│   ├── public/
│   │   └── index.html              # HTML shell
│   ├── src/
│   │   ├── App.js                  # Main component (UI, state, styling)
│   │   ├── api.js                  # HTTP client for backend API
│   │   └── index.js                # React DOM entry point
│   └── package.json                # Node.js dependencies & proxy config
├── infra/                          # Infrastructure-as-Code
│   ├── main.bicep                  # Bicep template (Storage + AI Services + GPT-4o)
│   └── setup.ps1                   # PowerShell deployment script
├── data/
│   └── urls.json                   # Persisted bank URLs (git-ignored)
├── .env.template                   # Environment variable template
├── .gitignore                      # Git exclusions
└── README.md                       # This file
```

### File Details

#### `backend/main.py`
FastAPI application entry point. Loads `.env` via `python-dotenv`, configures CORS middleware (origins from `CORS_ORIGINS`), mounts the API router at `/api`, and exposes a `/health` endpoint.

#### `backend/models.py`
Pydantic v2 data models used across the application:
- **`BankUrl`** — Bank URL entry (id, url, bank_name, added_at)
- **`FDRate`** — Single FD rate (category, tenor, rate_percent, amount_slab, scheme_name, effective_date, additional_info)
- **`BankFDData`** — All rates for one bank
- **`ConsolidatedFDData`** — Multi-bank aggregated response
- **`ScrapeRequest` / `ScrapeResponse`** — API request/response wrappers

#### `backend/agent/fd_rate_agent.py`
Core AI extraction agent. For each bank URL:
1. Calls `fetch_page_content()` to get scraped text
2. Splits content by tab markers (`=== TAB N: "label" ===`)
3. Sends each tab's content to **Azure OpenAI GPT-4o** with a structured extraction prompt
4. Parses JSON response into `FDRate` objects
5. Returns consolidated data across all banks

Uses `AsyncAzureOpenAI` with `DefaultAzureCredential` token provider.

#### `backend/agent/scraper_tool.py`
Thin async wrapper that runs `_scrape_worker.py` as a **subprocess** via `asyncio.to_thread()`. This isolation avoids Windows `ProactorEventLoop` conflicts between Playwright and Uvicorn.

#### `backend/agent/_scrape_worker.py`
Standalone Playwright scraper executed as `python -m backend.agent._scrape_worker <url>`. Key capabilities:
- Launches headless Chromium
- Detects clickable tabs using 20+ CSS selector patterns (Bootstrap, Semantic UI, custom)
- Clicks each tab (up to 20), captures table changes via before/after diffing
- Outputs formatted text with `=== TAB N: "label" ===` markers
- Handles dynamic content loading with smart waits

#### `backend/api/routes.py`
FastAPI router with five endpoints:

| Method   | Path              | Description                          |
|----------|-------------------|--------------------------------------|
| `GET`    | `/api/urls`       | List all stored bank URLs            |
| `POST`   | `/api/urls`       | Add a new bank URL                   |
| `DELETE`  | `/api/urls/{id}`  | Remove a URL by ID                   |
| `POST`   | `/api/scrape`     | Trigger scraping + AI extraction     |
| `GET`    | `/api/results/latest` | Get latest results from Blob Storage |

#### `backend/api/url_store.py`
JSON file-based URL store (`data/urls.json`). Provides `get_all_urls()`, `add_url()`, and `delete_url()` with UUID generation and timestamps. No database required.

#### `backend/storage/blob_client.py`
Azure Blob Storage client using **Entra ID authentication** (`DefaultAzureCredential`). Saves scraped results as:
- `fd_rates_YYYYMMDD_HHMMSS.json` — Timestamped snapshot
- `latest.json` — Always points to the most recent scrape

#### `frontend/src/App.js`
Main React component with an **Axis Bank-inspired burgundy theme** (`#97144D`). Features:
- URL management panel (add, list, delete)
- One-click scrape trigger with loading state
- Results dashboard with stats cards (total banks, total rates)
- Bank-wise expandable rate tables with category badges (Senior Citizen, General, etc.)

#### `frontend/src/api.js`
API client abstraction. Functions: `getUrls()`, `addUrl()`, `deleteUrl()`, `triggerScrape()`, `getLatestResults()`. Uses the proxy defined in `package.json` for dev.

#### `infra/main.bicep`
Bicep IaC template that provisions:
- Azure Storage Account (Standard_LRS, TLS 1.2, HTTPS only)
- Blob container (`fd-rates`)
- Azure AI Services (S0 tier)
- GPT-4o model deployment (Standard, 30 TPM)

#### `infra/setup.ps1`
PowerShell deployment script. Handles Azure CLI login, resource group creation, Bicep deployment, and `.env` file generation in one command.

---

## Prerequisites

| Requirement       | Minimum Version | Install Command / Link                                      |
|-------------------|-----------------|-------------------------------------------------------------|
| **Python**        | 3.10+           | [python.org](https://www.python.org/downloads/)             |
| **Node.js**       | 18+             | [nodejs.org](https://nodejs.org/)                           |
| **Azure CLI**     | 2.50+           | `winget install Microsoft.AzureCLI`                         |
| **Azure Subscription** | —          | [Free account](https://azure.microsoft.com/free/)          |
| **Git**           | 2.30+           | `winget install Git.Git`                                    |

---

## Setup Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/kasamshaikh/Cool-Demos.git
cd Cool-Demos
```

### Step 2: Deploy Azure Infrastructure

```powershell
cd infra
.\setup.ps1 -ResourceGroup "rg-fd-rate-scraper" -Location "eastus2"
```

This will:
- Create the resource group (if needed)
- Deploy Storage Account + AI Services + GPT-4o
- Auto-generate the `.env` file with connection strings

### Step 3: Assign Azure RBAC Roles

The app uses **Entra ID authentication** (no storage keys). Assign these roles to your user or service principal:

```powershell
# Storage Blob Data Contributor — for reading/writing FD rate JSON files
az role assignment create \
  --assignee "<your-principal-id>" \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/<sub-id>/resourceGroups/rg-fd-rate-scraper/providers/Microsoft.Storage/storageAccounts/<storage-name>"

# Cognitive Services OpenAI User — for calling GPT-4o
az role assignment create \
  --assignee "<your-principal-id>" \
  --role "Cognitive Services OpenAI User" \
  --scope "/subscriptions/<sub-id>/resourceGroups/rg-fd-rate-scraper/providers/Microsoft.CognitiveServices/accounts/<ai-name>"
```

### Step 4: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
playwright install chromium
```

### Step 5: Start the Backend

```bash
# From the project root
uvicorn backend.main:app --reload --port 8001
```

The API will be available at `http://localhost:8001`. Verify with:
```
GET http://localhost:8001/health
```

### Step 6: Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Step 7: Start the Frontend

```bash
cd frontend
npm start
```

The React app will open at `http://localhost:3001` (or `3000` depending on availability) and proxy API calls to the backend.

### Step 8: Use the Application

1. **Add a bank URL** — Enter a bank's FD interest rate page URL (e.g., `https://www.hdfc.bank.in/interest-rates`) and a bank name
2. **Click "Scrape All Banks"** — The system will navigate the page, detect tabs, and extract rates via AI
3. **View results** — Consolidated FD rates appear in the dashboard, grouped by bank with category filters

---

## Environment Variables

Copy `.env.template` to `.env` and fill in the values (or use `setup.ps1` to auto-generate):

| Variable                          | Description                                          | Example                              |
|-----------------------------------|------------------------------------------------------|--------------------------------------|
| `FOUNDRY_PROJECT_ENDPOINT`        | Azure OpenAI endpoint URL                            | `https://fd-scraper-ai-xxx.cognitiveservices.azure.com/` |
| `FOUNDRY_MODEL_DEPLOYMENT_NAME`   | Model deployment name                                | `gpt-4o`                             |
| `AZURE_STORAGE_CONNECTION_STRING` | Storage account connection string (used for account name parsing) | `DefaultEndpointsProtocol=https;...` |
| `AZURE_STORAGE_CONTAINER_NAME`    | Blob container name                                  | `fd-rates`                           |
| `BACKEND_PORT`                    | Backend server port                                  | `8000`                               |
| `CORS_ORIGINS`                    | Allowed CORS origins (comma-separated)               | `http://localhost:3000`              |

---

## API Reference

| Method   | Endpoint              | Request Body                           | Response                              |
|----------|-----------------------|----------------------------------------|---------------------------------------|
| `GET`    | `/api/urls`           | —                                      | `[{id, url, bank_name, added_at}]`   |
| `POST`   | `/api/urls`           | `{url: string, bank_name: string}`     | `{id, url, bank_name, added_at}`     |
| `DELETE`  | `/api/urls/{id}`      | —                                      | `{status: "deleted"}`                |
| `POST`   | `/api/scrape`         | —                                      | `{status, message, blob_url, data}`  |
| `GET`    | `/api/results/latest` | —                                      | `{generated_at, total_banks, banks}` |
| `GET`    | `/health`             | —                                      | `{status: "ok"}`                     |

---

## Key Design Decisions

1. **Subprocess Isolation for Playwright** — Playwright runs in a separate Python process (`_scrape_worker.py`) to avoid `ProactorEventLoop` conflicts with Uvicorn on Windows.

2. **AI over Regex** — GPT-4o extracts structured data from messy HTML instead of fragile CSS selectors/regex, making it adaptable to different bank page layouts.

3. **Multi-Tab Detection** — The scraper detects and clicks through amount-slab/category tabs on bank pages (up to 20 tabs), capturing rate variations across slabs.

4. **Entra ID Authentication** — Uses `DefaultAzureCredential` for both Blob Storage and OpenAI, eliminating the need to manage API keys or storage keys.

5. **No Database** — URLs are stored in a simple JSON file (`data/urls.json`), keeping the setup lightweight for a PoC.

---

## License

MIT
