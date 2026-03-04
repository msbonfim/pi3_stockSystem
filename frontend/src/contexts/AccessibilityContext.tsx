import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type FontSize = "normal" | "large" | "xlarge" | "xxlarge";

interface AccessibilitySettings {
  fontSize: FontSize;
  highContrast: boolean;
  largeButtons: boolean;
  simplifiedView: boolean;
  keyboardNavigation: boolean;
  highlightLinks: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  setFontSize: (size: FontSize) => void;
  setHighContrast: (enabled: boolean) => void;
  setLargeButtons: (enabled: boolean) => void;
  setSimplifiedView: (enabled: boolean) => void;
  setKeyboardNavigation: (enabled: boolean) => void;
  setHighlightLinks: (enabled: boolean) => void;
  reset: () => void;
}

const defaultSettings: AccessibilitySettings = {
  fontSize: "normal",
  highContrast: false,
  largeButtons: false,
  simplifiedView: false,
  keyboardNavigation: true, // Geralmente sempre ativo por padrão
  highlightLinks: false,
};

const AccessibilityContext = createContext<
  AccessibilityContextType | undefined
>(undefined);

export const AccessibilityProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const savedSettings = localStorage.getItem("accessibility-settings");
      return savedSettings
        ? { ...defaultSettings, ...JSON.parse(savedSettings) }
        : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem("accessibility-settings", JSON.stringify(settings));

    // Aplica classes/atributos ao body
    const body = document.body;
    body.dataset.fontSize = settings.fontSize;
    body.dataset.highContrast = String(settings.highContrast);
    body.dataset.largeButtons = String(settings.largeButtons);
    body.dataset.simplifiedView = String(settings.simplifiedView);
    body.dataset.highlightLinks = String(settings.highlightLinks);

    // Limpa classes antigas e aplica a nova para fonte
    body.classList.remove(
      "font-normal",
      "font-large",
      "font-xlarge",
      "font-xxlarge"
    );
    body.classList.add(`font-${settings.fontSize}`);

    // Aplica classes para alto contraste
    if (settings.highContrast) {
      body.classList.add("high-contrast");
    } else {
      body.classList.remove("high-contrast");
    }

    // Aplica classes para botões grandes
    if (settings.largeButtons) {
      body.classList.add("large-buttons");
    } else {
      body.classList.remove("large-buttons");
    }

    // Aplica classes para visual simplificado
    if (settings.simplifiedView) {
      body.classList.add("simplified-view");
    } else {
      body.classList.remove("simplified-view");
    }

    // Aplica classes para destacar links
    if (settings.highlightLinks) {
      body.classList.add("highlight-links");
    } else {
      body.classList.remove("highlight-links");
    }
  }, [settings]);

  const setFontSize = (size: FontSize) =>
    setSettings((s) => ({ ...s, fontSize: size }));
  const setHighContrast = (enabled: boolean) =>
    setSettings((s) => ({ ...s, highContrast: enabled }));
  const setLargeButtons = (enabled: boolean) =>
    setSettings((s) => ({ ...s, largeButtons: enabled }));
  const setSimplifiedView = (enabled: boolean) =>
    setSettings((s) => ({ ...s, simplifiedView: enabled }));
  const setKeyboardNavigation = (enabled: boolean) =>
    setSettings((s) => ({ ...s, keyboardNavigation: enabled }));
  const setHighlightLinks = (enabled: boolean) =>
    setSettings((s) => ({ ...s, highlightLinks: enabled }));

  const reset = () => setSettings(defaultSettings);

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        setFontSize,
        setHighContrast,
        setLargeButtons,
        setSimplifiedView,
        setKeyboardNavigation,
        setHighlightLinks,
        reset,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error(
      "useAccessibility must be used within an AccessibilityProvider"
    );
  }
  return context;
};
