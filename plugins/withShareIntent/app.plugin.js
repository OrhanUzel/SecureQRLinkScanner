const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * This plugin ensures that the share intent filter is properly added to MainActivity
 * so the app appears in Android's share menu
 */
module.exports = function withShareIntent(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (!manifest.application) {
      return config;
    }

    const application = manifest.application[0];
    if (!application.activity) {
      return config;
    }

    // Find MainActivity - Expo typically uses .MainActivity
    const mainActivity = application.activity.find(
      (activity) => {
        const name = activity.$['android:name'];
        return name === '.MainActivity' || 
               name?.endsWith('.MainActivity') ||
               name === 'MainActivity' ||
               name === 'com.orhanuzel.secureqrlinkscanner.MainActivity';
      }
    );

    if (!mainActivity) {
      console.warn('MainActivity not found, share intent filter not added');
      return config;
    }

    // Initialize intent-filter array if it doesn't exist
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }

    const hasShareIntentForMime = (mimeType) => {
      return mainActivity['intent-filter'].some((filter) => {
        const action = filter.action?.[0]?.['$']?.['android:name'];
        const dataMime = filter['data']?.[0]?.['$']?.['android:mimeType'];
        return action === 'android.intent.action.SEND' && dataMime === mimeType;
      });
    };

    const ensureCategory = (filter) => {
      if (!filter.category) {
        filter.category = [];
      }
      const hasDefault = filter.category.some(
        (category) => category?.$?.['android:name'] === 'android.intent.category.DEFAULT'
      );
      if (!hasDefault) {
        filter.category.push({
          $: {
            'android:name': 'android.intent.category.DEFAULT',
          },
        });
      }
    };

    const addShareIntent = (actionName, mimeType) => {
      mainActivity['intent-filter'].push({
        action: [
          {
            $: {
              'android:name': actionName,
            },
          },
        ],
        category: [
          {
            $: {
              'android:name': 'android.intent.category.DEFAULT',
            },
          },
        ],
        data: [
          {
            $: {
              'android:mimeType': mimeType,
            },
          },
        ],
      });
    };

    const ensureShareIntent = (actionName, mimeType) => {
      const hasIntent = mainActivity['intent-filter'].some((filter) => {
        const action = filter.action?.[0]?.['$']?.['android:name'];
        const hasMime = filter.data?.some(
          (dataNode) => dataNode?.$?.['android:mimeType'] === mimeType
        );
        if (action === actionName && hasMime) {
          ensureCategory(filter);
          return true;
        }
        return false;
      });

      if (!hasIntent) {
        addShareIntent(actionName, mimeType);
      }
    };

    const SHARE_COMBOS = [
      { action: 'android.intent.action.SEND', mime: 'text/plain' },
      { action: 'android.intent.action.SEND', mime: 'image/*' },
      { action: 'android.intent.action.SEND_MULTIPLE', mime: 'image/*' },
    ];

    SHARE_COMBOS.forEach(({ action, mime }) => {
      ensureShareIntent(action, mime);
    });

    return config;
  });
};

