import { APP_CONFIG } from '../config/app.js';
import { ApiError, withAuthenticatedSession } from './auth.js';
import { withSessionRequest } from '../utils/session-requests.js';
import { parseJsonIntegers } from '../utils/json-integers.js';

async function request(path, method = 'GET', body, token) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), body instanceof FormData ? 45000 : 25000);
    try {
        const multipart = body instanceof FormData;
        const response = await fetch(`${APP_CONFIG.API_BASE_URL}/chat${path}`, { method, credentials: 'include', cache: 'no-store', signal: controller.signal,
            headers: method === 'GET' ? {} : { ...(!multipart ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-Token': token },
            ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }) });
        const data = parseJsonIntegers(await response.text());
        if (!response.ok) throw new ApiError(data.code || 'REQUEST_FAILED', response.status);
        return data;
    } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('CONNECTION_FAILED'); }
    finally { clearTimeout(timer); }
}
export const readChat = path => withSessionRequest(() => request(path));
export const quoteChatOffer = id => readChat(`/offers/${encodeURIComponent(id)}/quote`);
export const checkoutChatOffer = (id, values, owner) => writeChat(`/offers/${encodeURIComponent(id)}/checkout`, values, owner);
export const writeChat = (path, body, owner) => withAuthenticatedSession(owner, token => request(path, 'POST', body, token));
export const uploadChatImage = (path, file, owner) => { const form = new FormData(); form.append('image', file); return writeChat(path, form, owner); };
