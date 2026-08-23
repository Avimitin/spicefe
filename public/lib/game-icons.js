export const DEFAULT_GAME_ICON_ID = 'spice2x';

const DEFAULT_GAME_ICON = Object.freeze({
  id: DEFAULT_GAME_ICON_ID,
  label: 'spice2x',
  file: 'assets/spice2x.ico',
  src: new URL('../assets/spice2x.ico', import.meta.url).href,
});

function bemaniIcon(file, label) {
  return Object.freeze({
    id: file.replace(/\.[^.]+$/, ''),
    label,
    file,
    src: new URL(`../vendor/bemani-fan-site-icons/img/${file}`, import.meta.url).href,
  });
}

function iconGroup(id, label, icons) {
  return Object.freeze({
    id,
    label,
    icons: Object.freeze(icons),
  });
}

export const GAME_ICON_GROUPS = Object.freeze([
  iconGroup('default', 'Default', [DEFAULT_GAME_ICON]),
  iconGroup('iidx', 'beatmania IIDX', [
    bemaniIcon('ac_iidx27.png', 'beatmania IIDX 27'),
    bemaniIcon('ac_iidx28.png', 'beatmania IIDX 28'),
    bemaniIcon('ac_iidx29.png', 'beatmania IIDX 29'),
    bemaniIcon('ac_iidx30.png', 'beatmania IIDX 30'),
    bemaniIcon('ac_iidx31.png', 'beatmania IIDX 31'),
    bemaniIcon('ac_iidx32.png', 'beatmania IIDX 32'),
    bemaniIcon('ac_iidx33.png', 'beatmania IIDX 33'),
  ]),
  iconGroup('gitadora', 'GITADORA', [
    bemaniIcon('ac_gitadora_gw_delta.png', 'GITADORA GALAXY WAVE DELTA'),
  ]),
  iconGroup('sdvx', 'SOUND VOLTEX', [
    bemaniIcon('ac_sdvx6.png', 'SOUND VOLTEX 6'),
    bemaniIcon('ac_sdvx7.jpg', 'SOUND VOLTEX 7'),
  ]),
  iconGroup('popn', "pop'n music", [
    bemaniIcon('ac_popn_highcheers.jpg', "pop'n music High Cheer"),
  ]),
]);

export const GAME_ICONS = Object.freeze(
  GAME_ICON_GROUPS.flatMap((group) => group.icons),
);

const ICONS_BY_ID = new Map(GAME_ICONS.map((icon) => [icon.id, icon]));
const CUSTOM_ICONS_BY_ID = new Map();
const CUSTOM_ICON_ID_PATTERN = /^custom-icon-[A-Za-z0-9_-]{8,96}$/;
const CUSTOM_ICON_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export function setCustomGameIcons(icons = []) {
  CUSTOM_ICONS_BY_ID.clear();
  for (const icon of icons) {
    const id = String(icon?.id ?? '');
    const label = String(icon?.label ?? '').trim();
    const src = String(icon?.src ?? '');
    if (!CUSTOM_ICON_ID_PATTERN.test(id)
      || !label
      || !CUSTOM_ICON_DATA_URL_PATTERN.test(src)) {
      continue;
    }
    CUSTOM_ICONS_BY_ID.set(id, Object.freeze({
      id,
      label,
      src,
      custom: true,
    }));
  }
}

export function gameIconById(id) {
  const key = String(id ?? '');
  return ICONS_BY_ID.get(key)
    || CUSTOM_ICONS_BY_ID.get(key)
    || ICONS_BY_ID.get(DEFAULT_GAME_ICON_ID);
}

export function normalizeGameIconId(id) {
  return gameIconById(id).id;
}
