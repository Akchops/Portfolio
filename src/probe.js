// Silent WebGL capability probe (webgl-shader-interaction-engineer Gate 1).
// Returns a plain object or null. Never logs, never throws, and releases its
// own context immediately: browsers cap live contexts at roughly 8–16 and drop
// the oldest without telling anyone.

export function probeWebGL({ allowSoftware = false } = {}) {
  // Feature-detect before creating anything. With WebGL disabled by policy
  // this returns at once with no console output.
  if (typeof WebGL2RenderingContext === 'undefined' && typeof WebGLRenderingContext === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const attrs = {
    // A software rasteriser will hand out a context and then draw at a few fps.
    // This makes it report as unsupported so the cheaper tier takes over.
    failIfMajorPerformanceCaveat: !allowSoftware,
    powerPreference: 'high-performance',
    antialias: false, alpha: false, depth: false, stencil: false,
  };

  let gl = null;
  let version = 0;
  try {
    // getContext can throw as well as return null (driver crash, locked-down
    // profile). Catching it is what keeps the console clean.
    gl = canvas.getContext('webgl2', attrs);
    if (gl) version = 2;
    else { gl = canvas.getContext('webgl', attrs); if (gl) version = 1; }
  } catch { return null; }
  if (!gl) return null;

  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  let renderer = '';
  try {
    // Absent in privacy-hardened browsers: "unknown", not a failure.
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
  } catch { /* informational only */ }

  try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ }

  return { version, maxTexture, renderer, tier: assignTier(maxTexture, renderer, allowSoftware) };
}

function assignTier(maxTexture, renderer, allowSoftware) {
  const soft = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  if ((soft && !allowSoftware) || maxTexture < 4096) return 'low';
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 4 || cores <= 4 || maxTexture < 8192) return 'medium';
  return 'high';
}

// QA switches, read from the query string. Not linked anywhere.
//   ?gl=force  accept software WebGL (GPU-less capture machines)
//   ?tier=2    force the Canvas 2D tier of the Lab shader
//   ?static    force every signature moment to its static tier
export const qa = (() => {
  try {
    const q = new URLSearchParams(location.search);
    return { glForce: q.get('gl') === 'force', tier2: q.get('tier') === '2', static: q.has('static') };
  } catch { return { glForce: false, tier2: false, static: false }; }
})();
