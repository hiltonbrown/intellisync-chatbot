export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'
  | 'pink'
  | 'gray';

export interface ThemePreferences {
  mode: ThemeMode;
  accentColor: AccentColor;
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
}

export interface ChatPreferences {
  autoSave: boolean;
  messagePreview: boolean;
  typingIndicators: boolean;
  soundNotifications: boolean;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  browserNotifications: boolean;
  mentionNotifications: boolean;
  systemUpdates: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
}

export interface PrivacyPreferences {
  analytics: boolean;
  crashReporting: boolean;
  dataSharing: boolean;
  chatVisibility: 'private' | 'public';
}

export interface AccessibilityPreferences {
  highContrast: boolean;
  colorBlindness: boolean;
  fontSize: 'small' | 'medium' | 'large';
  lineSpacing: 'normal' | 'relaxed' | 'loose';
  textToSpeech: boolean;
}

export interface AdvancedPreferences {
  debugMode: boolean;
  performanceMode: 'power-saver' | 'balanced' | 'high-performance';
  cachingEnabled: boolean;
  apiAccess: boolean;
  experimentalFeatures: boolean;
}

export interface UserPreferences {
  theme: ThemePreferences;
  chat: ChatPreferences;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  accessibility: AccessibilityPreferences;
  advanced: AdvancedPreferences;
  lastUpdated: Date;
}

const BASE_DEFAULT_PREFERENCES = {
  theme: {
    mode: 'system' as ThemeMode,
    accentColor: 'blue' as AccentColor,
    fontSize: 'medium' as const,
    reducedMotion: false,
  },
  chat: {
    autoSave: true,
    messagePreview: true,
    typingIndicators: true,
    soundNotifications: false,
  },
  notifications: {
    emailNotifications: true,
    browserNotifications: true,
    mentionNotifications: true,
    systemUpdates: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  },
  privacy: {
    analytics: true,
    crashReporting: true,
    dataSharing: false,
    chatVisibility: 'private' as const,
  },
  accessibility: {
    highContrast: false,
    colorBlindness: false,
    fontSize: 'medium' as const,
    lineSpacing: 'normal' as const,
    textToSpeech: false,
  },
  advanced: {
    debugMode: false,
    performanceMode: 'balanced' as const,
    cachingEnabled: true,
    apiAccess: false,
    experimentalFeatures: false,
  },
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  ...BASE_DEFAULT_PREFERENCES,
  lastUpdated: new Date(),
};

export function createDefaultPreferences(): UserPreferences {
  return {
    theme: { ...BASE_DEFAULT_PREFERENCES.theme },
    chat: { ...BASE_DEFAULT_PREFERENCES.chat },
    notifications: {
      ...BASE_DEFAULT_PREFERENCES.notifications,
      quietHours: { ...BASE_DEFAULT_PREFERENCES.notifications.quietHours },
    },
    privacy: { ...BASE_DEFAULT_PREFERENCES.privacy },
    accessibility: { ...BASE_DEFAULT_PREFERENCES.accessibility },
    advanced: { ...BASE_DEFAULT_PREFERENCES.advanced },
    lastUpdated: new Date(),
  };
}

export type SerializedUserPreferences = Omit<UserPreferences, 'lastUpdated'> & {
  lastUpdated: string;
};

export function serializeUserPreferences(
  preferences: UserPreferences,
): SerializedUserPreferences {
  return {
    ...preferences,
    lastUpdated: preferences.lastUpdated.toISOString(),
  };
}

export function deserializeUserPreferences(
  preferences: SerializedUserPreferences,
): UserPreferences {
  return {
    ...preferences,
    lastUpdated: new Date(preferences.lastUpdated),
  };
}

export function isSerializedUserPreferences(
  value: unknown,
): value is SerializedUserPreferences {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  const hasObject = (key: string) =>
    Object.prototype.hasOwnProperty.call(record, key) &&
    typeof record[key] === 'object' &&
    record[key] !== null;

  return (
    typeof record.lastUpdated === 'string' &&
    hasObject('theme') &&
    hasObject('chat') &&
    hasObject('notifications') &&
    hasObject('privacy') &&
    hasObject('accessibility') &&
    hasObject('advanced')
  );
}
