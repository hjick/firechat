import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { FireChat } from '../core/FireChat';
import type { FireChatConfig } from '../types/config';

interface FireChatContextValue {
  firechat: FireChat;
  ready: boolean;
}

const FireChatContext = createContext<FireChatContextValue | null>(null);

interface FireChatProviderProps {
  config: FireChatConfig;
  children: ReactNode;
}

export function FireChatProvider({ config, children }: FireChatProviderProps) {
  const [ready, setReady] = useState(false);

  const firechat = useMemo(() => FireChat.init(config), []);

  useEffect(() => {
    let mounted = true;

    firechat.waitForAuth().then(() => {
      if (mounted) {
        if (firechat.options.enablePresence) {
          firechat.presence.init();
        }
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      firechat.destroy();
    };
  }, [firechat]);

  const value = useMemo(() => ({ firechat, ready }), [firechat, ready]);

  return (
    <FireChatContext.Provider value={value}>
      {children}
    </FireChatContext.Provider>
  );
}

export function useFireChatContext(): FireChatContextValue {
  const context = useContext(FireChatContext);
  if (!context) {
    throw new Error('useFireChat must be used within a <FireChatProvider>');
  }
  return context;
}
