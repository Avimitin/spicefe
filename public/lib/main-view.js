export function configuredProfiles(profiles) {
  return (Array.isArray(profiles) ? profiles : [])
    .filter((profile) => String(profile?.host ?? '').trim() !== '');
}

export function browseView(profiles, requestedView) {
  if (configuredProfiles(profiles).length === 0) {
    return 'welcome';
  }
  return requestedView === 'welcome' ? 'welcome' : 'servers';
}

export function mainView(profiles, snapshot = {}, requestedView) {
  if (snapshot.wanted && snapshot.videoState === 'live') {
    return 'stream';
  }
  return browseView(profiles, requestedView);
}
