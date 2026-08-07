# Beat Swapper

手持ちの曲を読み込むと BPM と拍位置を自動で解析し、各小節の拍を `2431` のような
好きな順に入れ替えて通しで再生します。音源の処理はすべて端末内で完結し、
どこにも送信されません。

**https://yakinik.github.io/beat-swapper/**

- MP3 / WAV / M4A などを読み込んで、BPM・拍位置・小節を自動解析
- `2431` `4321` のような並び順を入力（同じ拍の繰り返しや省略もできます）
- 1 小節を 4 拍/ 3 拍のどちらで区切るかを切り替え
- 再生 / 一時停止 / 停止に加えて、1 拍・1 小節ずつの送り戻し
- 拍の検知がずれていたら、拡大波形のクリックか各種の調整で補正
  - **拍の調節**: 検知した拍位置を全体でミリ秒単位に前後（±16 分音符）
  - **開始する拍**: 小節の区切りを -3 〜 +3 拍
  - **開始する小節**: 開始位置を -3 〜 +3 小節（手前は無音で埋まります）
  - **BPM / 開始位置**: 直接入力すると、等間隔のグリッドに切り替えて鳴らします
- 0.5〜2 倍の再生速度（ピッチは変わりません）、ループ再生、つなぎ目のフェード調整

テンポの分かりやすい曲が得意です。イントロにドラムのない曲、弱起で始まる曲、
ライブ演奏、変拍子では 1 拍目の推定を外しやすいので、手動補正で直します。

iPhone / iPad では、再生を始めると他のアプリの音楽が止まります（消音スイッチが
オンでも鳴らすために、再生用の音声セッションを取るためです）。

ソースは `develop`、公開ファイルは `pages` ブランチにあります。

## ライセンス

AGPL-3.0。BPM・拍位置の解析に [Essentia.js](https://mtg.github.io/essentia.js/)
（AGPL-3.0）の `RhythmExtractor2013` を使っているためです。

配布物に含まれる第三者ソフトウェアと、その全文は
[THIRD-PARTY-NOTICES.txt](https://yakinik.github.io/beat-swapper/THIRD-PARTY-NOTICES.txt)
にまとめてあります（`node scripts/collect-licenses.mjs` が生成し、ビルドのたびに更新されます）。

| 対象 | ライセンス |
| --- | --- |
| Preact / @preact/signals | MIT |
| Essentia.js・Essentia C++ | AGPL-3.0 |
| Kiss FFT（wasm 内） | BSD-3-Clause |
| Eigen（wasm 内） | MPL-2.0 |
| TNT（wasm 内） | パブリックドメイン |

Essentia は**非商用利用**について AGPL-3.0 で提供されています。商用利用には
[Music Technology Group（UPF）から別途ライセンス](https://essentia.upf.edu/licensing_information.html)
を受ける必要があります。
