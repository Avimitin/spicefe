import { localizeError, translate } from './i18n.js';

function apiErrorText(error, locale) {
  return localizeError(locale, error, 'status.apiDefaultError');
}

function videoErrorText(error, locale) {
  return localizeError(locale, error, 'status.videoDefaultError');
}

function apiPresentation(snapshot, locale) {
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
      detail: translate(locale, 'status.apiLiveDetail'),
    };
  }

  if (snapshot.apiState === 'error') {
    const password = snapshot.apiError?.code === 'password';
    return {
      state: 'error',
      label: translate(locale, password ? 'status.authFailed' : 'status.failed'),
      detail: translate(locale, 'status.apiFailedDetail', {
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
    }),
  };
}

function videoPresentation(snapshot, locale) {
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
      detail: translate(locale, 'status.videoLiveDetail'),
    };
  }

  if (snapshot.videoState === 'error') {
    return {
      state: 'error',
      label: translate(locale, 'status.failed'),
      detail: translate(locale, 'status.videoFailedDetail', {
        error: videoErrorText(snapshot.videoError, locale),
      }),
    };
  }

  return {
    state: 'connecting',
    label: translate(locale, 'status.opening'),
    detail: translate(locale, 'status.videoOpeningDetail'),
  };
}

function streamMessage(snapshot, locale) {
  if (!snapshot.wanted || snapshot.videoState === 'live') {
    return null;
  }

  if (snapshot.videoState === 'error') {
    const videoError = videoErrorText(snapshot.videoError, locale);
    if (snapshot.apiState === 'live') {
      return {
        state: 'error',
        title: translate(locale, 'status.videoFailedTitle'),
        copy: translate(locale, 'status.videoFailedApiLive', {
          error: videoError,
        }),
      };
    }
    if (snapshot.apiState === 'error') {
      return {
        state: 'error',
        title: translate(locale, 'status.bothFailedTitle'),
        copy: translate(locale, 'status.bothFailedCopy', {
          apiError: apiErrorText(snapshot.apiError, locale),
          videoError,
        }),
      };
    }
    return {
      state: 'error',
      title: translate(locale, 'status.videoFailedTitle'),
      copy: translate(locale, 'status.videoFailedApiOpening', {
        error: videoError,
      }),
    };
  }

  if (snapshot.apiState === 'live') {
    return {
      state: 'connecting',
      title: translate(locale, 'status.apiConnectedTitle'),
      copy: translate(locale, 'status.apiConnectedCopy'),
    };
  }
  if (snapshot.apiState === 'error') {
    return {
      state: 'error',
      title: translate(locale, 'status.apiFailedTitle'),
      copy: translate(locale, 'status.apiFailedCopy', {
        error: apiErrorText(snapshot.apiError, locale),
      }),
    };
  }
  if (snapshot.apiState === 'checking') {
    return {
      state: 'connecting',
      title: translate(locale, 'status.apiCheckingTitle'),
      copy: translate(locale, 'status.apiCheckingCopy'),
    };
  }
  return {
    state: 'connecting',
    title: translate(locale, 'status.connectingTitle'),
    copy: translate(locale, 'status.connectingCopy'),
  };
}

function apiWarning(snapshot, locale) {
  if (!snapshot.wanted || snapshot.videoState !== 'live' || snapshot.apiState !== 'error') {
    return null;
  }
  return {
    title: translate(locale, 'status.controlWarningTitle'),
    copy: snapshot.apiError?.code === 'password'
      ? translate(locale, 'status.controlPasswordCopy', {
        error: apiErrorText(snapshot.apiError, locale),
      })
      : translate(locale, 'status.controlFailedCopy', {
        error: apiErrorText(snapshot.apiError, locale),
      }),
  };
}

export function connectionPresentation(snapshot, locale = 'en') {
  return {
    api: apiPresentation(snapshot, locale),
    video: videoPresentation(snapshot, locale),
    streamMessage: streamMessage(snapshot, locale),
    apiWarning: apiWarning(snapshot, locale),
  };
}
