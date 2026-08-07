// Audio Session API（W3C Editor's Draft）。Safari / iOS Safari 16.4 以降のみ実装。
// TypeScript の lib.dom にはまだ入っていないので、使う分だけ宣言する。
//
// import / export を持たせるとモジュール扱いになり Navigator への合成が効かなくなる。
// このファイルは常にグローバルスクリプトのまま置くこと。

type AudioSessionType =
  | 'auto'
  | 'playback'
  | 'transient'
  | 'transient-solo'
  | 'ambient'
  | 'play-and-record'

interface AudioSession {
  type: AudioSessionType
}

interface Navigator {
  readonly audioSession?: AudioSession
}
