'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  type DevSettings, DEV_SETTINGS_DEFAULTS, loadDevSettings, saveDevSettings,
  type DesignSettings, DESIGN_SETTINGS_DEFAULTS, loadDesignSettings, saveDesignSettings, applyDesignSettings,
} from '@/lib/dev-settings';

type ContextValue = {
  settings: DevSettings;
  update: (patch: Partial<DevSettings>) => void;
  design: DesignSettings;
  updateDesign: (patch: Partial<DesignSettings>) => void;
};

const DevSettingsContext = createContext<ContextValue>({
  settings: DEV_SETTINGS_DEFAULTS,
  update: () => {},
  design: DESIGN_SETTINGS_DEFAULTS,
  updateDesign: () => {},
});

export function DevSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DevSettings>(DEV_SETTINGS_DEFAULTS);
  const [design, setDesign] = useState<DesignSettings>(DESIGN_SETTINGS_DEFAULTS);

  useEffect(() => {
    const loadedSettings = loadDevSettings();
    const loadedDesign = loadDesignSettings();
    setSettings(loadedSettings);
    setDesign(loadedDesign);
    applyDesignSettings(loadedDesign);
  }, []);

  function update(patch: Partial<DevSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveDevSettings(next);
      return next;
    });
  }

  function updateDesign(patch: Partial<DesignSettings>) {
    setDesign((prev) => {
      const next = { ...prev, ...patch };
      saveDesignSettings(next);
      applyDesignSettings(next);
      return next;
    });
  }

  return (
    <DevSettingsContext.Provider value={{ settings, update, design, updateDesign }}>
      {children}
    </DevSettingsContext.Provider>
  );
}

export function useDevSettings() {
  return useContext(DevSettingsContext);
}
