import{i as e}from"./util-Chq8S4bF.js";import{n as t,t as n}from"./probe-DND7qpL-.js";var r=.14,i=.17;async function a(r){if(e()||t.static)return;let i=r.querySelector(`.pp__still`);try{await i.decode()}catch{return}let a=t.tier2?null:n({allowSoftware:t.glForce}),o=!!a&&a.tier!==`low`,s=i;if(o&&`createImageBitmap`in window)try{s=await createImageBitmap(i)}catch{s=i}let c=o&&u(r,s,i)||f(r,i);c&&(r.dataset.tier=c)}function o(e,t){let n={x:.5,y:.5,tx:.5,ty:.5,speed:0,tSpeed:0,dx:0,dy:0,active:0,tActive:0},i=t=>{let n=e.getBoundingClientRect();return[(t.clientX-n.left)/n.width,(t.clientY-n.top)/n.height]};e.addEventListener(`pointerenter`,e=>{let[r,a]=i(e);n.active<.01&&(n.x=n.tx=r,n.y=n.ty=a),n.tActive=1,t()}),e.addEventListener(`pointermove`,e=>{let[r,a]=i(e),o=r-n.tx,s=a-n.ty,c=Math.hypot(o,s);n.tSpeed=Math.min(1,c/.05),c>5e-4&&(n.dx=o/c,n.dy=s/c),n.tx=r,n.ty=a,n.tActive=1,t()}),e.addEventListener(`pointerdown`,e=>{let[r,a]=i(e);e.pointerType!==`mouse`&&(n.x=n.tx=r,n.y=n.ty=a),n.tActive=1,t()});let a=()=>{n.tActive=0,n.tSpeed=0,t()};return e.addEventListener(`pointerleave`,a),e.addEventListener(`pointercancel`,a),e.addEventListener(`pointerup`,e=>{e.pointerType!==`mouse`&&a()}),n.step=()=>(n.x+=(n.tx-n.x)*r,n.y+=(n.ty-n.y)*r,n.speed+=(n.tSpeed-n.speed)*(n.tSpeed>n.speed?.3:.1),n.tSpeed*=.86,n.active+=(n.tActive-n.active)*.12,Math.abs(n.tx-n.x)+Math.abs(n.ty-n.y)>5e-4||n.speed>.002||Math.abs(n.tActive-n.active)>.002),n}function s(e){let t=0,n=()=>{t=0,e()&&(t=requestAnimationFrame(n))};return()=>{t||(t=requestAnimationFrame(n))}}var c=`
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  // One triangle spanning -1..3 overshoots the viewport on two sides, so its
  // UVs are exactly 0..1 across the visible area, with no diagonal seam.
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,l=`
#ifdef GL_ES
precision highp float;   // mediump bands visibly across the lens falloff on phones
#endif
varying vec2 vUv;

uniform sampler2D uTex;  // the screenshot, uploaded with Y flipped
uniform vec2  uMouse;    // pointer in UV space (0..1, y up), damped in JS
uniform float uAspect;   // canvas width / height
uniform float uRadius;   // lens radius in units of the canvas height
uniform float uSpeed;    // 0..1 damped pointer speed
uniform vec2  uDir;      // damped unit direction of travel, UV space, y up
uniform float uActive;   // 0..1, eases in when the pointer arrives, out when it leaves
uniform vec3  uEmber;    // #FF4D1C as 0..1 rgb

// The texture is stored top row first (uploaded unflipped, see mount()), while
// vUv runs bottom to top. Flipping V here is what keeps the screenshot upright,
// whichever source the upload used.
vec4 tex(vec2 uv) { return texture2D(uTex, vec2(uv.x, 1.0 - uv.y)); }

void main() {
  // Offset from the pointer in aspect-corrected units (x scaled by the aspect)
  // so the lens is a circle, not an ellipse stretched by the canvas shape.
  vec2 p = (vUv - uMouse) * vec2(uAspect, 1.0);
  float d = length(p);

  // Compact smooth falloff: 1 at the pointer, 0 at uRadius, with value, slope
  // and curvature all reaching zero at the boundary. No plateau and no visible
  // ring where the lens ends (known-traps #2). Scaled by uActive so the lens
  // grows in and shrinks out instead of popping.
  float x = clamp(1.0 - (d * d) / (uRadius * uRadius), 0.0, 1.0);
  float fall = x * x * x * uActive;

  // Magnify: sample closer to the pointer than this pixel really is. 0.3 at
  // the centre is a 1.43x lens; it tapers to 1x at the rim with the falloff.
  vec2 lens = p * fall * 0.3;

  // Smear: pull samples back along the direction of travel, so the content
  // trails behind a moving pointer. Zero when the pointer is still.
  vec2 smear = uDir * vec2(uAspect, 1.0) * fall * uSpeed * 0.07;

  // Back to plain UV space (undo the aspect correction on x).
  vec2 uv = vUv - (lens + smear) / vec2(uAspect, 1.0);

  // Chromatic split along the radial direction, only where the surface is
  // moving: a small fixed amount while the lens is active plus a speed term.
  // Above ~0.008 UV it stops reading as speed and reads as a broken display.
  vec2 dir = d > 0.0001 ? (p / d) / vec2(uAspect, 1.0) : vec2(0.0);   // guarded: no NaN at the centre
  float ca = fall * (0.0015 + uSpeed * 0.006);
  vec3 col = vec3(
    tex(uv + dir * ca).r,
    tex(uv).g,
    tex(uv - dir * ca).b
  );

  // Ember duotone inside the lens: luminance (Rec. 709 weights) remapped from
  // a dark ember to full ember, so light UI strokes turn Ember and dark
  // surfaces turn a deep ember-black. A remap, not an added glow.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 duo = uEmber * (0.18 + 0.95 * lum);
  // Tint follows the falloff, a little stronger while moving.
  float tint = fall * (0.55 + 0.35 * uSpeed);
  gl_FragColor = vec4(mix(col, duo, clamp(tint, 0.0, 1.0)), 1.0);
}`;function u(e,t,n){let r=document.createElement(`canvas`);r.className=`pp__canvas`,r.setAttribute(`aria-hidden`,`true`);let a;try{a=r.getContext(`webgl`,{alpha:!1,antialias:!1,depth:!1,premultipliedAlpha:!1})}catch{return null}if(!a)return null;let u=d(a,c,l);if(!u)return null;a.useProgram(u);let p=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,p),a.bufferData(a.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),a.STATIC_DRAW);let m=a.getAttribLocation(u,`aPos`);a.enableVertexAttribArray(m),a.vertexAttribPointer(m,2,a.FLOAT,!1,0,0);let h=a.createTexture();a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,h),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,!1);try{a.texImage2D(a.TEXTURE_2D,0,a.RGBA,a.RGBA,a.UNSIGNED_BYTE,t)}catch{return null}let g={};for(let e of[`uTex`,`uMouse`,`uAspect`,`uRadius`,`uSpeed`,`uDir`,`uActive`,`uEmber`])g[e]=a.getUniformLocation(u,e);a.uniform1i(g.uTex,0),a.uniform1f(g.uRadius,i),a.uniform3f(g.uEmber,1,77/255,28/255);let _=!0,v=()=>{let t=Math.min(window.devicePixelRatio||1,2),n=e.getBoundingClientRect(),i=Math.max(1,Math.round(n.width*t)),o=Math.max(1,Math.round(n.height*t));(r.width!==i||r.height!==o)&&(r.width=i,r.height=o,a.viewport(0,0,i,o))},y=o(e,()=>x()),b=()=>{if(!_)return!1;let e=y.step();return v(),a.uniform2f(g.uMouse,y.x,1-y.y),a.uniform1f(g.uAspect,r.width/r.height),a.uniform1f(g.uSpeed,y.speed),a.uniform2f(g.uDir,y.dx,-y.dy),a.uniform1f(g.uActive,y.active),a.drawArrays(a.TRIANGLES,0,3),e},x=s(b);return r.addEventListener(`webglcontextlost`,t=>{t.preventDefault(),_=!1,r.remove(),f(e,n),e.dataset.tier=`canvas2d`},!1),new ResizeObserver(()=>x()).observe(e),b(),e.appendChild(r),`webgl`}function d(e,t,n){let r=(t,n)=>{let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)},i=r(e.VERTEX_SHADER,t),a=r(e.FRAGMENT_SHADER,n);if(!i||!a)return null;let o=e.createProgram();return e.attachShader(o,i),e.attachShader(o,a),e.linkProgram(o),e.deleteShader(i),e.deleteShader(a),e.getProgramParameter(o,e.LINK_STATUS)?o:null}function f(e,t){let n=document.createElement(`canvas`);n.className=`pp__canvas`,n.setAttribute(`aria-hidden`,`true`);let r=n.getContext(`2d`,{alpha:!1});if(!r)return null;let a=()=>{let t=Math.min(window.devicePixelRatio||1,2),r=e.getBoundingClientRect(),i=Math.max(1,Math.round(r.width*t)),a=Math.max(1,Math.round(r.height*t));(n.width!==i||n.height!==a)&&(n.width=i,n.height=a)},c=o(e,()=>u()),l=()=>{let e=c.step();a();let o=n.width,s=n.height;if(r.globalCompositeOperation=`source-over`,r.globalAlpha=1,r.drawImage(t,0,0,o,s),c.active>.01){let e=i*s*.8*c.active,n=c.x*o,a=c.y*s,l=1.3,u=-c.dx*c.speed*e*.35,d=-c.dy*c.speed*e*.35;r.save(),r.beginPath(),r.arc(n,a,e,0,Math.PI*2),r.clip(),r.translate(n+u,a+d),r.scale(l,l),r.drawImage(t,-n,-a,o,s),r.restore(),r.save(),r.beginPath(),r.arc(n,a,e,0,Math.PI*2),r.clip(),r.globalCompositeOperation=`color`,r.globalAlpha=.85,r.fillStyle=`#FF4D1C`,r.fillRect(n-e,a-e,e*2,e*2),r.restore()}return e},u=s(l);return new ResizeObserver(()=>u()).observe(e),l(),e.appendChild(n),`canvas2d`}export{a as mount};