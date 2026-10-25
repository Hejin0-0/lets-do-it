// Dimensions of the authored Blender kit, in metres. Conversion happens exactly once at asset build time.
export const POOL_KIT = { inner: [7.4, 4.4], rim: 1.245, floor: 0.20, stepX: -2.1, stepWidth: 1.65,
  steps: [[1.00, .35], [1.36, .61], [1.72, .87]], stepDepth: .37 };
export const BOWL_KIT = { scale: .5, base: .53,
  inner: [[.32,.10],[.60,.20],[1.10,.48],[1.63,.88],[1.82,1.22],[1.86,1.34]] };
export function bowlHeight(radius) {
  const p = BOWL_KIT.inner, r = radius / BOWL_KIT.scale;
  let i = 1; while (i < p.length - 1 && p[i][0] < r) i++;
  const [a,b] = [p[i-1],p[i]], t = Math.max(0,Math.min(1,(r-a[0])/(b[0]-a[0])));
  return BOWL_KIT.base + (a[1]+(b[1]-a[1])*t)*BOWL_KIT.scale;
}
