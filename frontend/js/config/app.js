const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
const apiOrigin = isLocalhost
    ? `http://${location.hostname}:5000`
    : 'https://lanyenpharmacy-api.onrender.com';

export const APP_CONFIG = {
    APP_NAME: 'Lan Yến Pharmacy',
    // Includes /api once; request modules append only their resource paths.
    API_BASE_URL: `${apiOrigin}/api`,
    DEFAULT_LANGUAGE: 'vi',
    DEFAULT_PAGE_SIZE: 10
};
