export const LOCALE_STORAGE_KEY = 'spicefe.locale';

export const TRANSLATIONS = Object.freeze({
  en: Object.freeze({
    'language.label': 'Language',
    'nav.openSettings': 'Open connection settings',
    'nav.settings': 'Connection settings',
    'nav.profile': 'Connection profile',
    'nav.status': 'Connection status',
    'nav.video': 'Video',
    'nav.fullscreen': 'Toggle fullscreen',
    'nav.fullscreenTitle': 'Fullscreen',
    'button.connect': 'Connect',
    'button.disconnect': 'Disconnect',
    'button.switch': 'Switch',
    'button.new': 'New',
    'button.delete': 'Delete',
    'button.save': 'Save',
    'button.saveConnect': 'Save & connect',
    'button.cancel': 'Cancel',
    'button.dismiss': 'Dismiss',
    'button.closeSettings': 'Close settings',
    'button.show': 'Show',
    'button.hide': 'Hide',
    'button.openHttp': 'Open HTTP mode',
    'button.openHttpLong': 'Open this app in HTTP compatibility mode',
    'common.choose': 'Choose…',
    'common.off': 'Off',
    'compat.dismiss': 'Dismiss compatibility message',
    'compat.title': 'Browser compatibility mode needed',
    'compat.copy': 'Safari and Firefox cannot open plain spice2x LAN connections from an HTTPS page.',
    'compat.forcedTitle': 'This host forced HTTPS back on',
    'compat.forcedCopy': 'Use a custom domain with Force HTTPS disabled, or open this site on EdgeOne over HTTP.',
    'home.eyebrow': 'LAN SUBSCREEN CLIENT',
    'home.titleFirst': 'Put the game’s second screen',
    'home.titleSecond': 'in your hands.',
    'home.copy': 'Connect directly to spice2x. Video and touch stay between this device and your gaming PC.',
    'home.configure': 'Set up a connection',
    'stream.aria': 'Spice subscreen stream',
    'stream.connecting': 'Connecting',
    'stream.opening': 'Opening the video stream…',
    'warning.title': 'Video is live; control is unavailable',
    'warning.copy': 'Touch and resize are disabled; video can continue independently.',
    'hud.video': 'VIDEO',
    'hud.latency': 'LATENCY MODE',
    'hud.live': 'LIVE',
    'hud.resize': 'Game resize',
    'hud.scene': 'Scene {scene}',
    'hud.show': 'Show screen controls',
    'hud.hide': 'Hide screen controls',
    'hud.viewModeTitle': 'Change how the video fits the screen',
    'metric.waiting': 'Waiting for frame',
    'version.title': 'Recent spice2x required',
    'version.copy': 'Install spice2x-26-08-20 or newer for subscreen streaming. Older builds do not include the required stream and CORS support.',
    'version.download': 'Download latest spice2x',
    'settings.eyebrow': 'CONNECTION LIBRARY',
    'settings.title': 'Spice instances',
    'settings.savedInstance': 'Saved instance',
    'settings.profileName': 'Profile name',
    'settings.profilePlaceholder': 'Gaming PC',
    'settings.gameIcon': 'Game icon',
    'settings.gameIconHelp': 'Saved with this connection and shown beside its PC name.',
    'settings.host': 'Host PC address',
    'settings.hostHelp': 'Use a private IP address or a .local name.',
    'settings.apiPort': 'API port',
    'settings.videoPortHelp': 'Video uses port +2.',
    'settings.password': 'Password',
    'settings.passwordPlaceholder': 'Optional API password',
    'settings.passwordHelp': 'Saved as plain text in this browser’s local storage. The video endpoint itself is not authenticated.',
    'settings.stream': 'Stream',
    'settings.format': 'Format',
    'settings.formatAuto': 'Auto · H.264 first',
    'settings.formatH264': 'H.264 only',
    'settings.screen': 'Screen',
    'settings.screenAuto': 'Auto · prefer subscreen',
    'settings.screenNumber': 'Screen {screen}',
    'settings.fps': 'FPS',
    'settings.quality': 'Quality',
    'settings.display': 'Display',
    'settings.direct': 'Direct connection',
    'settings.directCopy': 'No relay is used. Allow local-network access when your browser asks, and permit the WebSocket and stream ports (API port +1 and +2) through Windows Firewall.',
    'settings.directCopyPublic': 'No relay is used. Allow local-network access when your browser asks, and permit the WebSocket and stream ports (API port +1 and +2) through Windows Firewall. A literal private IP is the most compatible choice on HTTPS.',
    'settings.saved': 'Saved on this device',
    'display.contain': 'Fit',
    'display.cover': 'Fill',
    'display.fill': 'Stretch',
    'icon.eyebrow': 'PROFILE APPEARANCE',
    'icon.title': 'Choose a game icon',
    'icon.close': 'Close icon picker',
    'icon.searchLabel': 'Search game icons',
    'icon.searchPlaceholder': "Search IIDX, GITADORA, SDVX, pop'n…",
    'icon.groupsAria': 'Supported game icons by series',
    'icon.group.default': 'Default',
    'icon.group.iidx': 'beatmania IIDX',
    'icon.group.gitadora': 'GITADORA',
    'icon.group.sdvx': 'SOUND VOLTEX',
    'icon.group.popn': "pop'n music",
    'icon.empty': 'No supported game icons match this search.',
    'icon.scopeAll': '{count} supported icons in {categories} categories',
    'icon.scopeMatch': '{count} of {total} supported icons match',
    'delete.title': 'Delete this instance?',
    'delete.defaultCopy': 'The saved connection information will be removed from this device.',
    'delete.copy': '“{name}” and its saved connection information will be removed from this device.',
    'profile.newName': 'Gaming PC {number}',
    'validation.hostRequired': 'Enter the gaming PC address',
    'toast.profileSaved': 'Connection profile saved',
    'toast.password': 'The API password is incorrect. Update the saved instance and reconnect.',
    'toast.resizeOff': 'Game screen resize disabled',
    'toast.resizeScene': 'Game screen resize scene {scene} selected',
    'toast.resizeError': 'Resize: {message}',
    'notice.h264UnavailableMjpeg': 'H.264 decoding is unavailable; using the higher-bandwidth MJPEG stream',
    'notice.h264MissingMjpeg': 'This spice2x build has no H.264 encoder; using MJPEG',
    'notice.h264Alternate': 'Trying the browser’s alternate H.264 playback path',
    'notice.h264DecodeMjpeg': 'H.264 could not be decoded; using MJPEG',
    'status.configuredPort': 'its configured port',
    'status.port': 'port {port}',
    'status.apiDefaultError': 'Could not reach the spice2x control API',
    'status.videoDefaultError': 'Could not open the video stream',
    'status.idle': 'Idle',
    'status.connected': 'Connected',
    'status.authFailed': 'Auth failed',
    'status.failed': 'Failed',
    'status.checking': 'Checking',
    'status.connecting': 'Connecting',
    'status.live': 'Live',
    'status.opening': 'Opening',
    'status.apiIdleDetail': 'Control API is idle',
    'status.apiLiveDetail': 'Control API connected on {port}',
    'status.apiFailedDetail': 'Control API failed on {port}: {error}',
    'status.apiConnectingDetail': '{action} the control API on {port}',
    'status.actionChecking': 'Checking',
    'status.actionOpening': 'Opening',
    'status.videoIdleDetail': 'Video stream is idle',
    'status.videoLiveDetail': 'Video is streaming from {port}',
    'status.videoFailedDetail': 'Video failed on {port}: {error}',
    'status.videoOpeningDetail': 'Opening the video stream on {port}',
    'status.videoFailedTitle': 'Video stream failed',
    'status.videoFailedApiLive': 'API connected on {apiPort}. {error}. The separate video endpoint is {videoPort}.',
    'status.bothFailedTitle': 'API and video failed',
    'status.bothFailedCopy': 'API {apiPort}: {apiError}. Video {videoPort}: {videoError}.',
    'status.videoFailedApiOpening': '{error}. API is still connecting on {apiPort}; the video endpoint is {videoPort}.',
    'status.apiConnectedTitle': 'API connected',
    'status.apiConnectedCopy': 'Control is ready on {apiPort}; waiting for video on {videoPort}.',
    'status.apiFailedTitle': 'API connection failed',
    'status.apiFailedCopy': '{error} on {apiPort}. Video is still opening on {videoPort}.',
    'status.apiCheckingTitle': 'Checking spice2x API',
    'status.apiCheckingCopy': 'Verifying control on {apiPort}; waiting for video on {videoPort}.',
    'status.connectingTitle': 'Connecting to spice2x',
    'status.connectingCopy': 'Opening API on {apiPort} and video on {videoPort}.',
    'status.controlWarningTitle': 'Video is live; control is unavailable',
    'status.controlPasswordCopy': '{error} on {apiPort}. Update the saved password and reconnect; video does not use that password.',
    'status.controlFailedCopy': '{error} on {apiPort}. Touch and resize are disabled; video can continue independently.',
    'error.hostPath': 'Enter a host name or IP address without a path',
    'error.hostPort': 'Put the API port in the separate port field',
    'error.videoUnavailable': 'H.264 decoding is unavailable in this browser context',
    'error.noFrames': 'No video frames arrived from that screen',
    'error.mjpeg': 'Could not open the MJPEG stream',
    'error.videoFailed': 'Video stream failed',
    'error.apiDisconnected': 'Input API is not connected',
    'error.apiSocket': 'Could not reach the spice2x input socket',
    'error.apiClosed': 'Connection closed',
    'error.apiTimeout': 'The input API did not answer in time',
    'error.wrongPassword': 'Wrong API password or malformed response',
    'error.videoHttp': 'Video server returned HTTP {status}',
  }),
  'zh-CN': Object.freeze({
    'language.label': '语言',
    'nav.openSettings': '打开连接设置',
    'nav.settings': '连接设置',
    'nav.profile': '连接配置',
    'nav.status': '连接状态',
    'nav.video': '视频',
    'nav.fullscreen': '切换全屏',
    'nav.fullscreenTitle': '全屏',
    'button.connect': '连接',
    'button.disconnect': '断开',
    'button.switch': '切换',
    'button.new': '新建',
    'button.delete': '删除',
    'button.save': '保存',
    'button.saveConnect': '保存并连接',
    'button.cancel': '取消',
    'button.dismiss': '关闭',
    'button.closeSettings': '关闭设置',
    'button.show': '显示',
    'button.hide': '隐藏',
    'button.openHttp': '打开 HTTP 模式',
    'button.openHttpLong': '使用 HTTP 兼容模式打开本应用',
    'common.choose': '请选择…',
    'common.off': '关闭',
    'compat.dismiss': '关闭兼容性提示',
    'compat.title': '需要浏览器兼容模式',
    'compat.copy': 'Safari 和 Firefox 无法从 HTTPS 页面打开 spice2x 的局域网明文连接。',
    'compat.forcedTitle': '当前主机强制跳回 HTTPS',
    'compat.forcedCopy': '请使用未开启强制 HTTPS 的自定义域名，或通过 EdgeOne 的 HTTP 页面打开本站。',
    'home.eyebrow': '局域网副屏客户端',
    'home.titleFirst': '把游戏的第二块屏幕',
    'home.titleSecond': '放在手中。',
    'home.copy': '直接连接 spice2x；视频和触控数据只在本设备与游戏 PC 之间传输。',
    'home.configure': '设置连接',
    'stream.aria': 'Spice 副屏视频流',
    'stream.connecting': '正在连接',
    'stream.opening': '正在打开视频流…',
    'warning.title': '视频已连接，但控制不可用',
    'warning.copy': '触控和画面缩放已禁用；视频可继续播放。',
    'hud.video': '视频',
    'hud.latency': '延迟模式',
    'hud.live': '实时',
    'hud.resize': '游戏画面缩放',
    'hud.scene': '场景 {scene}',
    'hud.show': '显示画面控制栏',
    'hud.hide': '隐藏画面控制栏',
    'hud.viewModeTitle': '更改视频在屏幕中的显示方式',
    'metric.waiting': '等待视频帧',
    'version.title': '需要新版 spice2x',
    'version.copy': '副屏串流需要 spice2x-26-08-20 或更新版本。旧版本不包含所需的视频流及 CORS 支持。',
    'version.download': '下载最新版 spice2x',
    'settings.eyebrow': '连接配置库',
    'settings.title': 'Spice 实例',
    'settings.savedInstance': '已保存的实例',
    'settings.profileName': '配置名称',
    'settings.profilePlaceholder': '游戏 PC',
    'settings.gameIcon': '游戏图标',
    'settings.gameIconHelp': '保存在此连接中，并显示在 PC 名称旁。',
    'settings.host': '主机 PC 地址',
    'settings.hostHelp': '请使用私有 IP 地址或 .local 主机名。',
    'settings.apiPort': 'API 端口',
    'settings.videoPortHelp': '视频使用 API 端口 +2。',
    'settings.password': '密码',
    'settings.passwordPlaceholder': '可选的 API 密码',
    'settings.passwordHelp': '密码会以明文保存在本浏览器的 localStorage 中；视频端点本身不进行身份验证。',
    'settings.stream': '视频流',
    'settings.format': '格式',
    'settings.formatAuto': '自动 · 优先 H.264',
    'settings.formatH264': '仅 H.264',
    'settings.screen': '画面',
    'settings.screenAuto': '自动 · 优先副屏',
    'settings.screenNumber': '画面 {screen}',
    'settings.fps': '帧率',
    'settings.quality': '画质',
    'settings.display': '显示方式',
    'settings.direct': '直接连接',
    'settings.directCopy': '本应用不使用中继。当浏览器询问时，请允许访问本地网络，并在 Windows 防火墙中允许 WebSocket 和视频端口（API 端口 +1 和 +2）。',
    'settings.directCopyPublic': '本应用不使用中继。当浏览器询问时，请允许访问本地网络，并在 Windows 防火墙中允许 WebSocket 和视频端口（API 端口 +1 和 +2）。HTTPS 模式下直接使用私有 IP 地址的兼容性最好。',
    'settings.saved': '已保存在此设备上',
    'display.contain': '适应',
    'display.cover': '填充',
    'display.fill': '拉伸',
    'icon.eyebrow': '配置外观',
    'icon.title': '选择游戏图标',
    'icon.close': '关闭图标选择器',
    'icon.searchLabel': '搜索游戏图标',
    'icon.searchPlaceholder': '搜索 IIDX、GITADORA、SDVX、pop\'n…',
    'icon.groupsAria': '按系列分类的可用游戏图标',
    'icon.group.default': '默认',
    'icon.group.iidx': 'beatmania IIDX',
    'icon.group.gitadora': 'GITADORA',
    'icon.group.sdvx': 'SOUND VOLTEX',
    'icon.group.popn': "pop'n music",
    'icon.empty': '没有与搜索条件匹配的可用游戏图标。',
    'icon.scopeAll': '共 {count} 个可用图标，分为 {categories} 类',
    'icon.scopeMatch': '找到 {count} 个图标，共 {total} 个',
    'delete.title': '删除此实例？',
    'delete.defaultCopy': '此设备上保存的连接信息将被删除。',
    'delete.copy': '“{name}” 及其保存在此设备上的连接信息将被删除。',
    'profile.newName': '游戏 PC {number}',
    'validation.hostRequired': '请输入游戏 PC 地址',
    'toast.profileSaved': '连接配置已保存',
    'toast.password': 'API 密码不正确。请更新已保存的实例并重新连接。',
    'toast.resizeOff': '已关闭游戏画面缩放',
    'toast.resizeScene': '已选择游戏画面缩放场景 {scene}',
    'toast.resizeError': '画面缩放：{message}',
    'notice.h264UnavailableMjpeg': '无法解码 H.264，将使用带宽占用更高的 MJPEG 视频流',
    'notice.h264MissingMjpeg': '此 spice2x 版本没有 H.264 编码器，将使用 MJPEG',
    'notice.h264Alternate': '正在尝试浏览器的备用 H.264 播放方式',
    'notice.h264DecodeMjpeg': '无法解码 H.264，将使用 MJPEG',
    'status.configuredPort': '已配置的端口',
    'status.port': '端口 {port}',
    'status.apiDefaultError': '无法连接 spice2x 控制 API',
    'status.videoDefaultError': '无法打开视频流',
    'status.idle': '空闲',
    'status.connected': '已连接',
    'status.authFailed': '认证失败',
    'status.failed': '失败',
    'status.checking': '检查中',
    'status.connecting': '连接中',
    'status.live': '实时',
    'status.opening': '打开中',
    'status.apiIdleDetail': '控制 API 处于空闲状态',
    'status.apiLiveDetail': '控制 API 已在{port}连接',
    'status.apiFailedDetail': '控制 API 在{port}连接失败：{error}',
    'status.apiConnectingDetail': '正在{port}{action}控制 API',
    'status.actionChecking': '检查',
    'status.actionOpening': '打开',
    'status.videoIdleDetail': '视频流处于空闲状态',
    'status.videoLiveDetail': '正在从{port}接收视频',
    'status.videoFailedDetail': '视频在{port}打开失败：{error}',
    'status.videoOpeningDetail': '正在{port}打开视频流',
    'status.videoFailedTitle': '视频流连接失败',
    'status.videoFailedApiLive': 'API 已在{apiPort}连接。{error}。独立的视频端点为{videoPort}。',
    'status.bothFailedTitle': 'API 和视频连接均失败',
    'status.bothFailedCopy': 'API {apiPort}：{apiError}。视频 {videoPort}：{videoError}。',
    'status.videoFailedApiOpening': '{error}。API 仍在{apiPort}连接；视频端点为{videoPort}。',
    'status.apiConnectedTitle': 'API 已连接',
    'status.apiConnectedCopy': '控制已在{apiPort}就绪；正在等待{videoPort}的视频。',
    'status.apiFailedTitle': 'API 连接失败',
    'status.apiFailedCopy': '{apiPort}：{error}。视频仍在从{videoPort}打开。',
    'status.apiCheckingTitle': '正在检查 spice2x API',
    'status.apiCheckingCopy': '正在{apiPort}验证控制连接；同时等待{videoPort}的视频。',
    'status.connectingTitle': '正在连接 spice2x',
    'status.connectingCopy': '正在打开{apiPort}的 API 和{videoPort}的视频。',
    'status.controlWarningTitle': '视频已连接，但控制不可用',
    'status.controlPasswordCopy': '{apiPort}：{error}。请更新已保存的密码并重新连接；视频不使用该密码。',
    'status.controlFailedCopy': '{apiPort}：{error}。触控和画面缩放已禁用；视频可继续播放。',
    'error.hostPath': '请仅输入主机名或 IP 地址，不要包含路径',
    'error.hostPort': '请在独立的 API 端口字段中填写端口',
    'error.videoUnavailable': '当前浏览器环境无法解码 H.264',
    'error.noFrames': '未从该画面收到视频帧',
    'error.mjpeg': '无法打开 MJPEG 视频流',
    'error.videoFailed': '视频流失败',
    'error.apiDisconnected': '输入 API 未连接',
    'error.apiSocket': '无法连接 spice2x 输入 WebSocket',
    'error.apiClosed': '连接已关闭',
    'error.apiTimeout': '输入 API 未在限时内响应',
    'error.wrongPassword': 'API 密码错误或响应格式异常',
    'error.videoHttp': '视频服务器返回 HTTP {status}',
  }),
});

const KNOWN_ERRORS = new Map([
  ['Enter a host name or IP address without a path', 'error.hostPath'],
  ['Put the API port in the separate port field', 'error.hostPort'],
  ['H.264 decoding is unavailable in this browser context', 'error.videoUnavailable'],
  ['No video frames arrived from that screen', 'error.noFrames'],
  ['Could not open the MJPEG stream', 'error.mjpeg'],
  ['Video stream failed', 'error.videoFailed'],
  ['Input API is not connected', 'error.apiDisconnected'],
  ['Could not reach the spice2x input socket', 'error.apiSocket'],
  ['Connection closed', 'error.apiClosed'],
  ['The input API did not answer in time', 'error.apiTimeout'],
  ['Wrong API password or malformed response', 'error.wrongPassword'],
]);

export function supportedLocale(value) {
  const locale = String(value ?? '').trim().toLowerCase();
  if (locale === 'en' || locale.startsWith('en-')) {
    return 'en';
  }
  if (locale === 'zh' || locale.startsWith('zh-')) {
    return 'zh-CN';
  }
  return null;
}

export function resolveLocale(savedLocale, languages = []) {
  const saved = supportedLocale(savedLocale);
  if (saved) {
    return saved;
  }
  const candidates = Array.isArray(languages) ? languages : [languages];
  for (const candidate of candidates) {
    const locale = supportedLocale(candidate);
    if (locale) {
      return locale;
    }
  }
  return 'en';
}

export function translate(locale, key, parameters = {}) {
  const selected = supportedLocale(locale) || 'en';
  const template = TRANSLATIONS[selected][key] ?? TRANSLATIONS.en[key] ?? key;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => (
    Object.hasOwn(parameters, name) ? String(parameters[name]) : match
  ));
}

export function localizeError(locale, error, fallbackKey = null) {
  const message = typeof error === 'string' ? error : error?.message;
  const knownKey = KNOWN_ERRORS.get(message);
  if (knownKey) {
    return translate(locale, knownKey);
  }
  const http = String(message ?? '').match(/^Video server returned HTTP (\d{3})$/);
  if (http) {
    return translate(locale, 'error.videoHttp', { status: http[1] });
  }
  if (message) {
    return String(message);
  }
  return fallbackKey ? translate(locale, fallbackKey) : '';
}

function savedLocaleFrom(storage) {
  try {
    return storage?.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function createI18n(options = {}) {
  let storage = options.storage;
  if (!Object.hasOwn(options, 'storage')) {
    try {
      storage = globalThis.localStorage;
    } catch {
      storage = null;
    }
  }
  const languages = options.languages
    ?? globalThis.navigator?.languages
    ?? [globalThis.navigator?.language];
  let locale = resolveLocale(savedLocaleFrom(storage), languages);

  return {
    get locale() {
      return locale;
    },
    setLocale(value) {
      locale = supportedLocale(value) || 'en';
      try {
        storage?.setItem(LOCALE_STORAGE_KEY, locale);
      } catch {
        // A blocked storage preference should not prevent changing this page.
      }
      return locale;
    },
    t(key, parameters) {
      return translate(locale, key, parameters);
    },
  };
}
