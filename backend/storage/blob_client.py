"""Azure Blob Storage client for saving FD rate data."""

import json
import os
from datetime import datetime

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContentSettings


def get_blob_service_client() -> BlobServiceClient:
    """Create BlobServiceClient using Entra ID (DefaultAzureCredential).

    Parses the account name from AZURE_STORAGE_ACCOUNT_NAME or
    AZURE_STORAGE_CONNECTION_STRING.
    """
    account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME", "")
    if not account_name:
        conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
        for part in conn_str.split(";"):
            if part.startswith("AccountName="):
                account_name = part.split("=", 1)[1]
                break
    if not account_name:
        raise ValueError(
            "Set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING."
        )
    account_url = f"https://{account_name}.blob.core.windows.net"
    credential = DefaultAzureCredential()
    return BlobServiceClient(account_url, credential=credential)


def ensure_container_exists(container_name: str) -> None:
    client = get_blob_service_client()
    try:
        client.create_container(container_name)
    except Exception:
        pass  # container already exists


def save_to_blob(data: dict, container_name: str | None = None) -> str:
    """Save consolidated FD data JSON to Azure Blob Storage.

    Returns the blob URL.
    """
    container_name = container_name or os.getenv(
        "AZURE_STORAGE_CONTAINER_NAME", "fd-rates"
    )
    ensure_container_exists(container_name)

    client = get_blob_service_client()
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    blob_name = f"fd_rates_{timestamp}.json"

    blob_client = client.get_blob_client(container=container_name, blob=blob_name)
    json_content = json.dumps(data, indent=2, ensure_ascii=False)
    blob_client.upload_blob(
        json_content,
        overwrite=True,
        content_settings=ContentSettings(content_type="application/json"),
    )

    # Also save as "latest.json" for easy access
    latest_client = client.get_blob_client(container=container_name, blob="latest.json")
    latest_client.upload_blob(
        json_content,
        overwrite=True,
        content_settings=ContentSettings(content_type="application/json"),
    )

    return blob_client.url


def get_latest_from_blob(container_name: str | None = None) -> dict | None:
    """Retrieve the latest FD rates JSON from Blob Storage."""
    container_name = container_name or os.getenv(
        "AZURE_STORAGE_CONTAINER_NAME", "fd-rates"
    )
    client = get_blob_service_client()

    try:
        blob_client = client.get_blob_client(
            container=container_name, blob="latest.json"
        )
        data = blob_client.download_blob().readall()
        return json.loads(data)
    except Exception:
        return None
