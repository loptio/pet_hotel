"""Shared response helpers for S1 contract-only stubs."""
from __future__ import annotations

from fastapi import HTTPException, status

S1_STUB_DETAIL = "Not implemented in S1 (contract-only). Business logic lands in S2."


def not_implemented(feature: str = "") -> HTTPException:
    """501 with a consistent message. Endpoints declare a real response_model so
    the OpenAPI contract is complete, but the body is unimplemented in S1."""
    detail = f"{S1_STUB_DETAIL} [{feature}]" if feature else S1_STUB_DETAIL
    return HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=detail)
