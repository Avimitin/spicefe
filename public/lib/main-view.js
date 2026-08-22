export function configuredProfiles(profiles) {
  return (Array.isArray(profiles) ? profiles : [])
    .filter((profile) => String(profile?.host ?? '').trim() !== '');
}

export function mainView(profiles, snapshot = {}) {
  if (snapshot.wanted && snapshot.videoState === 'live') {
    return 'stream';
  }
  return configuredProfiles(profiles).length > 0 ? 'servers' : 'welcome';
}
