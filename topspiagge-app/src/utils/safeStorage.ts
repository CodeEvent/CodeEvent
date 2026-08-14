import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage's web backend can throw synchronously (not just reject) when storage is
// blocked or partitioned -- e.g. a sandboxed third-party iframe under strict tracking
// prevention. A bare `.catch()` on the call only handles promise rejections, so a
// synchronous throw would otherwise escape as an uncaught error inside a render effect
// and take down the whole screen. These wrappers make storage failures inert: the app
// just keeps running in-memory for that session instead of persisting/restoring.
export async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // storage unavailable -- ignore, nothing to persist to
  }
}

export async function safeRemoveItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // storage unavailable -- ignore
  }
}
