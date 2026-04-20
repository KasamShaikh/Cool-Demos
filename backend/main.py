"""FastAPI application entry point for FD Rate Scraper."""

import os

from dotenv import load_dotenv

load_dotenv(override=False)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.routes import router

app = FastAPI(
    title="FD Rate Scraper",
    description="AI-powered Fixed Deposit rate extraction using Azure AI Foundry",
    version="1.0.0",
)

# CORS for frontend
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
