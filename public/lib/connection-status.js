function numericPort(profile, offset) {
  const base = Number(profile?.apiPort);
  return Number.isInteger(base) ? base + offset : null;
}

function portLabel(port) {
  return port === null ? 'its configured port' : `port ${port}`;
}

function apiErrorText(error) {
  return error?.message || 'Could not reach the spice2x control API';
}

function videoErrorText(error) {
  return error || 'Could not open the video stream';
}

function apiPresentation(snapshot, port) {
  if (!snapshot.wanted || snapshot.apiState === 'idle') {
    return {
      state: 'idle',
      label: 'Idle',
      detail: 'Control API is idle',
    };
  }

  if (snapshot.apiState === 'live') {
    return {
      state: 'connected',
      label: 'Connected',
      detail: `Control API connected on ${portLabel(port)}`,
    };
  }

  if (snapshot.apiState === 'error') {
    const password = snapshot.apiError?.code === 'password';
    return {
      state: 'error',
      label: password ? 'Auth failed' : 'Failed',
      detail: `Control API failed on ${portLabel(port)}: ${apiErrorText(snapshot.apiError)}`,
    };
  }

  return {
    state: 'connecting',
    label: snapshot.apiState === 'checking' ? 'Checking' : 'Connecting',
    detail: `${snapshot.apiState === 'checking' ? 'Checking' : 'Opening'} the control API on ${
      portLabel(port)
    }`,
  };
}

function videoPresentation(snapshot, port) {
  if (!snapshot.wanted || snapshot.videoState === 'idle') {
    return {
      state: 'idle',
      label: 'Idle',
      detail: 'Video stream is idle',
    };
  }

  if (snapshot.videoState === 'live') {
    return {
      state: 'connected',
      label: 'Live',
      detail: `Video is streaming from ${portLabel(port)}`,
    };
  }

  if (snapshot.videoState === 'error') {
    return {
      state: 'error',
      label: 'Failed',
      detail: `Video failed on ${portLabel(port)}: ${videoErrorText(snapshot.videoError)}`,
    };
  }

  return {
    state: 'connecting',
    label: 'Opening',
    detail: `Opening the video stream on ${portLabel(port)}`,
  };
}

function streamMessage(snapshot, apiPort, videoPort) {
  if (!snapshot.wanted || snapshot.videoState === 'live') {
    return null;
  }

  const apiAt = portLabel(apiPort);
  const videoAt = portLabel(videoPort);
  if (snapshot.videoState === 'error') {
    const videoError = videoErrorText(snapshot.videoError);
    if (snapshot.apiState === 'live') {
      return {
        state: 'error',
        title: 'Video stream failed',
        copy: `API connected on ${apiAt}. ${videoError}. The separate video endpoint is ${videoAt}.`,
      };
    }
    if (snapshot.apiState === 'error') {
      return {
        state: 'error',
        title: 'API and video failed',
        copy: `API ${apiAt}: ${apiErrorText(snapshot.apiError)}. Video ${videoAt}: ${videoError}.`,
      };
    }
    return {
      state: 'error',
      title: 'Video stream failed',
      copy: `${videoError}. API is still connecting on ${apiAt}; the video endpoint is ${videoAt}.`,
    };
  }

  if (snapshot.apiState === 'live') {
    return {
      state: 'connecting',
      title: 'API connected',
      copy: `Control is ready on ${apiAt}; waiting for video on ${videoAt}.`,
    };
  }
  if (snapshot.apiState === 'error') {
    return {
      state: 'error',
      title: 'API connection failed',
      copy: `${apiErrorText(snapshot.apiError)} on ${apiAt}. Video is still opening on ${videoAt}.`,
    };
  }
  if (snapshot.apiState === 'checking') {
    return {
      state: 'connecting',
      title: 'Checking spice2x API',
      copy: `Verifying control on ${apiAt}; waiting for video on ${videoAt}.`,
    };
  }
  return {
    state: 'connecting',
    title: 'Connecting to spice2x',
    copy: `Opening API on ${apiAt} and video on ${videoAt}.`,
  };
}

function apiWarning(snapshot, apiPort) {
  if (!snapshot.wanted || snapshot.videoState !== 'live' || snapshot.apiState !== 'error') {
    return null;
  }
  return {
    title: 'Video is live; control is unavailable',
    copy: snapshot.apiError?.code === 'password'
      ? `${apiErrorText(snapshot.apiError)} on ${portLabel(apiPort)}. `
        + 'Update the saved password and reconnect; video does not use that password.'
      : `${apiErrorText(snapshot.apiError)} on ${portLabel(apiPort)}. `
        + 'Touch and resize are disabled; video can continue independently.',
  };
}

export function connectionPresentation(snapshot) {
  const apiPort = numericPort(snapshot.profile, 1);
  const videoPort = numericPort(snapshot.profile, 2);
  return {
    api: apiPresentation(snapshot, apiPort),
    video: videoPresentation(snapshot, videoPort),
    streamMessage: streamMessage(snapshot, apiPort, videoPort),
    apiWarning: apiWarning(snapshot, apiPort),
  };
}
