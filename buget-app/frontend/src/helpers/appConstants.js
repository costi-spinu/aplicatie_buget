export const APP_NAME = 'Budget App';

const viteApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL = viteApiBaseUrl || `${window.location.origin}/api/`;
export const TOKEN_URL = `${API_BASE_URL.replace(/\/$/, '')}/token/`;
export const PASSWORD_RESET_URL = `${window.location.origin}/password-reset/`;
