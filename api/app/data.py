"""Dados mockados do MeuApp Eventos (sem banco: tudo em memória)."""

from datetime import date

EVENTS: list[dict] = [
    {
        "id": 1,
        "slug": "nginx-na-pratica",
        "title": "NGINX na Prática: do Dev Local à Produção",
        "date": date(2026, 11, 12).isoformat(),
        "city": "Recife",
        "venue": "CESAR — Cais do Apolo",
        "tags": ["nginx", "devops"],
        "capacity": 120,
        "summary": "Proxy reverso, arquivo hosts e domínios locais sem portas.",
    },
    {
        "id": 2,
        "slug": "tls-nota-a-mais",
        "title": "TLS Nota A+: Hardening de Servidores Web",
        "date": date(2026, 11, 26).isoformat(),
        "city": "Recife",
        "venue": "Porto Digital",
        "tags": ["seguranca", "tls"],
        "capacity": 80,
        "summary": "TLS 1.3, cifras AEAD, HSTS, CSP e rate limiting na prática.",
    },
    {
        "id": 3,
        "slug": "fastapi-em-producao",
        "title": "FastAPI em Produção atrás de um Proxy Reverso",
        "date": date(2026, 12, 3).isoformat(),
        "city": "Online",
        "venue": "Transmissão ao vivo",
        "tags": ["python", "api"],
        "capacity": 500,
        "summary": "Headers X-Forwarded-*, uvicorn com proxy-headers e observabilidade.",
    },
    {
        "id": 4,
        "slug": "docker-compose-microsservicos",
        "title": "Microsserviços Locais com Docker Compose",
        "date": date(2026, 12, 10).isoformat(),
        "city": "São Paulo",
        "venue": "Hub de Inovação",
        "tags": ["docker", "devops"],
        "capacity": 150,
        "summary": "Um único ponto de entrada para vários serviços com o mesmo domínio.",
    },
    {
        "id": 5,
        "slug": "load-balancing-upstream",
        "title": "Load Balancing com Upstream: least_conn, ip_hash e mais",
        "date": date(2027, 1, 21).isoformat(),
        "city": "Online",
        "venue": "Transmissão ao vivo",
        "tags": ["nginx", "performance"],
        "capacity": 300,
        "summary": "Escalando réplicas da API e observando a distribuição de carga.",
    },
]

# Inscrições feitas durante a execução (somem ao reiniciar o container)
REGISTRATIONS: list[dict] = [
    {"id": 1, "event_id": 1, "name": "Ana Souza", "email": "ana@example.com", "created_at": "2026-10-01T10:00:00Z"},
    {"id": 2, "event_id": 1, "name": "Bruno Lima", "email": "bruno@example.com", "created_at": "2026-10-02T14:30:00Z"},
    {"id": 3, "event_id": 2, "name": "Carla Mendes", "email": "carla@example.com", "created_at": "2026-10-03T09:15:00Z"},
]
