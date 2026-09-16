#  the file is for the aggregation of all the APIs in the app , 
from fastapi import APIRouter
from app.features.auth.router import router as AuthRouter 
from app.features.phone_verification.router import router as PhoneVerificationRouter

router = APIRouter()

# auth , request_otp and verify_otp 
router.include_router(AuthRouter)

# phone verification , request_verification and confirm_verification
router.include_router(PhoneVerificationRouter)
