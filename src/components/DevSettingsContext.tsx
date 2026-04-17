'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { type DevSettings, DEV_SETTINGS_DEFAULTS, loadDevSettings, saveDevSettings } from '@/lib/dev-settings';

type DevSettingsContextValue = {
  settings: DevSettings;
  update: (patch: Partial<DevSettings>) => void;
};

const DevSettingsContext = createContext<DevSettingsContextValue>({
  settings: DEV_SETTINGS_DEFAULTS,
  update: () => {},
});

export function DevSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DevSettings>(DEV_SETTINGS_DEFAULTS);

  useEffect(() => {
    setSettings(loadDevSettings());
  }, []);

  function update(patch: Partial<DevSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveDevSettings(next);
      return next;
    });
  }

  return (
    <DevSettingsContext.Provider value={{ settings, update }}>
      {children}
    </DevSettingsContext.Provider>
  );
}

export function useDevSettings() {
  return useContext(DevSettingsContext);
}
