import { clearDashboardTabPreferences } from "./dashboardPreferences";

export const clearAuthStorage = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
    clearDashboardTabPreferences();
};

export const logoutUser = (navigate, redirectTo) => {
    clearAuthStorage();
    navigate(redirectTo);
}