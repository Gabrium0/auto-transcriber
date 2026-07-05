import { useEffect } from 'react';

/**
 * Keeps the screen awake while the app is open on supported mobile browsers.
 * Browsers may revoke the lock when the tab is hidden, so it is reacquired when visible.
 */
export const useWakeLock = (): void => {
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      const wakeLockApi = navigator.wakeLock;

      if (
        !wakeLockApi
        || document.visibilityState !== 'visible'
        || (wakeLock && !wakeLock.released)
      ) {
        return;
      }

      try {
        wakeLock = await wakeLockApi.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } catch (error) {
        console.warn('Screen wake lock request failed:', error);
      }
    };

    const releaseWakeLock = async () => {
      if (!wakeLock || wakeLock.released) {
        return;
      }

      try {
        await wakeLock.release();
      } catch (error) {
        console.warn('Screen wake lock release failed:', error);
      } finally {
        wakeLock = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      } else {
        void releaseWakeLock();
      }
    };

    const handleUserActivation = () => {
      void requestWakeLock();
    };

    void requestWakeLock();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pointerdown', handleUserActivation, { passive: true });
    window.addEventListener('keydown', handleUserActivation);
    window.addEventListener('touchstart', handleUserActivation, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointerdown', handleUserActivation);
      window.removeEventListener('keydown', handleUserActivation);
      window.removeEventListener('touchstart', handleUserActivation);

      void releaseWakeLock();
    };
  }, []);
};

export default useWakeLock;
