/** Admin: default section is Manage Elections (`elections`). */
export const ADMIN_DASHBOARD_ACTIVE_SECTION_KEY = "admin-dashboard-active-section";
export const ADMIN_DASHBOARD_ACTIVE_REPORT_KEY = "admin-dashboard-active-report";
/** Admin: persisted publish date/time form (`loadElectionConfig` defaults when absent). */
export const ADMIN_ELECTION_CONFIG_KEY = "admin-election-config";

/** Auditor: default view is General Results (`results`); election id is chosen on load when unset. */
export const AUDITOR_DASHBOARD_ACTIVE_VIEW_KEY = "auditor-dashboard-active-view";
export const AUDITOR_DASHBOARD_ELECTION_ID_KEY = "auditor-dashboard-election-id";

export function clearDashboardTabPreferences() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ADMIN_DASHBOARD_ACTIVE_SECTION_KEY);
    window.localStorage.removeItem(ADMIN_DASHBOARD_ACTIVE_REPORT_KEY);
    window.localStorage.removeItem(ADMIN_ELECTION_CONFIG_KEY);
    window.localStorage.removeItem(AUDITOR_DASHBOARD_ACTIVE_VIEW_KEY);
    window.localStorage.removeItem(AUDITOR_DASHBOARD_ELECTION_ID_KEY);
}
