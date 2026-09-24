import { Alert, Platform } from 'react-native';

/** Yes/no confirmation that works on native (Alert) and web (window.confirm). */
export function confirmAction(message: string, confirmLabel = 'Delete', destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert(message, undefined, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export const confirmDelete = (message: string) => confirmAction(message, 'Delete', true);
