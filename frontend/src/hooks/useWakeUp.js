import { useState, useEffect, useCallback } from 'react';
import { pingBackend, wakeUpBackend } from '../utils/api';

/**
 * Hook to manage Render backend wake-up state.
 * Automatically pings on mount and provides manual retry.
 */
export function useWakeUp() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'waking' | 'awake' | 'failed'
  const [attempt, setAttempt] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(12);

  const check = useCallback(async () => {
    setStatus('checking');

    // Quick initial ping
    const immediate = await pingBackend();
    if (immediate) {
      setStatus('awake');
      return;
    }

    // Backend is sleeping — start wake-up sequence
    setStatus('waking');

    const awake = await wakeUpBackend((a, max) => {
      setAttempt(a);
      setMaxAttempts(max);
    });

    setStatus(awake ? 'awake' : 'failed');
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { status, attempt, maxAttempts, retry: check };
}
