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

export interface UserPreferences {
  theme: ThemePreferences;
  chat: ChatPreferences;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  accessibility: AccessibilityPreferences;
  lastUpdated: Date;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: {
    mode: 'system',
    accentColor: 'blue',
    fontSize: 'medium',
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
    chatVisibility: 'private',
  },
  accessibility: {
    highContrast: false,
    colorBlindness: false,
    fontSize: 'medium',
    lineSpacing: 'normal',
    textToSpeech: false,
  },
  lastUpdated: new Date(),
};
