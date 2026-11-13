"""Short-lived OTP state in Redis; all security counters are atomic."""
import hashlib
import hmac
import re
import secrets

from flask import current_app
from redis import Redis, RedisError


class AuthError(Exception):
    def __init__(self, code, status):
        self.code, self.status = code, status


def normalize_phone(value):
    phone = re.sub(r"[\s().-]", "", value.strip())
    if re.fullmatch(r"0[35789][0-9]{8}", phone):
        phone = "+84" + phone[1:]
    if not re.fullmatch(r"\+84[35789][0-9]{8}", phone):
        raise AuthError("INVALID_PHONE", 400)
    return phone


def digest(value):
    return hmac.new(current_app.config["SECRET_KEY"].encode(), value.encode(), hashlib.sha256).hexdigest()


def store():
    return current_app.extensions["otp_redis"]


def init_app(app):
    app.extensions["otp_redis"] = Redis.from_url(
        app.config["REDIS_URL"], decode_responses=True,
        socket_connect_timeout=2, socket_timeout=2)


def evaluate(script, keys, args):
    try:
        return store().eval(script, len(keys), *keys, *args)
    except RedisError:
        raise AuthError("AUTH_UNAVAILABLE", 503) from None


LIMIT = """
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return n <= tonumber(ARGV[1]) and 1 or 0
"""


def rate_limit(kind, identity, maximum, seconds=3600):
    if not evaluate(LIMIT, ["lanyen:limit:" + kind + ":" + digest(identity)], [maximum, seconds]):
        raise AuthError("RATE_LIMITED", 429)


ISSUE = """
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[2], '1', 'EX', ARGV[3])
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'hash', ARGV[1], 'attempts', 0)
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
"""
VERIFY = """
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
if redis.call('HGET', KEYS[1], 'hash') ~= ARGV[1] then
  local n = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
  if n >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]); return -2 end
  return 0
end
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
return 1
"""
CONSUME = """
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value
"""


def request_otp(phone, ip):
    config = current_app.config
    if config["APP_ENV"] != "development" or not config["OTP_DEV_ENABLED"]:
        raise AuthError("AUTH_UNAVAILABLE", 503)
    rate_limit("request-ip", ip, 30)
    rate_limit("request-phone", phone, 5)
    code = f"{secrets.randbelow(1000000):06d}"
    key = "lanyen:otp:" + digest(phone)
    if not evaluate(ISSUE, [key, key + ":cooldown"],
                    [digest(phone + ":" + code), config["OTP_TTL_SECONDS"], 60]):
        raise AuthError("RATE_LIMITED", 429)
    # Explicitly opted-in local development only. Never return the code via HTTP.
    print(f"[DEV OTP] {phone[-4:]}: {code}", flush=True)
    return {"code": "OTP_SENT", "expires_in": config["OTP_TTL_SECONDS"], "retry_after": 60}


def verify_otp(phone, code, ip, binding):
    rate_limit("verify-ip", ip, 60, 300)
    rate_limit("verify-phone", phone, 20, 300)
    proof = secrets.token_urlsafe(32)
    result = evaluate(VERIFY,
                      ["lanyen:otp:" + digest(phone), "lanyen:proof:" + digest(proof)],
                      [digest(phone + ":" + code), 5, binding + ":" + phone, 300])
    if result != 1:
        raise AuthError({-1: "OTP_EXPIRED", -2: "OTP_ATTEMPTS_EXCEEDED", 0: "OTP_INVALID"}[result], 401)
    return proof


def consume_proof(proof, binding):
    value = evaluate(CONSUME, ["lanyen:proof:" + digest(proof)], [])
    if not value or not value.startswith(binding + ":"):
        raise AuthError("VERIFICATION_EXPIRED", 401)
    return value[len(binding) + 1:]
