
"""Shared config: loads .env and builds the Gemini and Gradium clients."""
import os
import sys
from functools import cache

from dotenv import load_dotenv
from google import genai
import gradium

load_dotenv()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
VOICE_ID = os.getenv("GRADIUM_VOICE_ID", "YTpq7expH9539ERJ")


def _require(name: str) -> str:
    value = os.getenv(name, "")
    if not value or value.startswith(("your-", "gsk_your-")):
        sys.exit(f"Missing {name}: set it in .env (see .env.example)")
    return value


@cache
def gemini_client() -> genai.Client:
    return genai.Client(api_key=_require("GEMINI_API_KEY"))


@cache
def gradium_client() -> gradium.client.GradiumClient:
    return gradium.client.GradiumClient(api_key=_require("GRADIUM_API_KEY"))
