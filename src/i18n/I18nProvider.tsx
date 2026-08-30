import { createContext } from 'react';
import type { ReactNode } from 'react';
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import type { MessageKey } from '@/i18n/catalogs';
import {
  translate,
  type TranslationParameters,
  type UiLocale,
} from '@/i18n/i18n';

interface I18nContextValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: MessageKey, parameters?: TranslationParameters) => string;
}

interface I18nProviderProps {
  children: ReactNode;
  locale?: UiLocale;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, locale = 'fr' }: I18nProviderProps) {
  const [activeLocale, setActiveLocale] = useState(locale);

  useEffect(() => setActiveLocale(locale), [locale]);

  /**
   * `lang` est écrit pendant le commit, pas après (V4.5-188). Un effet passif
   * est planifié par l'ordonnanceur : entre le commit qui affiche la nouvelle
   * langue et cette tâche, le document en annonce une et en affiche une autre.
   * Les lecteurs d'écran et la césure lisent cet attribut ; il ne doit jamais
   * contredire ce qui est à l'écran, même un instant.
   *
   * Le titre, la description et le manifeste restent dans un effet passif :
   * eux ne sont lus par personne dans cet intervalle, et les écrire pendant le
   * commit retarderait l'affichage sans rien garantir de plus.
   */
  useLayoutEffect(() => {
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  useEffect(() => {
    const description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      document.head.appendChild(document.createElement('meta'));
    if (document.documentElement.dataset.documentMetadataOwner !== 'page') {
      document.title = translate(activeLocale, 'app.documentTitle');
      description.name = 'description';
      description.content = translate(activeLocale, 'app.description');
    }

    const manifest =
      document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ??
      document.head.appendChild(document.createElement('link'));
    manifest.rel = 'manifest';
    manifest.href =
      activeLocale === 'en'
        ? '/manifest-en.webmanifest'
        : '/manifest.webmanifest';
  }, [activeLocale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale: activeLocale,
      setLocale: setActiveLocale,
      t: (key, parameters) => translate(activeLocale, key, parameters),
    }),
    [activeLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  return (
    context ?? {
      locale: 'fr',
      setLocale: () => undefined,
      t: (key, parameters) => translate('fr', key, parameters),
    }
  );
}
