import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import i18n, { deviceLanguage, type AppLanguage } from './i18n';
import { loadLanguage, saveLanguage } from './persist';

type Value = {
  language: AppLanguage;
  setLanguage: (lng: AppLanguage) => void;
};

const LanguageContext = createContext<Value>({
  language: 'en',
  setLanguage: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<AppLanguage>(deviceLanguage);

  useEffect(() => {
    let alive = true;
    void loadLanguage().then((saved) => {
      if (!alive || !saved) return;
      void i18n.changeLanguage(saved);
      setLang(saved);
    });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<Value>(
    () => ({
      language,
      setLanguage: (lng) => {
        setLang(lng);
        saveLanguage(lng);
        void i18n.changeLanguage(lng);
      },
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
