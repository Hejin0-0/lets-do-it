# Third-party code

## minamo

The pools' and the slide's water optics in `src/pool/renderer.js` (`POOL_WATER`, `fresnelExact`, `waterPhase`,
`waterPath`, the bounded screen-space refraction in `fsPoolWater`) are ported to this engine's WGSL from minamo's
`src/ocean/waterMaterial.js` and `src/ocean/oceanNodes.js`: https://github.com/kanaworksai-hue/minamo

MIT License

Copyright (c) 2026 東京AI映像合同会社

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Leon Sans

The page's lettering (`src/pool/lettering.js`) draws with Leon Sans, a typeface made with code; its source is in
`vendor/leonsans/` unchanged (`vendor/leonsans/VERSION` names the commit): https://github.com/cmiscm/leonsans

MIT License

Copyright (c) 2019 Jongmin Kim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Recorded sound

The recordings in `assets/04_audio` (used by `src/pool/sound.js`) were supplied by the user on 2026-11-05, under these
original names: `ambience/pool-lapping.mp3` was `pool/gentle-lake-waves-lapping-shore.mp3`; `ambience/sea-waves-01.mp3`
and `-02.mp3` were `wave/01.mp3` and `02.mp3`; `sfx/water/water-01.mp3` to `-04.mp3` were `pool/01.mp3` to `04.mp3`;
`sfx/water/water-hand-splash.mp3` and `water-heavy-slosh.mp3` were `pool/hand-splashing-water-in-a-tub.mp3` and
`pool/heavy-water-sloshing-in-a-large-tub.mp3`; `sfx/ducks/duck-01.mp3` to `-12.mp3` were `rubber-duck/01.mp3` to
`12.mp3`. Their source and licence are the user's to record here.
