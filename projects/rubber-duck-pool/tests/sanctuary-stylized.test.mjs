import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDuckHatMesh, getSignatureHatForDesign } from '../src/sanctuary/duck-hats.js';
import {
  stylizeSanctuaryRoot,
  attachCartoonDuckFeatures,
  setDuckStickerHighlight,
  INK_OUTLINE_HEX,
} from '../src/sanctuary/stylized-look.js';

function makeMockDuck(name = 'Duck_Upper_01_classic') {
  const root = new THREE.Group();
  root.name = name;
  root.scale.setScalar(0.38);

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 8),
    new THREE.MeshStandardMaterial({ name: 'DuckYellow', color: 0xf2c138 }),
  );
  body.name = `${name}_DuckBody`;
  root.add(body);

  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 6),
    new THREE.MeshStandardMaterial({ name: 'DuckEyeBlack', color: 0x111111 }),
  );
  eyeL.name = `${name}_DuckEye_L`;
  eyeL.position.set(-0.148, 0.764, 0.232);
  root.add(eyeL);

  const eyeR = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 6),
    new THREE.MeshStandardMaterial({ name: 'DuckEyeBlack', color: 0x111111 }),
  );
  eyeR.name = `${name}_DuckEye_R`;
  eyeR.position.set(0.148, 0.764, 0.232);
  root.add(eyeR);

  return root;
}

test('concept-book signature duck accessories build merged single-draw geometries with crooked beret', () => {
  assert.equal(getSignatureHatForDesign('01-classic'), 'towel');
  assert.equal(getSignatureHatForDesign('02-mint'), 'fern');
  assert.equal(getSignatureHatForDesign('03-cherry'), 'beret');
  assert.equal(getSignatureHatForDesign('04-daisy'), 'ribbon');
  assert.equal(getSignatureHatForDesign('17-bookbinder'), 'archivist');

  for (const id of ['towel', 'fern', 'beret', 'ribbon', 'archivist']) {
    const mesh = createDuckHatMesh(id);
    assert.ok(mesh && mesh.isMesh, `expected merged mesh for ${id}`);
    assert.ok(mesh.geometry.attributes.position.count > 24, `${id} should have geometry vertices`);
    assert.ok(mesh.geometry.attributes.color, `${id} should carry vertex colors`);
  }
  const beret = createDuckHatMesh('beret');
  assert.ok(Math.abs(beret.userData.baseTiltRad + (11 * Math.PI) / 180) < 1e-4);
});

test('stylizeSanctuaryRoot applies watercolor gouache toon shader while protecting book pages and glass', () => {
  const root = new THREE.Group();
  const wood = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ name: 'M_Hinoki_PBR', color: 0x8b5a2b }),
  );
  wood.name = 'L03_Onsen_Hinoki_Carpentry';
  const page = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ name: 'M_Book_Dynamic_Left', color: 0xffffff }),
  );
  page.name = 'Book_Page_Left';
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ name: 'M_Rain_Glass', transparent: true, opacity: 0.3 }),
  );
  glass.name = 'L02_Conservatory_Glass_Vault';
  root.add(wood, page, glass);

  const summary = stylizeSanctuaryRoot(root);
  assert.equal(INK_OUTLINE_HEX, 0x38261b);
  assert.equal(wood.material.userData.gouacheStylized, true);
  assert.equal(Boolean(page.material.userData.gouacheStylized), false);
  assert.equal(Boolean(glass.material.userData.gouacheStylized), false);
  assert.ok(summary.stylizedCount >= 1);
});

test('attachCartoonDuckFeatures adds eyes, cheeks, ink & white sticker outlines, and classic mole only on 01-classic', () => {
  const classic = makeMockDuck('Duck_Upper_01_classic');
  const mint = makeMockDuck('Duck_Upper_02_mint');

  const rigClassic = attachCartoonDuckFeatures(classic, '01-classic');
  const rigMint = attachCartoonDuckFeatures(mint, '02-mint');

  assert.ok(rigClassic.eyeL && rigClassic.eyeR);
  assert.ok(rigClassic.inkOutline && rigClassic.inkOutline.visible === true);
  assert.ok(rigClassic.stickerOutline && rigClassic.stickerOutline.visible === false);
  assert.ok(classic.getObjectByName('DuckBeautyMark'), '01-classic must carry its intentional left-cheek mole');
  assert.equal(mint.getObjectByName('DuckBeautyMark'), undefined, 'non-classic ducks should not copy classic mole');

  setDuckStickerHighlight(rigClassic, true);
  assert.equal(rigClassic.stickerOutline.visible, true);
  setDuckStickerHighlight(rigClassic, false);
  assert.equal(rigClassic.stickerOutline.visible, false);
});
