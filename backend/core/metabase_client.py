"""
Cliente HTTP para a API do Metabase (sessão ou API key).
Usado pelo Django para o frontend receber dados calculados no Metabase.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class MetabaseError(Exception):
    """Erro ao falar com o Metabase."""


def _jsonify_cell(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()[:10] if isinstance(val, date) else val.isoformat()
    return val


def rows_to_dicts(data: dict) -> list[dict]:
    """Converte o bloco `data` da resposta /api/card/:id/query em lista de dicts."""
    cols = data.get("cols") or []
    names: list[str] = []
    for c in cols:
        n = c.get("name")
        if not n or str(n).startswith("_"):
            n = c.get("display_name") or "col"
        names.append(str(n))
    out: list[dict] = []
    for row in data.get("rows") or []:
        d: dict[str, Any] = {}
        for i, val in enumerate(row):
            key = names[i] if i < len(names) else f"c{i}"
            d[key] = _jsonify_cell(val)
        out.append(d)
    return out


def get_metabase_session() -> requests.Session:
    """Sessão autenticada (API key tem prioridade sobre email/senha)."""
    base = (getattr(settings, "METABASE_URL", None) or "").rstrip("/")
    if not base:
        raise MetabaseError("METABASE_URL não definido.")

    api_key = (getattr(settings, "METABASE_API_KEY", None) or "").strip()
    if api_key:
        s = requests.Session()
        s.headers["X-Api-Key"] = api_key
        return s

    user = (getattr(settings, "METABASE_USER", None) or "").strip()
    password = (getattr(settings, "METABASE_PASSWORD", None) or "").strip()
    if not user or not password:
        raise MetabaseError("Defina METABASE_API_KEY ou METABASE_USER + METABASE_PASSWORD.")

    s = requests.Session()
    r = s.post(
        f"{base}/api/session",
        json={"username": user, "password": password},
        timeout=45,
    )
    if not r.ok:
        logger.warning("Metabase session failed: %s %s", r.status_code, r.text[:300])
        raise MetabaseError(f"Login Metabase falhou ({r.status_code}).")
    return s


def run_card_query(session: requests.Session, base_url: str, card_id: int) -> dict:
    """Executa uma pergunta guardada (card) e devolve o objeto `data`."""
    if not card_id:
        raise MetabaseError("card_id inválido.")
    url = f"{base_url.rstrip('/')}/api/card/{card_id}/query"
    r = session.post(url, json={}, timeout=120)
    if not r.ok:
        logger.warning("Metabase card %s: %s %s", card_id, r.status_code, r.text[:400])
        raise MetabaseError(f"Card {card_id} falhou ({r.status_code}).")
    body = r.json()
    return body.get("data") or {}


def metabase_cards_fully_configured() -> bool:
    ids = getattr(settings, "METABASE_CARD_IDS", {}) or {}
    needed = (
        "overview",
        "by_category",
        "by_brand",
        "low_stock",
        "top_by_stock_value",
        "expiration",
    )
    if not all(ids.get(k) for k in needed):
        return False
    if (getattr(settings, "METABASE_API_KEY", None) or "").strip():
        return True
    u = (getattr(settings, "METABASE_USER", None) or "").strip()
    p = (getattr(settings, "METABASE_PASSWORD", None) or "").strip()
    return bool(u and p)


def _normalize(s: str) -> str:
    return (s or "").strip().lower()


def list_all_collections(session: requests.Session, base_url: str) -> list[dict]:
    r = session.get(f"{base_url.rstrip('/')}/api/collection", timeout=45)
    if not r.ok:
        raise MetabaseError(f"Falha ao listar collections ({r.status_code}).")
    body = r.json()
    return body if isinstance(body, list) else []


def find_collection_id_by_name(session: requests.Session, base_url: str, name: str) -> str | int:
    """
    Retorna o ID da collection (pode ser 'root' ou int).
    Retorna 0 se não encontrada.
    """
    wanted = _normalize(name)
    if not wanted:
        return 0

    # Aceita ID direto ("4"), root, ou URL do Metabase:
    # - http://localhost:3000/collection/4-admin-...
    # - /collection/4-admin-...
    # - /collection/root
    if wanted == "root":
        return "root"
    if wanted.isdigit():
        return int(wanted)
    url_match = re.search(r"/collection/(root|\d+)", wanted)
    if url_match:
        raw = url_match.group(1)
        if raw == "root":
            return "root"
        return int(raw)

    for c in list_all_collections(session, base_url):
        if _normalize(c.get("name", "")) == wanted:
            raw_id = c.get("id")
            # 'root' é um id especial do Metabase (string)
            if isinstance(raw_id, str):
                return raw_id
            try:
                return int(raw_id)
            except (TypeError, ValueError):
                return 0
    return 0


def list_collection_cards(session: requests.Session, base_url: str, collection_id: str | int) -> list[dict]:
    if not collection_id and collection_id != "root":
        return []
    url = f"{base_url.rstrip('/')}/api/collection/{collection_id}/items"
    r = session.get(url, timeout=45)
    if not r.ok:
        raise MetabaseError(f"Falha ao listar itens da collection {collection_id} ({r.status_code}).")
    body = r.json()
    # Metabase retorna {"data": [...], "total": N, ...} — nunca uma lista raiz
    if isinstance(body, dict):
        rows = body.get("data") or []
    elif isinstance(body, list):
        rows = body
    else:
        rows = []
    cards: list[dict] = []
    for row in rows:
        model = _normalize(str(row.get("model", "")))
        if model in ("card", "dataset"):
            cards.append(
                {
                    "id": int(row.get("id") or 0),
                    "name": str(row.get("name") or ""),
                    "description": str(row.get("description") or ""),
                }
            )
    return cards


def _has_any(text: str, keywords: list[str]) -> bool:
    t = _normalize(text)
    return any(_normalize(k) in t for k in keywords)


def infer_card_ids_from_collection(cards: list[dict]) -> dict:
    """
    Tenta identificar os 6 cards por palavras-chave.
    Retorna dicionário parcial/completo.
    """
    out = {
        "overview": 0,
        "by_category": 0,
        "by_brand": 0,
        "low_stock": 0,
        "top_by_stock_value": 0,
        "expiration": 0,
        "sales_monthly": 0,
    }
    for c in cards:
        cid = int(c.get("id") or 0)
        text = f"{c.get('name','')} {c.get('description','')}"
        if not out["overview"] and _has_any(text, ["overview", "resumo", "geral", "visao", "visão"]):
            out["overview"] = cid
            continue
        if not out["by_category"] and _has_any(text, ["categoria"]):
            out["by_category"] = cid
            continue
        if not out["by_brand"] and _has_any(text, ["marca"]):
            out["by_brand"] = cid
            continue
        if not out["low_stock"] and _has_any(text, ["estoque baixo", "low stock", "baixo"]):
            out["low_stock"] = cid
            continue
        if not out["top_by_stock_value"] and _has_any(text, ["top", "valor", "maior valor"]):
            out["top_by_stock_value"] = cid
            continue
        if not out["expiration"] and _has_any(text, ["validade", "venc", "expir"]):
            out["expiration"] = cid
            continue
        if not out["sales_monthly"] and _has_any(text, ["vend", "receita", "fatur", "mensal", "mês", "mes"]):
            out["sales_monthly"] = cid
            continue
    return out
