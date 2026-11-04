import os
import logging

import requests

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "go-perks"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _with_retry(fn):
    resp = fn(init_storage())
    if resp.status_code == 404:
        resp = fn(init_storage(force=True))
    resp.raise_for_status()
    return resp


def put_object(path: str, data: bytes, content_type: str) -> dict:
    return _with_retry(lambda key: requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type},
                                                data=data, timeout=120)).json()


def get_object(path: str) -> tuple:
    resp = _with_retry(lambda key: requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60))
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
