Yes. I would keep the task model exactly around those fields. The important thing is to separate three different responsibilities that are getting mixed together:
Geolocation → figuring out where the customer/worker is.
Matching → figuring out which workers qualify for this task.
Push API → telling those already-qualified workers that a task exists.
That gives us a much cleaner architecture.
1. Customer creates the task
I'd put a prominent CTA directly on the customer home page:
What do you need done? Search for a service...
and perhaps:
+ Post a task
I actually prefer making the task composer part of the home page itself rather than hiding it behind a generic button.
For example:
┌──────────────────────────────────────────────┐ │ │ │ What do you need help with? │ │ │ │ 🔍 Search for a service... │ │ │ │ Popular │ │ 🍳 Cooking 🔧 Repairs 🧹 Cleaning │ │ │ └──────────────────────────────────────────────┘
Clicking/searching opens the task composer.
You want the customer's first thought to be:
"Tell Potato what you need."
rather than:
"Navigate to Tasks → Create → New Task..."
That's particularly appropriate because task creation is basically the main product action.
2. Search for the capability
The customer types:
biryani
Your backend searches your controlled subcategories taxonomy.
For example:
Cooking ├── Biryani Cooking ├── Home Cooking ├── Meal Preparation └── Baking
The search returns:
Biryani Cooking
The customer selects it.
Now the task has:
subcategory_id = <biryani-cooking-id>
This is extremely important because this ID becomes the matching key later.
We aren't going to ask workers:
"Can you cook?"
We're going to ask:
"Is this worker registered for exactly this capability?"
3. Customer specifies the task
Now collect:
subcategory_id description scheduled_at location budget specific_requirements
For example:
Capability: Biryani Cooking Description: Need chicken biryani for 6 people. When: 30 September 2026 7:00 PM Budget: ₹600 Specific requirements: Please bring your own ingredients.
That's enough for your MVP.
4. Location is where Geolocation API comes in
You actually have two different uses of location.
Customer location
When creating the task, the customer can choose:
Use my current location
The browser's Geolocation API can request the user's current coordinates.
The frontend gets something like:
latitude longitude
The customer can alternatively search for a location and edit the resulting location.
So your task ultimately gets something like:
location: latitude longitude address
The coordinates are what your matching engine cares about.
The address is primarily for human readability.
MDN's official documentation for this is the [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API?utm_source=chatgpt.com).
5. Customer submits the task
Now your backend has:
Task ──────────────────── customer_id subcategory_id description scheduled_at latitude longitude budget specific_requirements status created_at
At this point, the task exists.
But nobody has been notified yet.
That's where your matching engine starts.
6. Matching begins
Your backend asks:
Which workers are eligible for this task?
I'd think about this as a series of filters.
Filter 1 — Capability
worker has task.subcategory_id
For a Biryani task:
Biryani Cooking ↓ workers registered for Biryani Cooking
This is your primary matching condition.
Filter 2 — Identity verification
verification_status = VERIFIED
We don't want unverified workers receiving marketplace tasks.
Filter 3 — Subscription
subscription.status = ACTIVE
Because of your subscription business model.
A worker whose subscription has expired shouldn't receive new opportunities.
Filter 4 — Availability
worker.availability = TRUE
This is the worker's explicit:
"I'm currently willing to receive work."
7. Now we need the worker's current location
This is where your Redis + browser geolocation architecture comes in.
When a worker is actively available:
Worker's browser ↓ Geolocation API ↓ latitude + longitude ↓ FastAPI ↓ Redis
Redis might conceptually contain:
worker_id latitude longitude last_seen
You don't put this constantly changing location in worker_profiles.
And because the location is ephemeral, you can give it a TTL.
8. Calculate proximity
Now your backend has:
Task: lat = X lng = Y Worker: lat = A lng = B
Your matching layer calculates:
How far is this worker from the task?
Suppose your MVP radius is:
5 km
Then:
Worker A → 1.2 km ✅ Worker B → 3.7 km ✅ Worker C → 8.4 km ❌
Only A and B qualify.
9. NOW Push API comes into play
This distinction is important.
Push API is NOT used to find workers.
It is used to notify workers that the backend has already determined are eligible.
So:
Geolocation ↓ "Where is the worker?" Matching ↓ "Should this worker receive this task?" Push API ↓ "Tell this worker about the task."
That's the clean mental model.
10. Notification
Suppose Rahul qualifies.
Your backend has Rahul's push subscription.
It sends something like:
🍛 New task nearby Biryani cooking ₹600 budget Today, 7:00 PM ~2.1 km away
Rahul doesn't have to be actively looking at the Potato website.
The browser's push infrastructure can deliver the notification to the registered service worker.
The official web APIs involved here are the [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) and [PushSubscription](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription?utm_source=chatgpt.com).
11. Rahul opens Potato
The notification takes him to Potato.
Now he sees:
Biryani Cooking ₹600 budget Today · 7:00 PM 2.1 km away Need chicken biryani for 6 people. Please bring your own ingredients. [ Apply ]
Then your application process begins.
The complete architecture
I'd visualize your MVP like this:
CUSTOMER │ │ Create Task │ ▼ ┌─────────────────┐ │ FastAPI │ └────────┬────────┘ │ ▼ PostgreSQL │ Task created │ ▼ ┌─────────────────┐ │ Matching Engine │ └────────┬────────┘ │ ┌────────────┼────────────┐ │ │ │ ▼ ▼ ▼ Capability Verification Subscription matching verified active │ │ │ └────────────┼────────────┘ │ ▼ Availability │ ▼ ┌─────────────────┐ │ Redis │ │ worker location │ │ + last_seen │ └────────┬────────┘ │ ▼ Distance check │ within radius │ ▼ Eligible workers │ ▼ ┌─────────────────┐ │ Web Push │ └────────┬────────┘ │ ▼ WORKER │ ▼ Opens Potato │ ▼ Views Task │ ▼ Apply
And notice what each technology is responsible for
Technology
Responsibility
Geolocation API
Get device coordinates
PostgreSQL
Permanent application data
Redis
Temporary worker location/presence
Matching service
Decide which workers qualify
Push API
Notify qualifying workers
Service Worker
Receive/process push notifications
FastAPI
Orchestrate all of the above
This separation is important.
One subtle thing about the customer's location
You said:
"this location that he enters will be fully editable"
Absolutely.
Don't treat the customer's GPS location as the task location.
Instead:
Customer's current location ↓ suggestion ↓ Customer edits/selects ↓ Actual task location
For example, I'm currently at home but I want a mechanic to fix my car at my office.
My device says:
Current location: Home
but I search/select:
Task location: Office
The task should use the office coordinates, not my current GPS coordinates.
So the Geolocation API is merely one convenient way to populate the initial location

I'd make one small addition to your task schema

I'd have:

subcategory_id
description
scheduled_at
latitude
longitude
address
budget
specific_requirements

And potentially:

status

because your task is going to move through states:

OPEN
   ↓
WORKER_SELECTED
   ↓
IN_PROGRESS
   ↓
COMPLETED

and potentially:

CANCELLED
EXPIRED

Don't overcomplicate the state machine yet, but having a task status from day one is worthwhile.


The core idea

Your entire MVP can essentially be reduced to:

Customer describes WHAT + WHEN + WHERE + BUDGET → Potato finds WHO.

And:

Geolocation tells us WHERE.

Your capability taxonomy tells us WHAT.

Availability/subscription/verification tell us WHO is eligible.

Redis tells us WHO is nearby right now.

Push API tells those people that a task exists.

That's a very clean foundation for Potato, and importantly, you don't need AI or complicated recommendation algorithms for this first version.

