const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require("expo/config-plugins");

/**
 * Bodfit only plays short in-app sounds. expo-audio 1.1.1 (SDK 54) has no
 * `enableBackgroundPlayback` flag; its library AndroidManifest hardcodes
 * FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PLAYBACK. `tools:node="remove"`
 * drops those, plus any other foreground-service permission, background
 * location, and the advertising ID, when Gradle merges library manifests.
 */
const BLOCKED_PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_CAMERA",
  "android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE",
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
  "android.permission.FOREGROUND_SERVICE_HEALTH",
  "android.permission.FOREGROUND_SERVICE_LOCATION",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PROCESSING",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
  "android.permission.FOREGROUND_SERVICE_PHONE_CALL",
  "android.permission.FOREGROUND_SERVICE_REMOTE_MESSAGING",
  "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
  "android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "com.google.android.gms.permission.AD_ID",
];

const BLOCKED = new Set(BLOCKED_PERMISSIONS);

function canonicalPermission(permission) {
  if (permission.includes(".")) {
    return permission;
  }
  return `android.permission.${permission}`;
}

function isBlockedPermission(permission) {
  const name = canonicalPermission(permission);
  return BLOCKED.has(name) || name.startsWith("android.permission.FOREGROUND_SERVICE");
}

function withStripAndroidPermissions(config) {
  if (config.android?.permissions) {
    config.android.permissions = config.android.permissions.filter(
      (permission) => !isBlockedPermission(permission),
    );
  }

  return withAndroidManifest(config, (modConfig) => {
    const manifest = AndroidConfig.Manifest.ensureToolsAvailable(modConfig.modResults);
    const declared = manifest.manifest["uses-permission"] ?? [];
    const discovered = declared
      .map((entry) => entry.$["android:name"])
      .filter((name) => isBlockedPermission(name));
    modConfig.modResults = AndroidConfig.Permissions.addBlockedPermissions(manifest, [
      ...new Set([...BLOCKED_PERMISSIONS, ...discovered]),
    ]);
    return modConfig;
  });
}

module.exports = createRunOncePlugin(
  withStripAndroidPermissions,
  "with-strip-android-permissions",
);
