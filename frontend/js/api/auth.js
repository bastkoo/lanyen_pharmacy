import { APP_CONFIG } from "../config/app.js";
import { parseJsonIntegers } from '../utils/json-integers.js';
import { withSessionRequest } from '../utils/session-requests.js';

let csrfToken = "";
export class ApiError extends Error {
    constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}
function request(path, body) {
    return withSessionRequest(() => send(path, body));
}
async function send(path, body, method = body === undefined ? 'GET' : 'POST') {
    const controller = new AbortController();
    const multipart = body instanceof FormData;
    const timer = setTimeout(() => controller.abort(), multipart ? 45000 : 20000);
    let response, data;
    try {
        response = await fetch(`${APP_CONFIG.API_BASE_URL}/auth/${path}`, {
            method, credentials: "include",
            cache: "no-store", signal: controller.signal,
            headers: body === undefined ? {} : { ...(!multipart ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-Token': csrfToken },
            ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) })
        });
        data = parseJsonIntegers(await response.text());
    } catch { throw new ApiError("CONNECTION_FAILED"); }
    finally { clearTimeout(timer); }
    if (typeof data.csrf_token === "string") csrfToken = data.csrf_token;
    if (!response.ok) throw new ApiError(data.code || "REQUEST_FAILED", response.status);
    return data;
}
export function getSession() { return request("me"); }
function requireSameOwner(data, expectedUserId) {
    if (expectedUserId !== undefined && String(data.user?.MaNguoiDung) !== String(expectedUserId)) throw new ApiError('SESSION_CHANGED');
}
export function updateProfile(values, expectedUserId) {
    return withSessionRequest(async () => {
        requireSameOwner(await send('me'), expectedUserId);
        return send('me', { HoTen: values.HoTen, AnhDaiDien: values.AnhDaiDien }, 'PUT');
    });
}
export function uploadAvatar(file, expectedUserId) {
    return withSessionRequest(async () => {
        requireSameOwner(await send('me'), expectedUserId);
        const body = new FormData(); body.append('image', file);
        return send('me/avatar', body);
    });
}
export async function getCsrfToken() {
    await getSession();
    if (!csrfToken) throw new ApiError('CSRF_FAILED', 403);
    return csrfToken;
}
async function ensureCsrf() {
    if (!csrfToken) {
        try { await getSession(); }
        catch (error) { if (error.code !== "UNAUTHENTICATED") throw error; }
    }
}
export async function requestOtp(phone) {
    await ensureCsrf();
    return request('otp/request', { phone });
}
export async function verifyOtp(phone, otp) {
    await ensureCsrf();
    return request('otp/verify', { phone, otp });
}
export async function registerProfile(name) {
    await ensureCsrf();
    return request('register', { ho_ten: name });
}
export async function logoutSession() {
    try { await getSession(); }
    catch (error) { if (!["UNAUTHENTICATED", "ACCOUNT_LOCKED"].includes(error.code)) throw error; }
    const data = await request("logout", {});
    csrfToken = "";
    return data;
}
