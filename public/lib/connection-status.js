import { localizeError, translate } from './i18n.js';

function apiErrorText(error, locale) {
  return localizeError(locale, error, 'status.apiDefaultError');
}

function videoErrorText(error, locale) {
  return localizeError(locale, error, 'status.videoDefaultError');
}

function tickerErrorText(error, locale) {
  return localizeError(locale, error, 'status.tickerDefaultError');
}

function keypadErrorText(error, locale) {
  return localizeError(locale, error, 'status.keypadDefaultError');
}

function outputMode(snapshot) {
  if (snapshot.profile?.keypadEnabled === true || snapshot.displayMode === 'keypad') {
    return 'keypad';
  }
  if (snapshot.profile?.tickerEnabled === true || snapshot.displayMode === 'ticker') {
    return 'ticker';
  }
  return 'video';
}

function modeValue(mode, videoValue, tickerValue, keypadValue) {
  if (mode === 'ticker') {
    return tickerValue;
  }
  return mode === 'keypad' ? keypadValue : videoValue;
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
  const mode = outputMode(snapshot);
  const prefix = mode;
  if (!snapshot.wanted || snapshot.videoState === 'idle') {
    return {
      state: 'idle',
      label: translate(locale, 'status.idle'),
      detail: translate(locale, `status.${prefix}IdleDetail`),
    };
  }

  if (snapshot.videoState === 'live') {
    return {
      state: 'connected',
      label: translate(locale, 'status.live'),
      detail: translate(locale, `status.${prefix}LiveDetail`),
    };
  }

  if (snapshot.videoState === 'error') {
    return {
      state: 'error',
      label: translate(locale, 'status.failed'),
      detail: translate(locale, `status.${prefix}FailedDetail`, {
        error: modeValue(
          mode,
          videoErrorText(snapshot.videoError, locale),
          tickerErrorText(snapshot.videoError, locale),
          keypadErrorText(snapshot.videoError, locale),
        ),
      }),
    };
  }

  return {
    state: 'connecting',
    label: translate(locale, 'status.opening'),
    detail: translate(locale, `status.${prefix}OpeningDetail`),
  };
}

function streamMessage(snapshot, locale) {
  if (!snapshot.wanted || snapshot.videoState === 'live') {
    return null;
  }

  const mode = outputMode(snapshot);

  if (snapshot.videoState === 'error') {
    const outputError = modeValue(
      mode,
      videoErrorText(snapshot.videoError, locale),
      tickerErrorText(snapshot.videoError, locale),
      keypadErrorText(snapshot.videoError, locale),
    );
    if (snapshot.apiState === 'live') {
      return {
        state: 'error',
        title: translate(locale, modeValue(
          mode,
          'status.videoFailedTitle',
          'status.tickerFailedTitle',
          'status.keypadFailedTitle',
        )),
        copy: translate(locale, modeValue(
          mode,
          'status.videoFailedApiLive',
          'status.tickerFailedApiLive',
          'status.keypadFailedApiLive',
        ), {
          error: outputError,
        }),
      };
    }
    if (snapshot.apiState === 'error') {
      return {
        state: 'error',
        title: translate(locale, modeValue(
          mode,
          'status.bothFailedTitle',
          'status.apiAndTickerFailedTitle',
          'status.apiAndKeypadFailedTitle',
        )),
        copy: translate(locale, modeValue(
          mode,
          'status.bothFailedCopy',
          'status.apiAndTickerFailedCopy',
          'status.apiAndKeypadFailedCopy',
        ), {
          apiError: apiErrorText(snapshot.apiError, locale),
          outputError,
          videoError: outputError,
        }),
      };
    }
    return {
      state: 'error',
      title: translate(locale, modeValue(
        mode,
        'status.videoFailedTitle',
        'status.tickerFailedTitle',
        'status.keypadFailedTitle',
      )),
      copy: translate(locale, modeValue(
        mode,
        'status.videoFailedApiOpening',
        'status.tickerFailedApiOpening',
        'status.keypadFailedApiOpening',
      ), {
        error: outputError,
      }),
    };
  }

  if (snapshot.apiState === 'live') {
    return {
      state: 'connecting',
      title: translate(locale, 'status.apiConnectedTitle'),
      copy: translate(locale, modeValue(
        mode,
        'status.apiConnectedCopy',
        'status.apiConnectedTickerCopy',
        'status.apiConnectedKeypadCopy',
      )),
    };
  }
  if (snapshot.apiState === 'error') {
    return {
      state: 'error',
      title: translate(locale, 'status.apiFailedTitle'),
      copy: translate(locale, modeValue(
        mode,
        'status.apiFailedCopy',
        'status.apiFailedTickerCopy',
        'status.apiFailedKeypadCopy',
      ), {
        error: apiErrorText(snapshot.apiError, locale),
      }),
    };
  }
  if (snapshot.apiState === 'checking') {
    return {
      state: 'connecting',
      title: translate(locale, 'status.apiCheckingTitle'),
      copy: translate(locale, modeValue(
        mode,
        'status.apiCheckingCopy',
        'status.apiCheckingTickerCopy',
        'status.apiCheckingKeypadCopy',
      )),
    };
  }
  return {
    state: 'connecting',
    title: translate(locale, 'status.connectingTitle'),
    copy: translate(locale, modeValue(
      mode,
      'status.connectingCopy',
      'status.connectingTickerCopy',
      'status.connectingKeypadCopy',
    )),
  };
}

function apiWarning(snapshot, locale) {
  if (outputMode(snapshot) !== 'video'
    || !snapshot.wanted
    || snapshot.videoState !== 'live'
    || snapshot.apiState !== 'error') {
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
