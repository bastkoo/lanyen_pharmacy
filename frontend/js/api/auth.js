import { APP_CONFIG } from "../config/app.js";

let csrfToken = "";
export class ApiError extends Error {
    constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}
async function request(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let response, data;
    try {
        response = await fetch(`${APP_CONFIG.API_BASE_URL}/auth/${path}`, {
            method: body === undefined ? "GET" : "POST", credentials: "include",
            cache: "no-store", signal: controller.signal,
            headers: body === undefined ? {} : { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        data = await response.json();
    } catch { throw new ApiError("CONNECTION_FAILED"); }
    finally { clearTimeout(timer); }
    if (typeof data.csrf_token === "string") csrfToken = data.csrf_token;
    if (!response.ok) throw new ApiError(data.code || "REQUEST_FAILED", response.status);
    return data;
}
export function getSession() { return request("me"); }
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
