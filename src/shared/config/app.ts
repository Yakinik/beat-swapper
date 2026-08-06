export const APP_NAME = 'Beat Swapper'

export const APP_TAGLINE = '音源はブラウザの中だけで処理されます'

/** 読み込みを受け付ける音声ファイル。<input accept> とドロップ判定で共有する。 */
export const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac'

/**
 * ソースの入手先。AGPL-3.0 はネットワーク越しに使わせる場合も対応するソースを
 * 提供することを求めるので、画面から必ず辿れるようにしておく。
 */
export const SOURCE_URL = 'https://github.com/Yakinik/beat-swapper'

/** 同梱している第三者ソフトウェアのライセンス表記（dist 直下に置かれる） */
export const NOTICES_URL = `${import.meta.env.BASE_URL}THIRD-PARTY-NOTICES.txt`
