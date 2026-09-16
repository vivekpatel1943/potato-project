from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from app.api.api_registry import router as public_router
from app.core.config import Settings

settings = Settings()

app = FastAPI()

# CORS — allow the frontend origin(s)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Retry-After"],  # so the frontend JS can read this header
)

router = APIRouter()


@app.get('/api/v1/health-check')
def health_check():
    return "your server is healthy"

# all the api routes 
router.include_router(public_router,prefix="/api/v1")

# including the router into the app  , 
app.include_router(router)




