 <!-- keep the below folder structure in mind -->

app/
├── main.py                     # app factory
├── core/
│   ├── config.py                 # settings (pydantic-settings)
│   ├── logging.py
│   └── security.py
├── db/
│   ├── base.py                   # DeclarativeBase + central model registry
│   └── session.py                # async engine + get_db dependency
├── api/
│   └── router.py                 # aggregates every feature's router
├── features/
│   ├── users/
│   │   ├── __init__.py
│   │   ├── models.py              # SQLAlchemy ORM models for this feature
│   │   ├── schemas.py             # Pydantic request/response models
│   │   ├── router.py              # FastAPI APIRouter + route functions
│   │   ├── service.py             # business logic / DB queries
│   │   ├── exceptions.py          # domain exceptions specific to this feature
│   │   └── dependencies.py        # feature-local dependencies (optional)
│   ├── orders/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── router.py
│   │   ├── service.py
│   │   └── exceptions.py
│   └── auth/
│       ├── __init__.py
│       ├── router.py
│       ├── schemas.py
│       └── service.py
├── shared/
│   ├── exceptions.py              # base AppError + cross-feature exceptions
│   ├── cache.py
│   ├── middleware.py
│   └── pagination.py
└── tests/
    ├── features/
    │   ├── test_users.py
    │   └── test_orders.py
    └── conftest.py