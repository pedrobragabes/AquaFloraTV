const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

const mainActivityName = '.MainActivity';

function hasCategory(intentFilter, categoryName) {
  const rawCategories = intentFilter.category ?? [];
  const categories = Array.isArray(rawCategories) ? rawCategories : [rawCategories];
  return categories.some((category) => category.$?.['android:name'] === categoryName);
}

function createCategory(categoryName) {
  return {
    $: {
      'android:name': categoryName,
    },
  };
}

function createAction(actionName) {
  return {
    $: {
      'android:name': actionName,
    },
  };
}

function ensureIntentFilter(activity, requiredCategories) {
  const intentFilters = activity['intent-filter'] ?? [];
  const existing = intentFilters.find((filter) =>
    requiredCategories.every((categoryName) => hasCategory(filter, categoryName)),
  );

  if (existing) {
    return;
  }

  intentFilters.push({
    action: [createAction('android.intent.action.MAIN')],
    category: requiredCategories.map(createCategory),
  });
  activity['intent-filter'] = intentFilters;
}

module.exports = function withAndroidTvKiosk(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const screenOrientation =
      config.orientation === 'landscape'
        ? 'landscape'
        : config.orientation === 'portrait'
          ? 'portrait'
          : null;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      manifestConfig.modResults,
    );
    const activities = mainApplication.activity ?? [];
    const mainActivity = activities.find(
      (activity) => activity.$?.['android:name'] === mainActivityName,
    );

    if (!mainActivity) {
      return manifestConfig;
    }

    mainActivity.$['android:exported'] = 'true';
    mainApplication.$['android:banner'] = '@drawable/aquaflora_tv_banner';
    if (screenOrientation) {
      mainActivity.$['android:screenOrientation'] = screenOrientation;
    } else {
      delete mainActivity.$['android:screenOrientation'];
    }

    ensureIntentFilter(mainActivity, [
      'android.intent.category.HOME',
      'android.intent.category.DEFAULT',
    ]);

    return manifestConfig;
  });
};
