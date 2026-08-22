import { localizeError, translate } from './i18n.js';

function numericPort(profile, offset) {
  const base = Number(profile?.apiPort);
  return Number.isInteger(base) ? base + offset : null;
}

function portLabel(port, locale) {
  return port === null
    ? translate(locale, 'status.configuredPort')
    : translate(locale, 'status.port', { port });
}

function apiErrorText(error, locale) {
  return localizeError(locale, error, 'status.apiDefaultError');
}

function videoErrorText(error, locale) {
  return localizeError(locale, error, 'status.videoDefaultError');
}

function apiPresentation(snapshot, port, locale) {
  if (!snapshot.wanted || snapshot.apiState === 'idle') {
    return {
      state: 'idle',
      label: translate(locale, 'status.idle'),
      detail: translate(locale, 'status.apiIdleDetail'),
    };
  }

  if (snapshot.apiState === 'live') {
    return {
      state: 'connected',
      label: translate(locale, 'status.connected'),
      detail: translate(locale, 'status.apiLiveDetail', {
        port: portLabel(port, locale),
      }),
    };
  }

  if (snapshot.apiState === 'error') {
    const password = snapshot.apiError?.code === 'password';
    return {
      state: 'error',
      label: translate(locale, password ? 'status.authFailed' : 'status.failed'),
      detail: translate(locale, 'status.apiFailedDetail', {
        port: portLabel(port, locale),
        error: apiErrorText(snapshot.apiError, locale),
      }),
    };
  }

  const checking = snapshot.apiState === 'checking';
  return {
    state: 'connecting',
    label: translate(locale, checking ? 'status.checking' : 'status.connecting'),
    detail: translate(locale, 'status.apiConnectingDetail', {
      action: translate(locale, checking ? 'status.actionChecking' : 'status.actionOpening'),
      port: portLabel(port, locale),
    }),
  };
}

function videoPresentation(snapshot, port, locale) {
  if (!snapshot.wanted || snapshot.videoState === 'idle') {
    return {
      state: 'idle',
      label: translate(locale, 'status.idle'),
      detail: translate(locale, 'status.videoIdleDetail'),
    };
  }

  if (snapshot.videoState === 'live') {
    return {
      state: 'connected',
      label: translate(locale, 'status.live'),
      detail: translate(locale, 'status.videoLiveDetail', {
        port: portLabel(port, locale),
      }),
    };
  }

  if (snapshot.videoState === 'error') {
    return {
      state: 'error',
      label: translate(locale, 'status.failed'),
      detail: translate(locale, 'status.videoFailedDetail', {
        port: portLabel(port, locale),
        error: videoErrorText(snapshot.videoError, locale),
      }),
    };
  }

  return {
    state: 'connecting',
    label: translate(locale, 'status.opening'),
    detail: translate(locale, 'status.videoOpeningDetail', {
      port: portLabel(port, locale),
    }),
  };
}

function streamMessage(snapshot, apiPort, videoPort, locale) {
  if (!snapshot.wanted || snapshot.videoState === 'live') {
    return null;
  }

  const apiAt = portLabel(apiPort, locale);
  const videoAt = portLabel(videoPort, locale);
  if (snapshot.videoState === 'error') {
    const videoError = videoErrorText(snapshot.videoError, locale);
    if (snapshot.apiState === 'live') {
      return {
        state: 'error',
        title: translate(locale, 'status.videoFailedTitle'),
        copy: translate(locale, 'status.videoFailedApiLive', {
          apiPort: apiAt,
          error: videoError,
          videoPort: videoAt,
        }),
      };
    }
    if (snapshot.apiState === 'error') {
      return {
        state: 'error',
        title: translate(locale, 'status.bothFailedTitle'),
        copy: translate(locale, 'status.bothFailedCopy', {
          apiPort: apiAt,
          apiError: apiErrorText(snapshot.apiError, locale),
          videoPort: videoAt,
          videoError,
        }),
      };
    }
    return {
      state: 'error',
      title: translate(locale, 'status.videoFailedTitle'),
      copy: translate(locale, 'status.videoFailedApiOpening', {
        error: videoError,
        apiPort: apiAt,
        videoPort: videoAt,
      }),
    };
  }

  if (snapshot.apiState === 'live') {
    return {
      state: 'connecting',
      title: translate(locale, 'status.apiConnectedTitle'),
      copy: translate(locale, 'status.apiConnectedCopy', {
        apiPort: apiAt,
        videoPort: videoAt,
      }),
    };
  }
  if (snapshot.apiState === 'error') {
    return {
      state: 'error',
      title: translate(locale, 'status.apiFailedTitle'),
      copy: translate(locale, 'status.apiFailedCopy', {
        error: apiErrorText(snapshot.apiError, locale),
        apiPort: apiAt,
        videoPort: videoAt,
      }),
    };
  }
  if (snapshot.apiState === 'checking') {
    return {
      state: 'connecting',
      title: translate(locale, 'status.apiCheckingTitle'),
      copy: translate(locale, 'status.apiCheckingCopy', {
        apiPort: apiAt,
        videoPort: videoAt,
      }),
    };
  }
  return {
    state: 'connecting',
    title: translate(locale, 'status.connectingTitle'),
    copy: translate(locale, 'status.connectingCopy', {
      apiPort: apiAt,
      videoPort: videoAt,
    }),
  };
}

function apiWarning(snapshot, apiPort, locale) {
  if (!snapshot.wanted || snapshot.videoState !== 'live' || snapshot.apiState !== 'error') {
    return null;
  }
  return {
    title: translate(locale, 'status.controlWarningTitle'),
    copy: snapshot.apiError?.code === 'password'
      ? translate(locale, 'status.controlPasswordCopy', {
        error: apiErrorText(snapshot.apiError, locale),
        apiPort: portLabel(apiPort, locale),
      })
      : translate(locale, 'status.controlFailedCopy', {
        error: apiErrorText(snapshot.apiError, locale),
        apiPort: portLabel(apiPort, locale),
      }),
  };
}

export function connectionPresentation(snapshot, locale = 'en') {
  const apiPort = numericPort(snapshot.profile, 1);
  const videoPort = numericPort(snapshot.profile, 2);
  return {
    api: apiPresentation(snapshot, apiPort, locale),
    video: videoPresentation(snapshot, videoPort, locale),
    streamMessage: streamMessage(snapshot, apiPort, videoPort, locale),
    apiWarning: apiWarning(snapshot, apiPort, locale),
  };
}
