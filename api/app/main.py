"""
MeuApp Eventos — API mockada com FastAPI.

Acesso via NGINX:
  https://api.meuappweb.com.br/...            (subdomínio dedicado)
  https://meuappweb.com.br/api/...            (mesma origem do front público)
  https://admin.meuappweb.com.br/api/...      (mesma origem do painel admin)
"""

import hashlib
import hmac
import os
import socket
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from .data import EVENTS, REGISTRATIONS

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
# Token determinístico: funciona mesmo com várias réplicas (--scale api=3)
ADMIN_TOKEN = hashlib.sha256(f"{ADMIN_USER}:{ADMIN_PASSWORD}:meuapp".encode()).hexdigest()
INSTANCE = socket.gethostname()

app = FastAPI(
    title="MeuApp Eventos API",
    version="1.0.0",
    description="API mockada do exemplo do e-book *Guia Definitivo NGINX*.",
)

# CORS só é necessário para quem chamar o subdomínio api.* a partir de outra
# origem. Os fronts deste exemplo usam /api na MESMA origem e não dependem disto.
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.middleware("http")
async def add_instance_header(request: Request, call_next):
    """Identifica qual réplica respondeu (útil para ver o least_conn em ação)."""
    response = await call_next(request)
    response.headers["X-Api-Instance"] = INSTANCE
    return response


# --------------------------------------------------------------------------- models
class RegistrationIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=120)


class LoginIn(BaseModel):
    username: str
    password: str


bearer = HTTPBearer(auto_error=False)


def require_admin(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> None:
    if creds is None or not hmac.compare_digest(creds.credentials, ADMIN_TOKEN):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido ou ausente")


def _event_or_404(event_id: int) -> dict:
    for ev in EVENTS:
        if ev["id"] == event_id:
            return ev
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Evento não encontrado")


def _with_seats(ev: dict) -> dict:
    taken = sum(1 for r in REGISTRATIONS if r["event_id"] == ev["id"])
    return {**ev, "registered": taken, "seats_left": max(ev["capacity"] - taken, 0)}


# --------------------------------------------------------------------------- público
@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok", "instance": INSTANCE}


@app.get("/v1/events", tags=["eventos"])
def list_events(tag: str | None = None):
    items = [e for e in EVENTS if tag is None or tag in e["tags"]]
    return {"items": [_with_seats(e) for e in items], "total": len(items)}


@app.get("/v1/events/{event_id}", tags=["eventos"])
def get_event(event_id: int):
    return _with_seats(_event_or_404(event_id))


@app.get("/v1/tags", tags=["eventos"])
def list_tags():
    return sorted({t for e in EVENTS for t in e["tags"]})


@app.post("/v1/events/{event_id}/registrations", status_code=201, tags=["eventos"])
def register(event_id: int, body: RegistrationIn):
    ev = _with_seats(_event_or_404(event_id))
    if ev["seats_left"] == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Evento lotado")
    if any(r["event_id"] == event_id and r["email"].lower() == body.email.lower() for r in REGISTRATIONS):
        raise HTTPException(status.HTTP_409_CONFLICT, "E-mail já inscrito neste evento")
    reg = {
        "id": max((r["id"] for r in REGISTRATIONS), default=0) + 1,
        "event_id": event_id,
        "name": body.name,
        "email": body.email,
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    REGISTRATIONS.append(reg)
    return reg


@app.get("/v1/debug/request", tags=["infra"])
def debug_request(request: Request):
    """Mostra o que o backend 'enxerga' — prova de que o NGINX preserva o contexto."""
    h = request.headers
    return {
        "instance": INSTANCE,
        "client_ip": request.client.host if request.client else None,
        "scheme": request.url.scheme,
        "host": h.get("host"),
        "path_recebido_pelo_backend": request.url.path,
        "x_real_ip": h.get("x-real-ip"),
        "x_forwarded_for": h.get("x-forwarded-for"),
        "x_forwarded_proto": h.get("x-forwarded-proto"),
        "x_forwarded_host": h.get("x-forwarded-host"),
    }


# --------------------------------------------------------------------------- admin
@app.post("/v1/auth/login", tags=["admin"])
def login(body: LoginIn):
    ok = hmac.compare_digest(body.username, ADMIN_USER) and hmac.compare_digest(body.password, ADMIN_PASSWORD)
    if not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário ou senha inválidos")
    return {"access_token": ADMIN_TOKEN, "token_type": "bearer", "user": ADMIN_USER}


@app.get("/v1/admin/stats", tags=["admin"], dependencies=[Depends(require_admin)])
def admin_stats():
    events = [_with_seats(e) for e in EVENTS]
    total_capacity = sum(e["capacity"] for e in events)
    total_registered = sum(e["registered"] for e in events)
    return {
        "events": len(events),
        "registrations": total_registered,
        "capacity": total_capacity,
        "occupancy_pct": round(100 * total_registered / total_capacity, 1) if total_capacity else 0,
        "by_event": [
            {"id": e["id"], "title": e["title"], "registered": e["registered"], "capacity": e["capacity"]}
            for e in events
        ],
        "instance": INSTANCE,
    }


@app.get("/v1/admin/registrations", tags=["admin"], dependencies=[Depends(require_admin)])
def admin_registrations():
    titles = {e["id"]: e["title"] for e in EVENTS}
    items = sorted(REGISTRATIONS, key=lambda r: r["created_at"], reverse=True)
    return {"items": [{**r, "event_title": titles.get(r["event_id"])} for r in items], "total": len(items)}
