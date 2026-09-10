# Designing a Secure Authentication System in FastAPI

An intermediate/advanced guide focused on building an authentication system that's actually hard to break — not just one that logs users in. Every design decision below is made by asking "what does this cost an attacker?" rather than "does this work in the happy path?"

Builds on the feature-based structure from the backend guide: this all lives in `features/auth/` (plus a couple of `shared/` pieces), alongside your `users` feature.

Stack: **FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, PostgreSQL, Redis, `argon2-cffi`, `pyjwt`, `pyotp`**.

---

## 1. Threat Model First

Before writing code, be explicit about what you're defending against — it changes what "secure" means for each decision:

| Threat | Defends against |
| --- | --- |
| Credential stuffing / brute force | Rate limiting, account lockout, breached-password checks |
| Stolen access token | Short TTL, narrow scope, no sensitive data in payload |
| Stolen refresh token | Rotation + reuse detection, hashed storage, device binding |
| XSS exfiltrating tokens | httpOnly cookies over localStorage, strict CSP |
| CSRF | SameSite cookies + CSRF token on state-changing routes |
| JWT algorithm confusion | Pin algorithm explicitly, use asymmetric signing |
| DB compromise | Hashed passwords (Argon2id), hashed refresh tokens, no plaintext secrets |
| Timing attacks on login/compare | Constant-time comparison, uniform error responses |
| Session hijack after logout | Server-side revocation list, not just client-side token deletion |
| Insider / leaked logs | No tokens or passwords in logs, structured audit trail |

Keep this table in your head as you read — most of the design choices below trace directly back to one row in it.

---

## 2. Feature Structure

```
features/auth/
├── models.py          # RefreshToken, LoginAttempt, MFADevice
├── schemas.py         # Login/Register/Token/MFA schemas
├── router.py
├── service.py          # token issuance, verification, rotation
├── security.py         # hashing, JWT signing/verification, TOTP
├── dependencies.py     # get_current_user, require_mfa, rate limit deps
└── exceptions.py
```

`features/users/models.py` keeps the `User` model itself; `auth` owns everything about proving *and re-proving* identity. This split matters once you add SSO or API keys later — those are new ways to authenticate the same `User`, not new user types.

---

## 3. Password Storage

**Use Argon2id, not bcrypt, not PBKDF2, and never a general-purpose hash (SHA-256, MD5) for passwords.** Argon2id is memory-hard, which is specifically what makes GPU/ASIC cracking expensive — bcrypt is still acceptable but Argon2id is the current OWASP recommendation.

```python
# features/auth/security.py
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash

# Tune time_cost/memory_cost to your hardware: aim for ~250-500ms per hash
# on your actual app servers. Too fast = brute-forceable; too slow = DoS vector.
ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16)

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return ph.verify(hashed, password)
    except (VerifyMismatchError, InvalidHash):
        return False

def needs_rehash(hashed: str) -> bool:
    """Call after successful login; rehash transparently if params changed."""
    return ph.check_needs_rehash(hashed)
```

Notes:

- **Salting is automatic** with `argon2-cffi` — never build your own salt scheme.
- **A pepper (a secret, app-wide value mixed into the hash input, stored outside the DB) is optional defense-in-depth** against a DB-only compromise, but don't build one unless you also have a real plan for pepper rotation — a hardcoded pepper you never rotate is mostly theater.
- **Rehash on login, not on a background job.** You only have the plaintext password at the moment of a successful login — use that window:

```python
# features/auth/service.py
async def authenticate(db, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if user is None:
        # Run a dummy hash to keep timing constant whether or not the user exists.
        ph.hash(password)
        raise InvalidCredentialsError()

    if not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError()

    if needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(password)
        await db.commit()

    return user
```

That dummy hash on the "user not found" path is not decoration — without it, a nonexistent-email response returns near-instantly while a wrong-password response takes ~300ms, and that gap is enough to enumerate valid emails via timing.

- **Never** return different error messages for "user not found" vs "wrong password" either. One generic `InvalidCredentialsError → "Invalid email or password"` for both.

---

## 4. Token Design: Access + Refresh, Done Properly

The single most common mistake: one long-lived JWT used for everything. Instead, use two tokens with different jobs and different blast radii.

- **Access token**: short-lived (5–15 min), JWT, stateless, sent on every request, never revocable individually — its short TTL *is* the revocation mechanism.
- **Refresh token**: long-lived (days–weeks), opaque random string (not a JWT), stored **hashed** in the DB, used only to mint new access tokens, and **rotated on every use**.

### 4.1 Why the refresh token isn't a JWT

A JWT refresh token can't be revoked without a server-side lookup anyway (you need a denylist), so you gain nothing from it being self-describing — and you lose the ability to easily detect *reuse* (see §4.3). A random opaque token stored hashed in the DB, looked up by ID, gets you revocation and reuse-detection for free.

```python
# features/auth/models.py
import secrets
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from db.base import Base

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    family_id: Mapped[str] = mapped_column(String(36), index=True)  # groups a rotation chain
    device_info: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=None, default=datetime.utcnow)

def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)  # 384 bits of entropy, URL-safe
```

Never use `random`, `uuid.uuid4()` string concatenation tricks, or anything not from `secrets`/`os.urandom` for tokens. `secrets.token_urlsafe` is CSPRNG-backed; `uuid4` technically is too, but its format is a worse fit and its "randomness" is easy to misuse if someone later swaps in `uuid.uuid1` (which is *not* random — it embeds MAC address and timestamp).

Store only a hash of the refresh token, like a password:

```python
import hashlib

def hash_token(token: str) -> str:
    # SHA-256 is fine here — unlike passwords, refresh tokens already have
    # 384 bits of entropy, so there's no offline brute-force risk to defend
    # against with a slow hash. This is a lookup key, not a secret-stretching step.
    return hashlib.sha256(token.encode()).hexdigest()
```

### 4.2 Access token: JWT, signed asymmetrically

```python
# features/auth/security.py
import jwt
import time
import uuid
from core.config import settings

ALGORITHM = "RS256"  # asymmetric: sign with private key, verify with public key

def create_access_token(user_id: int, roles: list[str]) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "roles": roles,
        "iat": now,
        "exp": now + 60 * 10,          # 10 minutes
        "jti": str(uuid.uuid4()),       # unique per token, useful for audit correlation
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_private_key, algorithm=ALGORITHM, headers={"kid": settings.jwt_key_id})

def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.jwt_public_key,
        algorithms=[ALGORITHM],   # explicit allow-list — see §4.4
        options={"require": ["exp", "iat", "sub", "type"]},
    )
```

Why **RS256 over HS256**: with HS256 the same secret both signs and verifies, so every service that needs to *validate* a token also holds the ability to *forge* one. With RS256, only the auth service holds the private key; any number of downstream services (or a gateway) can verify with the public key and never gain forging power. This matters the moment your backend stops being a single process.

### 4.3 Refresh flow with rotation + reuse detection

This is the part that actually stops stolen-refresh-token attacks from being silent.

**The rule: every refresh token can be used exactly once.** Using it issues a new access token *and* a new refresh token, and immediately invalidates the old one. If a refresh token is ever presented a second time, that's proof someone has a copy of a token that was already consumed — either the legitimate client made a duplicate request, or an attacker has a stolen copy. Treat it as compromise: **revoke the entire token family** (every token descended from the original login), forcing full re-authentication.

```python
# features/auth/service.py
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, update
from features.auth.models import RefreshToken, generate_refresh_token, hash_token
from features.auth.exceptions import TokenReuseDetectedError, InvalidRefreshTokenError
from features.auth.security import create_access_token

REFRESH_TOKEN_TTL = timedelta(days=14)

async def issue_token_pair(db, user, device_info: str | None = None) -> tuple[str, str]:
    """Called on login — starts a new rotation family."""
    family_id = str(uuid.uuid4())
    return await _issue_refresh_token(db, user, family_id, device_info)

async def _issue_refresh_token(db, user, family_id: str, device_info: str | None) -> tuple[str, str]:
    raw_token = generate_refresh_token()
    record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        family_id=family_id,
        device_info=device_info,
        expires_at=datetime.utcnow() + REFRESH_TOKEN_TTL,
    )
    db.add(record)
    await db.commit()

    access_token = create_access_token(user.id, roles=user.roles)
    return access_token, raw_token

async def refresh_tokens(db, raw_refresh_token: str, device_info: str | None = None) -> tuple[str, str]:
    token_hash = hash_token(raw_refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    record = result.scalar_one_or_none()

    if record is None:
        raise InvalidRefreshTokenError()

    if record.revoked_at is not None:
        # This exact token was already used/revoked before — reuse detected.
        # Nuke the whole family: every token that ever descended from this login.
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == record.family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.utcnow())
        )
        await db.commit()
        # log a high-severity security event here — see §12
        raise TokenReuseDetectedError()

    if record.expires_at < datetime.utcnow():
        raise InvalidRefreshTokenError()

    # Rotate: revoke the used token, issue a new one in the same family.
    record.revoked_at = datetime.utcnow()
    await db.commit()

    user = await get_user_by_id(db, record.user_id)
    return await _issue_refresh_token(db, user, record.family_id, device_info)
```

A few implementation details that matter:

- **Revoke-then-issue must be in the same transaction context** (or as close as practically possible) — a race where two requests refresh the same token concurrently should result in exactly one succeeding and the other hitting the reuse path, not both succeeding.
- **`family_id` is what lets you invalidate an entire compromised session chain** without touching the user's other logged-in devices — only tokens descended from the stolen one get killed.
- This is the same design Auth0/Okta and the OAuth2 spec's own guidance (RFC 6819) converge on for public clients — it's not a homegrown scheme, it's the industry-standard mitigation for refresh token theft.

### 4.4 JWT pitfalls to close off explicitly

- **Never accept `alg: none`.** This is the classic "algorithm confusion" attack: some libraries historically allowed a token to say "I'm unsigned, trust me." Always pass an explicit `algorithms=[...]` allow-list to `jwt.decode` (as above) — never let the library infer the algorithm from the token header.
- **Never accept the RS256-signed-as-HS256 substitution attack**: if a library is loosely configured, an attacker can take your *public* key (which is, by definition, public) and use it as an HMAC secret to forge an HS256 token that a naive verifier accepts. Pinning `algorithms=["RS256"]` explicitly closes this — the decode call will simply reject a token whose header says `HS256`.
- **Put `type: "access"` or `type: "refresh"` in the payload** (even though refresh tokens here aren't JWTs) as a general habit for any JWT-based token type — it stops a token issued for one purpose from being replayed somewhere it wasn't meant to work.
- **Keep the payload minimal.** No email, no PII, no permissions-you-might-add-later. Anyone holding the token (or reading a log line that leaked one) can decode and read a JWT's payload — it's signed, not encrypted.
- **Support key rotation from day one** via the `kid` (key ID) header:

```python
# core/config.py — hold a small map of active public keys by kid
JWT_PUBLIC_KEYS = {
    "2026-a": "-----BEGIN PUBLIC KEY-----...",
    "2026-b": "-----BEGIN PUBLIC KEY-----...",  # newly rotated in, old one still verifies
}

def get_verifying_key(token: str) -> str:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    key = JWT_PUBLIC_KEYS.get(kid)
    if key is None:
        raise InvalidTokenError("Unknown key id")
    return key
```

Without `kid`-based rotation, rotating your signing key means every currently-issued access token becomes invalid at once — fine for a hobby project, a bad time in production.

---

## 5. Where Tokens Live: Cookies vs Headers

For a browser-based frontend talking to your FastAPI backend, **httpOnly, Secure, SameSite cookies beat `localStorage` + `Authorization` header** for anything security-sensitive. `localStorage` is readable by any JS running on the page — one XSS bug anywhere in your frontend (including a compromised third-party script) means total token theft. An httpOnly cookie is invisible to JavaScript entirely.

```python
# features/auth/router.py
from fastapi import APIRouter, Response, Depends
from features.auth.schemas import LoginRequest, TokenResponse
from features.auth import service as auth_service

router = APIRouter()

REFRESH_COOKIE = "refresh_token"

@router.post("/login")
async def login(payload: LoginRequest, response: Response, db=Depends(get_db)):
    user = await auth_service.authenticate(db, payload.email, payload.password)
    access_token, refresh_token = await auth_service.issue_token_pair(db, user)

    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=True,            # never sent over plain HTTP
        samesite="strict",      # or "lax" if you need cross-site GET navigation to work
        max_age=14 * 24 * 3600,
        path="/api/v1/auth",    # scope the cookie to only the routes that need it
    )
    return {"access_token": access_token, "token_type": "bearer"}
```

The **access token** can go either in a short-lived cookie too, or be returned in the response body for the frontend to hold in memory (a JS variable, not `localStorage`) and attach as `Authorization: Bearer`. In-memory-only means it disappears on page refresh, which is a fine trade for a 10-minute-TTL token — the refresh flow re-mints it silently.

**CSRF becomes your problem the moment you use cookies for auth.** `SameSite=Strict` or `Lax` blocks most CSRF by default in modern browsers, but don't rely on that alone for state-changing requests — pair it with a CSRF token for defense in depth:

```python
# shared/middleware.py or a dependency
from fastapi import Request, HTTPException

async def verify_csrf(request: Request):
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    header_token = request.headers.get("X-CSRF-Token")
    cookie_token = request.cookies.get("csrf_token")
    if not header_token or header_token != cookie_token:
        raise HTTPException(403, "CSRF validation failed")
```

This is the double-submit cookie pattern: a non-httpOnly `csrf_token` cookie (readable by your own frontend JS) must be echoed back as a header on state-changing requests. An attacker's cross-origin form can make the browser *send* your cookies, but can't *read* the CSRF cookie's value to put it in a matching header — that's the whole defense.

---

## 6. Login Hardening: Rate Limiting & Lockout

Rate limit **per account and per IP separately** — an attacker distributing a credential-stuffing attack across many IPs defeats IP-only limits; a shared-NAT office defeats account-only limits if you're not careful about false positives, but the two together cover both cases.

```python
# features/auth/service.py
from shared.cache import redis_client

MAX_ATTEMPTS = 5
LOCKOUT_WINDOW = 15 * 60  # seconds

async def check_login_rate_limit(email: str, ip: str):
    email_key = f"login_attempts:email:{email}"
    ip_key = f"login_attempts:ip:{ip}"

    email_attempts = await redis_client.get(email_key)
    ip_attempts = await redis_client.get(ip_key)

    if email_attempts and int(email_attempts) >= MAX_ATTEMPTS:
        raise AccountTemporarilyLockedError()
    if ip_attempts and int(ip_attempts) >= MAX_ATTEMPTS * 4:  # looser cap for shared IPs
        raise TooManyRequestsError()

async def record_failed_login(email: str, ip: str):
    pipe = redis_client.pipeline()
    for key in (f"login_attempts:email:{email}", f"login_attempts:ip:{ip}"):
        pipe.incr(key)
        pipe.expire(key, LOCKOUT_WINDOW)
    await pipe.execute()

async def clear_login_attempts(email: str, ip: str):
    await redis_client.delete(f"login_attempts:email:{email}", f"login_attempts:ip:{ip}")
```

```python
# features/auth/router.py
@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response, db=Depends(get_db)):
    ip = request.client.host
    await auth_service.check_login_rate_limit(payload.email, ip)

    try:
        user = await auth_service.authenticate(db, payload.email, payload.password)
    except InvalidCredentialsError:
        await auth_service.record_failed_login(payload.email, ip)
        raise

    await auth_service.clear_login_attempts(payload.email, ip)
    ...
```

Also persist failed-attempt history to the DB (not just Redis) for anything you'll want in a security audit later — Redis TTLs are for *enforcement*, a durable `login_attempts` table or append-only log is for *forensics* after the fact.

Don't lock accounts *permanently* after N failures — that's a denial-of-service vector (anyone can lock any known email out just by failing logins). A time-boxed lockout (15–30 min) that clears automatically strikes the right balance.

---

## 7. Multi-Factor Authentication (TOTP)

```python
# features/auth/security.py
import pyotp

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def get_totp_uri(secret: str, email: str, issuer: str = "MyApp") -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)

def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)  # allows 1 step of clock drift, no more
```

Store the TOTP secret **encrypted at rest** (not just hashed — you need to read it back to verify), using something like `cryptography`'s Fernet with a key from your secrets manager, never the DB's own storage as the only protection layer:

```python
# features/auth/models.py
class MFADevice(Base):
    __tablename__ = "mfa_devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    encrypted_secret: Mapped[str]
    is_verified: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

The login flow becomes two steps once MFA is enrolled: password verifies identity *and* issues a short-lived, narrowly-scoped **pre-auth token** (a separate JWT `type: "mfa_pending"`, 5-minute TTL, unusable for anything but the MFA-verify endpoint), then the TOTP code exchanges that for the real access/refresh pair. Never issue full session tokens before MFA is satisfied.

**Always issue backup/recovery codes** at enrollment (8–10 single-use codes, hashed like passwords) — TOTP-only accounts with a lost device and no recovery path is a support nightmare that pressures people into insecure account-recovery workarounds.

---

## 8. Password Reset — Without Creating a Second Way In

A password reset flow that's easier to abuse than the login flow it protects is a common real-world break-in vector. Rules:

1. **Never reveal whether an email exists.** Always respond `"If that email exists, we've sent a reset link"` regardless of lookup result.
2. **Reset tokens are single-use, short-lived (15–30 min), random (not JWTs), and hashed in storage** — same pattern as refresh tokens.
3. **Invalidate all existing sessions on password change** — if someone reset the password, any session an attacker had open should die too.

```python
# features/auth/service.py
async def request_password_reset(db, email: str):
    user = await get_user_by_email(db, email)
    if user is None:
        return  # deliberately silent — see rule 1

    raw_token = secrets.token_urlsafe(32)
    await db.execute(insert(PasswordResetToken).values(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.utcnow() + timedelta(minutes=20),
    ))
    await db.commit()
    await send_password_reset_email(user.email, raw_token)  # background task

async def reset_password(db, raw_token: str, new_password: str):
    token_hash = hash_token(raw_token)
    record = await get_valid_reset_token(db, token_hash)
    if record is None:
        raise InvalidOrExpiredTokenError()

    user = await get_user_by_id(db, record.user_id)
    user.hashed_password = hash_password(new_password)
    record.used_at = datetime.utcnow()

    # Kill every existing session — this is the step people forget.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.utcnow())
    )
    await db.commit()
```

Rate-limit the reset-request endpoint itself (per email and per IP, same as login) — otherwise it becomes a free email-bombing tool against your users.

---

## 9. Authorization: `get_current_user` and RBAC

Authentication proves identity; authorization decides what that identity can do. Keep them as separate dependency layers.

```python
# features/auth/dependencies.py
from fastapi import Depends, HTTPException, status, Request
from features.auth.security import decode_access_token, get_verifying_key
from features.users.models import User

async def get_current_user(request: Request, db=Depends(get_db)) -> User:
    token = _extract_bearer_token(request)
    try:
        key = get_verifying_key(token)
        payload = jwt.decode(token, key, algorithms=["RS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")

    user = await db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user

def require_roles(*allowed_roles: str):
    async def checker(user: User = Depends(get_current_user)) -> User:
        if not set(user.roles) & set(allowed_roles):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return checker
```

```python
# features/orders/router.py
@router.delete("/{order_id}", dependencies=[Depends(require_roles("admin", "support"))])
async def delete_order(order_id: int): ...
```

For anything beyond simple role checks (resource ownership, org-scoped permissions), write the check as its own dependency per resource (like `get_owned_order` from the backend structure guide) rather than cramming logic into `require_roles` — ownership checks need the resource loaded anyway, so do the DB lookup once and get the authorization check for free.

**Re-validate roles from the DB, don't fully trust the JWT's `roles` claim, for high-stakes actions.** The JWT is a cache of the user's roles at issuance time (up to 10 minutes stale, in this design); fine for most routes, but for irreversible or sensitive actions (deleting an org, changing billing), re-fetch the user's current roles from the DB inside the route/service rather than trusting the token.

---

## 10. Security Headers

```python
# shared/middleware.py
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response
```

- **HSTS** only if you're 100% on HTTPS everywhere, including subdomains — misconfiguring this locks out anyone who briefly hits an HTTP endpoint.
- **CORS** deserves its own scrutiny in an auth context: `allow_origins=["*"]` combined with `allow_credentials=True` is invalid per spec and a real vulnerability if a misconfigured library lets it through anyway — always list explicit origins when credentials (cookies) are involved.

---

## 11. Transport & Infrastructure Baseline

Application-layer security assumes these are already true:

- **TLS everywhere**, HTTP redirected to HTTPS at the load balancer, TLS 1.2+ only.
- **Secrets (JWT signing keys, DB credentials, encryption keys) come from a secrets manager** (AWS Secrets Manager, Vault, etc.) or environment injected at deploy time — never committed, never in `.env` files that reach version control.
- **Database connections use least-privilege roles** — the app's DB user shouldn't have `DROP TABLE` rights in production.
- **Parameterized queries only.** SQLAlchemy's ORM and `select()`/`where()` constructs handle this for you — the danger is exclusively in raw SQL strings built with f-strings/`%`formatting. If you ever need raw SQL, use bound parameters (`text("... WHERE id = :id").bindparams(id=user_id)`), never string interpolation of user input.

---

## 12. Audit Logging for Security Events

Log security-relevant events to a durable, append-only store — separate from your general application logs, since these need longer retention and tighter access control.

```python
# features/auth/service.py
import logging
security_logger = logging.getLogger("security")

async def log_security_event(event_type: str, user_id: int | None, ip: str, metadata: dict | None = None):
    security_logger.info(
        "security_event",
        extra={
            "event_type": event_type,   # e.g. "login_success", "token_reuse_detected", "mfa_disabled"
            "user_id": user_id,
            "ip": ip,
            "metadata": metadata or {},
        },
    )
```

Log at minimum: login success/failure, password changes, MFA enroll/disable, refresh token reuse detection (§4.3 — this one should page someone, not just log), role changes, and account lockouts. **Never log passwords, tokens, or TOTP codes**, even at debug level — a debug log with a plaintext password in it defeats every hashing decision made above the moment that log file leaks.

---

## 13. Checklist

- [ ]  Argon2id for passwords, tuned to your hardware, rehash-on-login for parameter upgrades
- [ ]  Constant-time / uniform-timing responses on login regardless of which check failed
- [ ]  Short-lived JWT access tokens (RS256, explicit algorithm allow-list, `kid`based key rotation)
- [ ]  Opaque, hashed, single-use refresh tokens with rotation + reuse detection collapsing the whole family
- [ ]  httpOnly + Secure + SameSite cookies for refresh tokens; no sensitive tokens in `localStorage`
- [ ]  CSRF defense on cookie-authenticated state-changing routes
- [ ]  Per-account and per-IP rate limiting, time-boxed lockout (not permanent)
- [ ]  MFA with a genuine pre-auth intermediate state and hashed backup codes
- [ ]  Password reset tokens are random, hashed, short-lived, single-use, and revoke all sessions on success
- [ ]  Uniform "if that account exists" responses on both reset-request and (arguably) login
- [ ]  Authorization re-checked from source-of-truth for high-stakes actions, not just trusted from the JWT
- [ ]  Security headers + strict CORS with explicit origins when credentials are involved
- [ ]  TLS everywhere, secrets out of source control, least-privilege DB roles, parameterized queries only
- [ ]  Durable, separate audit log for security events; alerting on reuse-detection and lockouts specifically; zero secrets ever logged

None of these are exotic — the failure mode this guide is optimizing against is almost never "a novel cryptographic attack," it's one of these ordinary items being skipped under deadline pressure. A backend that does all twelve boringly and consistently is harder to break than one with a clever custom scheme that skips two of them.