#  the file is for the aggregation of all the APIs in the app , 
from fastapi import APIRouter
from app.features.auth.router import router as AuthRouter 
from app.features.phone_verification.router import router as PhoneVerificationRouter
from app.features.categories.router import router as CategoriesRouter
from app.features.workers.router import router as WorkersRouter
from app.features.admin.router import router as AdminRouter
from app.features.users.router import router as UsersRouter
from app.features.tasks.router import router as TasksRouter
from app.features.push.router import router as PushRouter
from app.features.search_logs.router import router as SearchLogsRouter

router = APIRouter()

# auth , request_otp and verify_otp 
router.include_router(AuthRouter)

# phone verification , request_verification and confirm_verification
router.include_router(PhoneVerificationRouter)

# categories — public listing of services
router.include_router(CategoriesRouter)

# workers — profile creation, management, uploads
router.include_router(WorkersRouter)

# admin — role management, category visibility, etc.
router.include_router(AdminRouter)

# users — authenticated user profile
router.include_router(UsersRouter)

# tasks — creation, matching, applications, approval, cancellation
router.include_router(TasksRouter)

# push — web push subscriptions
router.include_router(PushRouter)

# search logs — public, fire-and-forget search analytics
router.include_router(SearchLogsRouter)
