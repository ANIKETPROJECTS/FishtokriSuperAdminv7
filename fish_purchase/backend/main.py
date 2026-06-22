from __future__ import annotations

import json
import logging
import os
import secrets
from pathlib import Path
from typing import Any, Dict, Optional

# import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from db import (
    create_raw_fish_product,
    delete_record,
    get_conn,
    # ensure_user,
    get_record_by_id,
    # get_user_by_user_id,
    init_db,
    insert_record,
    list_raw_fish_products,
    list_records,
    set_db_abstraction,
    update_record,
    # verify_user_password,
)
from db_abstraction import DatabaseAbstraction
from sync_service import SyncService

BACKEND_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BACKEND_DIR / "config.json"

# Simple authentication credentials
ADMIN_USERNAME = "fishtokri_admin"
ADMIN_PASSWORD = "XxVFAA_mQCQ@Nz3"

# In-memory token storage (simple approach)
# In production, use a proper session store or database
active_tokens: set[str] = set()


class ConfigModel(BaseModel):
    # Values are in ₹ per gram
    market_handling_cost: float = Field(ge=0)
    fixed_cost: float = Field(ge=0)
    packaging_cost: float = Field(ge=0)
    delivery_cost: float = Field(ge=0)


class CalculateSalePriceRequest(BaseModel):
    buy_price_per_kg: float = Field(gt=0)
    wastage_percent: float = Field(ge=0, lt=100)  # can be 0
    margin_percent: float = Field(ge=0)  # can be 0; user enters percentage


class SaveRecordRequest(CalculateSalePriceRequest):
    # YYYY-MM-DD (used by date picker)
    record_date: str = Field(min_length=10, max_length=10)
    raw_fish_product_id: Optional[int] = None
    raw_fish_product_name: Optional[str] = None
    total_kg: Optional[float] = None
    total_purchase_kg: Optional[float] = None
    expiry_date: Optional[str] = None  # YYYY-MM-DD format


class RawFishProductCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class RawFishProductResponse(BaseModel):
    id: int
    name: str
    created_at: str


class UpdateRecordRequest(BaseModel):
    buy_price_per_kg: float = Field(gt=0)
    wastage_percent: float = Field(ge=0, lt=100)
    margin_percent: float = Field(ge=0)
    total_kg: Optional[float] = None
    total_purchase_kg: Optional[float] = None
    expiry_date: Optional[str] = None  # YYYY-MM-DD format


class RecordResponse(BaseModel):
    id: int
    record_date: str
    created_at: str
    inputs: Dict[str, Any]
    config: Dict[str, Any]
    outputs: Dict[str, Any]


def _read_config_raw() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        default_cfg = ConfigModel(
            market_handling_cost=0.0,
            fixed_cost=0.0,
            packaging_cost=0.0,
            delivery_cost=0.0,
        )
        CONFIG_PATH.write_text(json.dumps(default_cfg.model_dump(), indent=2), encoding="utf-8")
        return default_cfg.model_dump()

    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to read config.json: {e}") from e


def read_config() -> ConfigModel:
    raw = _read_config_raw()
    try:
        return ConfigModel.model_validate(raw)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Invalid config.json: {e}") from e


def write_config(cfg: ConfigModel) -> None:
    try:
        CONFIG_PATH.write_text(json.dumps(cfg.model_dump(), indent=2), encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to write config.json: {e}") from e


def r4(x: float) -> float:
    return round(float(x), 4)


def r2(x: float) -> float:
    return round(float(x), 2)


def generate_batch_number(record_date: str) -> str:
    """
    Convert YYYY-MM-DD to DDMMYYYY format for batch number.
    Example: 2025-12-19 -> 19122025 (DD=19, MM=12, YYYY=2025)
    Following the example provided in the requirement.
    """
    if len(record_date) != 10 or record_date[4] != "-" or record_date[7] != "-":
        raise ValueError("record_date must be in YYYY-MM-DD format")
    year = record_date[0:4]
    month = record_date[5:7]
    day = record_date[8:10]
    return f"{day}{month}{year}"


import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="Fish Pricing System", version="1.0.0")

security = HTTPBearer()


# def _allowed_origins() -> list[str]:
#     raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
#     origins = [o.strip() for o in raw.split(",") if o.strip()]
#     return origins or ["http://localhost:5173", "http://127.0.0.1:5173"]


# CORS for local/frontend (configure with ALLOWED_ORIGINS in deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# @app.middleware("http")
# async def security_headers(request, call_next):  # type: ignore[no-untyped-def]
#     resp = await call_next(request)
#     resp.headers["X-Content-Type-Options"] = "nosniff"
#     resp.headers["X-Frame-Options"] = "DENY"
#     resp.headers["Referrer-Policy"] = "no-referrer"
#     resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
#     # Note: HSTS should only be set when served over HTTPS in production.
#     if os.getenv("ENABLE_HSTS", "").lower() in {"1", "true", "yes"}:
#         resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
#     return resp


# def create_access_token(*, user_id: str) -> str:
#     import time

#     now = int(time.time())
#     payload = {
#         "sub": user_id,
#         "iat": now,
#         "exp": now + max(60, JWT_EXPIRES_SECONDS),
#     }
#     return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    if token not in active_tokens:
        logger.warning(f"Invalid token attempted: token starts with {token[:10]}... (active tokens: {len(active_tokens)})")
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")
    return {"user_id": ADMIN_USERNAME}


@app.on_event("startup")
def _startup() -> None:
    """Initialize database and sync service on startup."""
    # Load environment variables
    load_dotenv()
    
    # Initialize SQLite database
    init_db()
    
    # Initialize sync service with Supabase credentials from environment
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_KEY", "").strip()
    
    global _sync_service
    _sync_service = SyncService(
        supabase_url=supabase_url if supabase_url else None,
        supabase_key=supabase_key if supabase_key else None,
    )
    
    # Initialize database abstraction
    db_abstraction = DatabaseAbstraction(
        sync_service=_sync_service,  # Use the global _sync_service variable
        sqlite_conn_getter=get_conn,  # Use the imported get_conn function
    )
    
    # Set the global database abstraction
    set_db_abstraction(db_abstraction)
    
    # Start sync service (begins background thread for automatic syncing)
    _sync_service.start()
    
    logger.info("Application started with sync service")
    if supabase_url and supabase_key:
        logger.info("Supabase integration enabled")
    else:
        logger.warning("Supabase credentials not provided, using SQLite only")
    
    # admin_id = os.getenv("ADMIN_ID", "").strip()
    # admin_password = os.getenv("ADMIN_PASSWORD", "")
    # # Bootstrap an initial account for deployment
    # if admin_id and admin_password:
    #     ensure_user(user_id=admin_id, password=admin_password)


# Store sync service reference for health endpoint
_sync_service: Optional[SyncService] = None


@app.get("/health")
def health() -> Dict[str, Any]:
    """
    Health check endpoint with sync status information.
    
    Returns:
        Dictionary with application status and sync service information
    """
    global _sync_service
    
    try:
        sync_status = "unknown"
        queue_stats = {}
        supabase_status = "not_configured"
        
        if _sync_service:
            sync_status = _sync_service.get_status().value
            queue_stats = _sync_service.get_queue_stats()
            
            # Check Supabase connection
            if _sync_service.supabase:
                try:
                    if _sync_service.check_connection():
                        supabase_status = "connected"
                    else:
                        supabase_status = "disconnected"
                except Exception as e:
                    supabase_status = f"error: {str(e)[:50]}"
            else:
                supabase_status = "not_configured"
        
        return {
            "status": "ok",
            "database": "operational",
            "supabase_status": supabase_status,
            "sync_status": sync_status,
            "queue_stats": queue_stats,
        }
    except Exception as e:
        logger.error(f"Error getting health status: {e}")
        return {
            "status": "ok",
            "database": "operational",
            "sync_status": "error",
            "error": str(e),
        }


class LoginRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@app.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest) -> LoginResponse:
    # Keep error response generic to reduce user enumeration
    if req.user_id != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate a simple token
    token = secrets.token_urlsafe(32)
    active_tokens.add(token)
    return LoginResponse(access_token=token, token_type="bearer")


@app.post("/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, str]:
    token = credentials.credentials
    active_tokens.discard(token)
    return {"status": "logged out"}


@app.get("/auth/me")
def me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return user

@app.get("/config", response_model=ConfigModel)
def get_config(user: Dict[str, Any] = Depends(get_current_user)) -> ConfigModel:
    return read_config()


@app.post("/config", response_model=ConfigModel)
def post_config(cfg: ConfigModel, user: Dict[str, Any] = Depends(get_current_user)) -> ConfigModel:
    write_config(cfg)
    return cfg


@app.post("/calculate/sale-price")
def calculate_sale_price(
    req: CalculateSalePriceRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    cfg = read_config()

    buy_price_per_g = req.buy_price_per_kg / 1000.0

    # Handle wastage safely; wastage can be 0
    if req.wastage_percent == 0:
        effective_price_per_g = buy_price_per_g
    else:
        denom = 1.0 - (req.wastage_percent / 100.0)
        if denom <= 0:
            raise HTTPException(status_code=422, detail="wastage_percent must be < 100")
        effective_price_per_g = buy_price_per_g / denom

    base_cost_per_g = (
        effective_price_per_g
        + cfg.market_handling_cost
        + cfg.fixed_cost
        + cfg.packaging_cost
        + cfg.delivery_cost
    )

    # Margin is a percentage of base_cost_per_g
    margin_price_per_g = base_cost_per_g * (req.margin_percent / 100.0)

    final_sale_price_per_g = base_cost_per_g + margin_price_per_g

    packet_weights = [100, 250, 500, 750, 1000]
    packet_prices: Dict[str, float] = {
        f"{w}g": r2(final_sale_price_per_g * w) for w in packet_weights
    }

    return {
        # Return prices rounded to 2 decimals for UI friendliness.
        "buy_price_per_gram": r2(buy_price_per_g),
        "effective_price_per_gram": r2(effective_price_per_g),
        "margin_price_per_gram": r2(margin_price_per_g),
        "final_sale_price_per_gram": r2(final_sale_price_per_g),
        "packet_prices": packet_prices,
    }


@app.post("/records", response_model=RecordResponse)
def create_record(req: SaveRecordRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    # Basic YYYY-MM-DD validation
    if len(req.record_date) != 10 or req.record_date[4] != "-" or req.record_date[7] != "-":
        raise HTTPException(status_code=422, detail="record_date must be in YYYY-MM-DD format")

    # Reuse existing calculation logic by calling the function directly (but without recursion)
    outputs = calculate_sale_price(
        CalculateSalePriceRequest(
            buy_price_per_kg=req.buy_price_per_kg,
            wastage_percent=req.wastage_percent,
            margin_percent=req.margin_percent,
        )
    )
    cfg = read_config().model_dump()

    # Generate batch number from record_date (MMDDYYYY format)
    batch_number = generate_batch_number(req.record_date)
    
    inputs_dict = {
        "buy_price_per_kg": req.buy_price_per_kg,
        "wastage_percent": req.wastage_percent,
        "margin_percent": req.margin_percent,
        "raw_fish_product_id": req.raw_fish_product_id,
        "raw_fish_product_name": req.raw_fish_product_name,
        "batch_number": batch_number,
    }
    if req.total_kg is not None:
        inputs_dict["total_kg"] = req.total_kg
    if req.total_purchase_kg is not None:
        inputs_dict["total_purchase_kg"] = req.total_purchase_kg
    if req.expiry_date is not None:
        inputs_dict["expiry_date"] = req.expiry_date
    
    record = insert_record(
        record_date=req.record_date,
        inputs=inputs_dict,
        config=cfg,
        outputs=outputs,
    )
    return record


@app.get("/records", response_model=list[RecordResponse])
def get_records(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 200,
    user: Dict[str, Any] = Depends(get_current_user),
) -> list[Dict[str, Any]]:
    try:
        return list_records(from_date=from_date, to_date=to_date, limit=limit)
    except Exception as e:
        logger.error(f"Error listing records: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list records: {str(e)}") from e


@app.get("/raw-fish-products", response_model=list[RawFishProductResponse])
def get_raw_fish_products(limit: int = 500) -> list[Dict[str, Any]]:
    """Get list of raw fish products."""
    try:
        products = list_raw_fish_products(limit=limit)
        logger.debug(f"Returning {len(products)} raw fish products")
        return products
    except Exception as e:
        logger.error(f"Error listing raw fish products: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list products: {str(e)}") from e


@app.post("/raw-fish-products", response_model=RawFishProductResponse)
def post_raw_fish_product(req: RawFishProductCreateRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Create a new raw fish product."""
    try:
        logger.info(f"Creating raw fish product: {req.name}")
        product = create_raw_fish_product(name=req.name)
        logger.info(f"Created raw fish product: id={product.get('id')}, name={product.get('name')}")
        return product
    except ValueError as e:
        logger.warning(f"Validation error creating product: {e}")
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error creating raw fish product: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create product: {str(e)}") from e


@app.patch("/records/{record_id}", response_model=RecordResponse)
def patch_record(
    record_id: int, req: UpdateRecordRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    existing = get_record_by_id(record_id=record_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")

    outputs = calculate_sale_price(
        CalculateSalePriceRequest(
            buy_price_per_kg=req.buy_price_per_kg,
            wastage_percent=req.wastage_percent,
            margin_percent=req.margin_percent,
        )
    )
    cfg = read_config().model_dump()

    new_inputs = dict(existing.get("inputs") or {})
    new_inputs.update(
        {
            "buy_price_per_kg": req.buy_price_per_kg,
            "wastage_percent": req.wastage_percent,
            "margin_percent": req.margin_percent,
        }
    )
    if req.total_kg is not None:
        new_inputs["total_kg"] = req.total_kg
    if req.total_purchase_kg is not None:
        new_inputs["total_purchase_kg"] = req.total_purchase_kg
    if req.expiry_date is not None:
        new_inputs["expiry_date"] = req.expiry_date

    updated = update_record(
        record_id=record_id,
        record_date=existing["record_date"],
        inputs=new_inputs,
        config=cfg,
        outputs=outputs,
    )
    return updated


@app.delete("/records/{record_id}")
def delete_record_endpoint(record_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    existing = get_record_by_id(record_id=record_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")
    
    deleted = delete_record(record_id=record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"status": "deleted", "id": str(record_id)}

