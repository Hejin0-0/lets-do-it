import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
  CONTACT_SHADOW_TEXTURE,
  SURFACE_KINDS,
  TOON_GRADIENT,
  createContactShadow,
  inkedMesh,
  surfaceTexture,
  toonMaterial,
} from './materials.ts';

type TextureImage = { data: Uint8Array; width: number; height: number };

describe('painted toon materials', () => {
  it('uses a five-band nearest-filtered non-color toon ramp', () => {
    const image = TOON_GRADIENT.image as TextureImage;

    assert.equal(image.width, 5);
    assert.equal(image.height, 1);
    assert.equal(image.data.length, 5);
    assert.equal(TOON_GRADIENT.minFilter, THREE.NearestFilter);
    assert.equal(TOON_GRADIENT.magFilter, THREE.NearestFilter);
    assert.equal(TOON_GRADIENT.colorSpace, THREE.NoColorSpace);
    assert.equal(TOON_GRADIENT.generateMipmaps, false);
  });

  it('shares six filtered deterministic sRGB surface maps', () => {
    assert.deepEqual(SURFACE_KINDS, ['plain', 'wood', 'stone', 'leaf', 'skin', 'soil']);
    const wood = surfaceTexture('wood');
    const stone = surfaceTexture('stone');
    const plain = surfaceTexture('plain');
    const plainImage = plain.image as TextureImage;

    assert.equal(surfaceTexture('wood'), wood);
    assert.equal((wood.image as TextureImage).width, 64);
    assert.equal((wood.image as TextureImage).height, 64);
    assert.equal(wood.colorSpace, THREE.SRGBColorSpace);
    assert.equal(wood.wrapS, THREE.RepeatWrapping);
    assert.equal(wood.wrapT, THREE.RepeatWrapping);
    assert.equal(wood.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(wood.magFilter, THREE.LinearFilter);
    assert.equal(wood.generateMipmaps, true);
    assert.deepEqual(
      SURFACE_KINDS.map((kind) => surfaceTexture(kind).repeat.toArray()),
      [[1, 1], [2, 1], [1, 1], [1, 1], [2, 2], [12, 12]],
    );
    assert.notDeepEqual((wood.image as TextureImage).data, (stone.image as TextureImage).data);
    assert.ok(plainImage.data.every((value) => value === 255));
    const stonePixels = (stone.image as TextureImage).data;
    assert.ok(Math.max(...stonePixels) - Math.min(...stonePixels) <= 32);
    const skinPixels = (surfaceTexture('skin').image as TextureImage).data;
    assert.ok(Math.max(...skinPixels) - Math.min(...skinPixels) <= 20);
  });

  it('paints irregular three-band swaths without four-pixel checker edges', () => {
    for (const kind of ['wood', 'stone'] as const) {
      const { data, width, height } = surfaceTexture(kind).image as TextureImage;
      let edges = 0;
      let gridEdges = 0;
      const bands = new Set<number>();
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const pixel = (y * width + x) * 4;
          bands.add(data[pixel]!);
          if (x > 0 && data[pixel] !== data[pixel - 4]) {
            edges += 1;
            if (x % 4 === 0) gridEdges += 1;
          }
          if (y > 0 && data[pixel] !== data[pixel - width * 4]) {
            edges += 1;
            if (y % 4 === 0) gridEdges += 1;
          }
        }
      }
      assert.ok(edges > 0, `${kind} must not be a flat fallback`);
      assert.ok(gridEdges / edges < 0.55, `${kind} is still aligned to a repeating checker grid`);
      assert.equal(bands.size, 3, `${kind} should keep three deliberate paint values`);
    }
  });

  it('keys shared toon materials by surface and uses the restrained outline default', () => {
    const wood = toonMaterial(0xffffff, { surface: 'wood' });
    const sameWood = toonMaterial(0xffffff, { surface: 'wood' });
    const stone = toonMaterial(0xffffff, { surface: 'stone' });
    const inked = inkedMesh(new THREE.BoxGeometry(1, 1, 1), 0xffffff);
    const outline = inked.children[0];

    assert.equal(wood, sameWood);
    assert.notEqual(wood, stone);
    assert.equal(wood.map, surfaceTexture('wood'));
    assert.equal(outline?.scale.x, 1.025);
    const detail = inkedMesh(new THREE.BoxGeometry(1, 1, 1), 0xffffff, { outline: false });
    assert.equal(detail.children.length, 1);
    assert.equal((detail.children[0] as THREE.Mesh).castShadow, false);
    assert.equal(
      (inkedMesh(new THREE.BoxGeometry(1, 1, 1), 0xffffff, { outline: false, castShadow: true }).children[0] as THREE.Mesh).castShadow,
      true,
    );
    const flame = inkedMesh(new THREE.ConeGeometry(1, 2, 6), 0xe8a83e, { unlit: true });
    const flameFill = flame.children.find((child) => child.userData.inkFill) as THREE.Mesh;
    assert.ok(flameFill.material instanceof THREE.MeshBasicMaterial);
    assert.equal(flameFill.material.toneMapped, false);
  });

  it('adds a compatible cached cool-shadow tint without replacing the toon fallback', () => {
    const material = toonMaterial(0xd7b46a, { surface: 'soil' });
    const sameMaterial = toonMaterial(0xd7b46a, { surface: 'soil' });
    const tint = material.userData.shadowTint as { value?: THREE.Color } | undefined;
    const shader = {
      uniforms: {} as Record<string, unknown>,
      fragmentShader: '#include <lights_toon_pars_fragment>',
    };

    assert.equal(material, sameMaterial);
    assert.ok(tint?.value instanceof THREE.Color);
    assert.ok(tint.value.b > tint.value.r);
    material.onBeforeCompile(shader as never, {} as never);
    assert.equal(shader.uniforms.uShadowTint, tint);
    assert.match(shader.fragmentShader, /celBand/);
    assert.doesNotMatch(shader.fragmentShader, /#include <lights_toon_pars_fragment>/);
    assert.match(material.customProgramCacheKey(), /shadow-tint/);
  });

  it('separates surface families with restrained material-specific shadow hues', () => {
    const tint = (surface: 'wood' | 'stone' | 'leaf' | 'skin') =>
      (toonMaterial(0xffffff, { surface }).userData.shadowTint as { value: THREE.Color }).value;

    assert.notEqual(tint('wood').getHex(), tint('stone').getHex());
    assert.notEqual(tint('leaf').getHex(), tint('skin').getHex());
  });

  it('creates two-triangle elliptical contact shadows with shared assets', () => {
    const wide = createContactShadow(2.4, 1.1);
    const compact = createContactShadow(1.2, 0.6);
    const geometry = wide.geometry;

    assert.equal(wide.geometry, compact.geometry);
    assert.equal(wide.material, compact.material);
    assert.equal(wide.scale.x, 2.4);
    assert.equal(wide.scale.z, 1.1);
    assert.equal(geometry.index?.count, 6);
    assert.equal((wide.material as THREE.MeshBasicMaterial).map, CONTACT_SHADOW_TEXTURE);
    assert.ok((wide.material as THREE.MeshBasicMaterial).opacity >= 0.68);
    assert.equal(CONTACT_SHADOW_TEXTURE.colorSpace, THREE.NoColorSpace);
    const pixels = (CONTACT_SHADOW_TEXTURE.image as TextureImage).data;
    const alphaBands = [...new Set(pixels.filter((_, index) => index % 4 === 3))].sort((a, b) => a - b);
    assert.deepEqual(alphaBands, [0, 48, 104]);
    assert.equal(wide.castShadow, false);
    assert.equal(wide.receiveShadow, false);
  });
});
