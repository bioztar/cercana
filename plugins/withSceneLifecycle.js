// Adopts the UIScene life cycle on iOS. iOS 27 asserts at launch
// (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) for apps that don't, and the
// SDK 57 template still creates the window in didFinishLaunching. Expo ships
// ExpoAppSceneDelegate (objc EXExpoAppSceneDelegate), which creates the window and starts React
// Native. SDK 58's template does this itself — remove this plugin when upgrading.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE = 'EXExpoAppSceneDelegate';

const WINDOW_BLOCK =
  /\n[ \t]*#if os\(iOS\) \|\| os\(tvOS\)\n[ \t]*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n[ \t]*factory\.startReactNative\([\s\S]*?\)\n[ \t]*#endif\n/;

function patchAppDelegate(src) {
  if (!src.includes('ExpoReactNativeFactoryProvider')) {
    const next = src.replace(
      /class AppDelegate: ExpoAppDelegate \{/,
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
    );
    if (next === src) throw new Error('withSceneLifecycle: AppDelegate class declaration not found');
    src = next;
  }
  if (src.includes('UIWindow(frame: UIScreen.main.bounds)')) {
    const next = src.replace(
      WINDOW_BLOCK,
      '\n    // The window is created and React Native is started by EXExpoAppSceneDelegate\n' +
        '    // (scene life cycle, required by iOS 27).\n',
    );
    if (next === src) throw new Error('withSceneLifecycle: window setup block not found in AppDelegate');
    src = next;
  }
  return src;
}

module.exports = function withSceneLifecycle(config) {
  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    cfg.modResults.contents = patchAppDelegate(cfg.modResults.contents);
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default',
            UISceneDelegateClassName: SCENE_DELEGATE,
          },
        ],
      },
    };
    return cfg;
  });

  return config;
};

module.exports.patchAppDelegate = patchAppDelegate;
