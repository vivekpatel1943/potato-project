# this file is for the aggregation of all the database models in the app , so that they can be easily imported into env.py

from app.features.users.models import User
from app.features.workers.models import WorkerProfile , WorkerCapability , WorkerCapabilityProof , WorkerVerificationDocument , WorkerOnboardingDraft
from app.features.categories.models import Category , Subcategory
from app.features.tasks.models import Task , TaskApplication
from app.features.push.models import PushSubscription
from app.features.search_logs.models import SearchLog
