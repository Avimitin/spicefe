export const DEFAULT_GAME_ICON_ID = 'spice2x';

const BEMANI_ICON_FILES = [
  'ac_DDR.png',
  'ac_DDRX3.png',
  'ac_DDR_20th.png',
  'ac_IIDX18.png',
  'ac_IIDX19.png',
  'ac_IIDX20.png',
  'ac_IIDX22.png',
  'ac_IIDX23.png',
  'ac_IIDX23_pre.png',
  'ac_IIDX24.png',
  'ac_beatstream.png',
  'ac_beatstream2.png',
  'ac_beatstream_2.png',
  'ac_beatstream_chi.png',
  'ac_dancearound.png',
  'ac_danceevolution.png',
  'ac_dancerush.png',
  'ac_ddr_world.png',
  'ac_ddra.png',
  'ac_ddra20.png',
  'ac_ddra20plus.png',
  'ac_ddra3.png',
  'ac_gfdmxg3.png',
  'ac_gitadora.png',
  'ac_gitadora_ec.png',
  'ac_gitadora_fu.png',
  'ac_gitadora_gw.png',
  'ac_gitadora_gw_delta.png',
  'ac_gitadora_hv.png',
  'ac_gitadora_matixx.png',
  'ac_gitadora_nex.png',
  'ac_gitadora_od.png',
  'ac_gitadora_tb.png',
  'ac_gitadora_tb_re_loc.png',
  'ac_iidx21.png',
  'ac_iidx24_loc.png',
  'ac_iidx25.png',
  'ac_iidx26.png',
  'ac_iidx27.png',
  'ac_iidx28.png',
  'ac_iidx29.png',
  'ac_iidx30.png',
  'ac_iidx31.png',
  'ac_iidx32.png',
  'ac_iidx33.png',
  'ac_jubeat_ave.png',
  'ac_jubeat_beyond.png',
  'ac_jubeat_clan.png',
  'ac_jubeat_festo_loc.png',
  'ac_jubeatcopious.png',
  'ac_jubeatprop.png',
  'ac_jubeatqubell.png',
  'ac_jubeatsaucer.png',
  'ac_jubeatsaucerfulfill.png',
  'ac_matsuri_de_fever.png',
  'ac_mirai.png',
  'ac_mirai_v2.png',
  'ac_museca.png',
  'ac_museca_1_5.png',
  'ac_nostalgia.png',
  'ac_nostalgia_forte.png',
  'ac_nostalgia_op2_loc.png',
  'ac_nostalgia_op3_loc.png',
  'ac_otoiroha.png',
  'ac_popn19.png',
  'ac_popn20.png',
  'ac_popn20_gate.png',
  'ac_popn20_sp.png',
  'ac_popn21.png',
  'ac_popn21_gate.png',
  'ac_popn_20th.png',
  'ac_popn_eclale.png',
  'ac_popn_highcheers.jpg',
  'ac_popn_jamfizz.png',
  'ac_popn_lapistoria.png',
  'ac_popn_peace.png',
  'ac_popn_riddles.png',
  'ac_popn_unilab.png',
  'ac_popn_usaneko.png',
  'ac_prize.png',
  'ac_rb6.png',
  'ac_rbreflesia_loc.png',
  'ac_rbvolzza.png',
  'ac_rbvolzza2.png',
  'ac_refleccolette.png',
  'ac_reflecgroovin.png',
  'ac_reflecgroovin_Upper.png',
  'ac_refleclimelight.png',
  'ac_sdvx2.png',
  'ac_sdvx3.png',
  'ac_sdvx4.png',
  'ac_sdvx4_pre.png',
  'ac_sdvx6.png',
  'ac_sdvx7.jpg',
  'ac_soundvoltex.png',
  'gs_ddr.png',
  'gs_gitadora.png',
  'gs_iidx_infinitas.png',
  'gs_iidx_infinitas2.png',
  'gs_nostalgia.png',
  'gs_popn_lively.png',
  'gs_popn_psp2_01.png',
  'gs_popn_psp2_02.png',
  'gs_sdvx.png',
  'gs_sdvx_cloud.png',
  'mobile_beatgather.png',
  'mobile_eamusement_appli.png',
  'mobile_iidx.png',
  'mobile_jubeatplus.png',
  'mobile_popn_rhythmin.png',
  'mobile_rbplus.png',
];

const SCOPE_LABELS = {
  ac: 'Arcade',
  gs: 'Home',
  mobile: 'Mobile',
};

const SERIES = [
  ['danceevolution', 'DanceEvolution'],
  ['dancearound', 'DANCE aROUND'],
  ['dancerush', 'DANCERUSH'],
  ['soundvoltex', 'SOUND VOLTEX'],
  ['beatstream', 'BeatStream'],
  ['eamusement', 'e-amusement'],
  ['jubeat', 'jubeat'],
  ['gitadora', 'GITADORA'],
  ['gfdm', 'GITADORA'],
  ['nostalgia', 'NOSTALGIA'],
  ['reflec', 'REFLEC BEAT'],
  ['popn', "pop'n music"],
  ['iidx', 'beatmania IIDX'],
  ['sdvx', 'SOUND VOLTEX'],
  ['ddr', 'DanceDanceRevolution'],
  ['museca', 'MÚSECA'],
  ['otoiroha', 'おといろは'],
  ['beatgather', 'Beat Gather'],
  ['mirai', 'ミライダガッキ'],
  ['rb', 'REFLEC BEAT'],
];

const WORDS = {
  appli: 'App',
  chi: 'CHÚNI',
  ec: 'EXCHAIN',
  fu: 'FUZZ-UP',
  gw: 'GALAXY WAVE',
  hv: 'HIGH-VOLTAGE',
  loc: 'Location Test',
  nex: 'NEX+AGE',
  od: 'OverDrive',
  op: 'Op.',
  pre: 'Preview',
  tb: 'Tri-Boost',
  v: 'Vol.',
};

function humanize(value) {
  if (!value) {
    return '';
  }
  const lower = value.toLowerCase();
  if (WORDS[lower]) {
    return WORDS[lower];
  }
  return value
    .replace(/([a-z])([0-9])/gi, '$1 $2')
    .replace(/([0-9])([a-z])/gi, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function describeName(rawName) {
  const parts = rawName.split('_');
  const first = parts.shift() || '';
  const lower = first.toLowerCase();
  const matched = SERIES.find(([prefix]) => lower.startsWith(prefix));
  if (!matched) {
    return [humanize(first), ...parts.map(humanize)].filter(Boolean).join(' ');
  }
  const [prefix, seriesName] = matched;
  const suffix = first.slice(prefix.length);
  return [seriesName, humanize(suffix), ...parts.map(humanize)].filter(Boolean).join(' ');
}

function iconFromFile(file) {
  const id = file.replace(/\.[^.]+$/, '');
  const separator = id.indexOf('_');
  const scope = id.slice(0, separator);
  const rawName = id.slice(separator + 1);
  return Object.freeze({
    id,
    label: `${SCOPE_LABELS[scope] || humanize(scope)} · ${describeName(rawName)}`,
    file,
    src: new URL(`../vendor/bemani-fan-site-icons/img/${file}`, import.meta.url).href,
  });
}

export const GAME_ICONS = Object.freeze([
  Object.freeze({
    id: DEFAULT_GAME_ICON_ID,
    label: 'spice2x',
    file: 'assets/spice2x.ico',
    src: new URL('../assets/spice2x.ico', import.meta.url).href,
  }),
  ...BEMANI_ICON_FILES.map(iconFromFile),
]);

const ICONS_BY_ID = new Map(GAME_ICONS.map((icon) => [icon.id, icon]));

export function gameIconById(id) {
  return ICONS_BY_ID.get(String(id ?? '')) || ICONS_BY_ID.get(DEFAULT_GAME_ICON_ID);
}

export function normalizeGameIconId(id) {
  return gameIconById(id).id;
}
