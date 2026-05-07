import type { PlatformName, Settings } from './types';

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  voiceSamples: '',
  enabledPlatforms: { x: true, bluesky: true, reddit: true },
  highlightThreshold: 0.6,
  alphamoltPagesOverride: null,
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    enabledPlatforms: {
      ...DEFAULT_SETTINGS.enabledPlatforms,
      ...(value?.enabledPlatforms ?? {}),
    },
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export function onSettingsChanged(
  callback: (settings: Settings) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !(SETTINGS_KEY in changes)) return;
    callback({
      ...DEFAULT_SETTINGS,
      ...(changes[SETTINGS_KEY]?.newValue as Partial<Settings>),
    });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function isPlatformEnabled(
  settings: Settings,
  platform: PlatformName,
): boolean {
  return settings.enabledPlatforms[platform] !== false;
}
