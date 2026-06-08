"""FastAPI application entrypoint — Pet Hotel & Grooming System (S1).

Modular monolith. The API Gateway surface (SDD §2.1) is realised as router-prefix
groups: only the 5 gateway services are exposed — Auth, Booking, CheckIn,
Grooming, Cancellation — plus the owner-facing Pets & Health resource the
use-case diagram mandates. payment / notification / audit are INTERNAL modules:
models + service stubs only, no router (triggered by other services).

S1 endpoints are contract-only: real response_model schemas, bodies return 501.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from app.core.config import settings
# Import every model so the SQLAlchemy registry is complete and mappers
# (string-target relationships like Account→Pet) configure correctly.
from app.db import base as _models  # noqa: F401
from app.modules.auth.router import router as auth_router
from app.modules.booking.router import router as booking_router
from app.modules.cancellation.router import router as cancellation_router
from app.modules.checkin.router import router as checkin_router
from app.modules.grooming.router import router as grooming_router
from app.modules.pet.router import router as pet_router

OPENAPI_TAGS = [
    {"name": "Auth", "description": "Gateway service — registration, login, password reset, "
                                    "self-profile (FR-01.1/01.4) + admin RBAC: roles, permissions, "
                                    "staff creation, account ban, abnormal-cancellation report "
                                    "(FR-01.2/01.3)."},
    {"name": "Pets & Health", "description": "Owner-facing resource — pet profiles, append-only "
                                             "medical records, vaccinations + proof upload, "
                                             "danger-level marking & unblock (FR-02.*)."},
    {"name": "Booking", "description": "Gateway service — create lodging/grooming bookings with "
                                       "danger gating, availability, list/history, deposit & final "
                                       "payment, staff review (FR-03.*, FR-05.3, FR-02.8)."},
    {"name": "CheckIn", "description": "Gateway service — front-desk check-in (booking+chip+vaccine), "
                                       "counter vaccine entry, check-out, kennel management "
                                       "(FR-04.1, FR-02.5, FR-06.1, FR-03.6/06.4)."},
    {"name": "Grooming", "description": "Gateway service — work-order lifecycle, 4-stage advance, "
                                        "photo upload, completion, emergency trigger "
                                        "(FR-04.2/04.4/04.5, FR-06.3)."},
    {"name": "Cancellation", "description": "Gateway service — cancel a booking and apply the 24h "
                                            "refund rule (FR-03.3, FR-05.4)."},
]

DESCRIPTION = (
    "Contract-first OpenAPI for the Pet Hotel & Grooming System.\n\n"
    "**S1 status:** endpoints are stubs (HTTP 501) with complete request/response "
    "schemas — this document is the single source of truth for backend + frontend. "
    "Business logic, state machines and real payment/notification land in S2+.\n\n"
    "Authoritative data model: `diagrams/puml/class_diagram_plantuml.puml`. "
    "Internal modules (payment, notification, audit) are not exposed as endpoints."
)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0-S1",
    description=DESCRIPTION,
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Gateway-exposed routers (5 services + owner-facing Pets & Health), all under /api/v1.
for r in (auth_router, pet_router, booking_router, checkin_router, grooming_router, cancellation_router):
    app.include_router(r, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["meta"], summary="Liveness probe")
def health():
    return {"status": "ok", "service": settings.app_name, "stage": "S1"}


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")
