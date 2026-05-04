import axios from 'axios';
import { clearDashboardTabPreferences } from './utils/dashboardPreferences';

const api = axios.create({
    baseURL: "http://127.0.0.1:8000",
});

const REFRESH_URL = "/api/token/refresh/";
const LOGIN_URL = "/api/login/";

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (error, newToken) => {
    pendingQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(newToken);
    });
    pendingQueue = [];
};

export const AUTH_LOGOUT_EVENT = "auth:logout";

const clearAuthAndRedirect = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
    clearDashboardTabPreferences();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
    }
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (!error.response || !original) {
            return Promise.reject(error);
        }

        const status = error.response.status;
        const url = original.url || "";

        const isAuthEndpoint = url.includes(REFRESH_URL) || url.includes(LOGIN_URL);
        if (status !== 401 || original._retry || isAuthEndpoint) {
            return Promise.reject(error);
        }

        const refreshToken = localStorage.getItem("refresh");
        if (!refreshToken) {
            clearAuthAndRedirect();
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                pendingQueue.push({ resolve, reject });
            })
                .then((newToken) => {
                    original.headers.Authorization = `Bearer ${newToken}`;
                    original._retry = true;
                    return api(original);
                })
                .catch((err) => Promise.reject(err));
        }

        original._retry = true;
        isRefreshing = true;

        try {
            const res = await axios.post(
                `${api.defaults.baseURL}${REFRESH_URL}`,
                { refresh: refreshToken }
            );

            const newAccess = res.data.access;
            localStorage.setItem("token", newAccess);
            if (res.data.refresh) {
                localStorage.setItem("refresh", res.data.refresh);
            }

            flushQueue(null, newAccess);

            original.headers.Authorization = `Bearer ${newAccess}`;
            return api(original);
        } catch (refreshErr) {
            flushQueue(refreshErr, null);
            clearAuthAndRedirect();
            return Promise.reject(refreshErr);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
