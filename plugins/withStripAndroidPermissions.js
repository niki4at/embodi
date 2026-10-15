const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require("expo/config-plugins");

/**
 * Bodfit plays short in-app sounds and reads location only while the app is open.
 * expo-audio 1.1.1 hardcodes playback foreground-service permissions and
 * RECORD_AUDIO in its library manifest. `tools:node="remove"` drops those at
 * the Gradle merge. SYSTEM_ALERT_WINDOW stays in the debug manifest for the
 * dev client and is removed from release only.
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
  "android.permission.RECORD_AUDIO",
  "com.google.android.gms.permission.AD_ID",
];

const RELEASE_ONLY_PERMISSIONS = ["android.permission.SYSTEM_ALERT_WINDOW"];

const SERVICES_TO_REMOVE = [
  "expo.modules.audio.service.AudioRecordingService",
  "expo.modules.location.services.LocationTaskService",
];

const BLOCKED = new Set(BLOCKED_PERMISSIONS);

const RELEASE_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"/>
</manifest>
`;

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

function dropMainPermissions(manifest, names) {
  const blocked = new Set(names);
  const uses = manifest.manifest["uses-permission"] ?? [];
  manifest.manifest["uses-permission"] = uses.filter(
    (entry) => !blocked.has(entry.$["android:name"]),
  );
  return manifest;
}

function removeServices(manifest) {
  const application = AndroidConfig.Manifest.getMainApplication(manifest);
  if (!application) {
    return manifest;
  }
  const kept = (application.service ?? []).filter(
    (service) => !SERVICES_TO_REMOVE.includes(service.$["android:name"]),
  );
  application.service = [
    ...kept,
    ...SERVICES_TO_REMOVE.map((name) => ({
      $: {
        "android:name": name,
        "tools:node": "remove",
      },
    })),
  ];
  return manifest;
}

function writeReleaseManifest(platformProjectRoot) {
  const releaseDir = path.join(platformProjectRoot, "app/src/release");
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.writeFileSync(path.join(releaseDir, "AndroidManifest.xml"), RELEASE_MANIFEST);
}

function withStripAndroidPermissions(config) {
  if (config.android?.permissions) {
    config.android.permissions = config.android.permissions.filter(
      (permission) =>
        !isBlockedPermission(permission) &&
        !RELEASE_ONLY_PERMISSIONS.includes(canonicalPermission(permission)),
    );
  }

  return withAndroidManifest(config, (modConfig) => {
    let manifest = AndroidConfig.Manifest.ensureToolsAvailable(modConfig.modResults);
    const declared = manifest.manifest["uses-permission"] ?? [];
    const discovered = declared
      .map((entry) => entry.$["android:name"])
      .filter((name) => isBlockedPermission(name));
    manifest = AndroidConfig.Permissions.addBlockedPermissions(manifest, [
      ...new Set([...BLOCKED_PERMISSIONS, ...discovered]),
    ]);
    manifest = dropMainPermissions(manifest, RELEASE_ONLY_PERMISSIONS);
    manifest = removeServices(manifest);
    modConfig.modResults = manifest;
    writeReleaseManifest(modConfig.modRequest.platformProjectRoot);
    return modConfig;
  });
}

module.exports = createRunOncePlugin(
  withStripAndroidPermissions,
  "with-strip-android-permissions",
);
