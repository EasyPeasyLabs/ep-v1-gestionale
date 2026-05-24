export interface FocusConfig {
    enabled: boolean;
    days: number[];
    time: string;
}

export interface UserPreferences {
    focusConfig?: FocusConfig;
    lastFocusDate?: string;
    dismissedNotificationIds?: string[]; // IDs of notifications marked as read/done
}
