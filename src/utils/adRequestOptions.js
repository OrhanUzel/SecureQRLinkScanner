import { Platform } from 'react-native';
import { getTrackingPermissionsAsync } from 'expo-tracking-transparency';

export async function getAdRequestOptions() {
  const options = { requestNonPersonalizedAdsOnly: true };

  if (Platform.OS === 'ios') {
    try {
      const { status } = await getTrackingPermissionsAsync();
      if (status === 'granted') {
        options.requestNonPersonalizedAdsOnly = false;
      }
    } catch {}
  } else {
    options.requestNonPersonalizedAdsOnly = false;
  }

  return options;
}

