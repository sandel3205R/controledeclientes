import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  const {
    needRefresh: [needRefreshSW, setNeedRefreshSW],
    offlineReady: [offlineReadySW, setOfflineReadySW],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('SW Registered:', swUrl);
      // Check for updates every 60 seconds
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    setNeedRefresh(needRefreshSW);
  }, [needRefreshSW]);

  useEffect(() => {
    setOfflineReady(offlineReadySW);
  }, [offlineReadySW]);

  const close = () => {
    setOfflineReadySW(false);
    setNeedRefreshSW(false);
  };

  const update = async () => {
    await updateServiceWorker(true);
  };

  return {
    needRefresh,
    offlineReady,
    update,
    close,
  };
}
