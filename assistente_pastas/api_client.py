"""
Cliente HTTP leve para os watchers do Assistente da Oficina (Kanban e Fim de Corte).
Comunica preferencialmente com o servidor local (localhost:3000) com fallback para a nuvem,
reaproveitando o token/credenciais salvos no monitor local e renovando automaticamente em 401/403.
"""

import json
import logging
import os
import threading
import urllib.error
import urllib.request
from pathlib import Path

from config import BASE_DIR, load_config

DEFAULT_BASE_URLS = [
    "http://localhost:3000",
    "https://mach3tracker.up.railway.app",
]

MONITOR_CONFIG_PATH = BASE_DIR.parent / "monitor" / "config.json"

_auth_lock = threading.Lock()
_cached_token: str | None = None


def _load_auth_material() -> tuple[str | None, str | None, str | None, str | None]:
    cfg = load_config()
    token = (cfg.get("api_token") or "").strip() or None
    email = (cfg.get("api_email") or "").strip() or None
    password = cfg.get("api_password") or None
    sync_key = (os.environ.get("OFICINA_SYNC_KEY") or cfg.get("sync_key") or "").strip() or None

    if MONITOR_CONFIG_PATH.exists():
        try:
            mcfg = json.loads(MONITOR_CONFIG_PATH.read_text(encoding="utf-8"))
            if isinstance(mcfg, dict):
                token = token or (mcfg.get("token") or "").strip() or None
                email = email or (mcfg.get("email") or "").strip() or None
                password = password or mcfg.get("password") or None
        except Exception:
            pass

    return token, email, password, sync_key


def _get_base_urls() -> list[str]:
    cfg = load_config()
    custom = (cfg.get("api_url") or "").strip().rstrip("/")
    urls = []
    if custom:
        urls.append(custom)
    for u in DEFAULT_BASE_URLS:
        if u not in urls:
            urls.append(u)
    return urls


def _refresh_token(base_url: str, email: str | None, password: str | None, user_agent: str, timeout: float) -> str | None:
    global _cached_token
    if not email or not password:
        return None
    try:
        body = json.dumps({"email": email, "password": password}).encode("utf-8")
        req = urllib.request.Request(
            f"{base_url}/api/auth/login",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": user_agent,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                tok = (data.get("token") or "").strip()
                if tok:
                    with _auth_lock:
                        _cached_token = tok
                    return tok
    except Exception as exc:
        logging.debug(f"Falha ao renovar token em {base_url}: {exc}")
    return None


def fetch_json(paths: list[str], user_agent: str = "RoboRouter/1.0", timeout: float = 4.0):
    """Consulta o primeiro servidor e caminho disponível retornando o JSON decodificado (dict ou list)."""
    global _cached_token
    file_token, email, password, sync_key = _load_auth_material()
    with _auth_lock:
        if not _cached_token and file_token:
            _cached_token = file_token
        token = _cached_token

    for base_url in _get_base_urls():
        for idx, rel_path in enumerate(paths):
            full_url = f"{base_url}{rel_path}"
            for attempt in range(2):
                headers = {
                    "User-Agent": user_agent,
                    "Accept": "application/json",
                }
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                if sync_key:
                    headers["X-Sync-Key"] = sync_key

                try:
                    req = urllib.request.Request(full_url, headers=headers)
                    with urllib.request.urlopen(req, timeout=timeout) as resp:
                        if resp.status == 200:
                            return json.loads(resp.read().decode("utf-8"))
                    break
                except urllib.error.HTTPError as http_err:
                    if http_err.code in (401, 403) and attempt == 0:
                        refreshed = _refresh_token(base_url, email, password, user_agent, timeout)
                        if refreshed:
                            token = refreshed
                            continue
                    if http_err.code == 404 and idx < len(paths) - 1:
                        # Rota nova pode ainda não existir na nuvem; tenta endpoint fallback
                        break
                    logging.debug(f"HTTP {http_err.code} em {full_url}")
                    break
                except Exception as exc:
                    logging.debug(f"Falha ao consultar {full_url}: {exc}")
                    break
    return None
