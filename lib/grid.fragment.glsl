precision mediump float;

uniform sampler2D tile;
uniform sampler2D pressure;

uniform highp int psize;

varying vec2 tilexy;

void main(void) {
  ivec3 v = ivec3(texture2D(tile, tilexy) * 256.0);
  int t = v.r;

  vec4 color =
    (t == 0) ? // solid
      vec4(0.035,0.098,0.105, 1) :
    (t == 1) ? // nothing
      vec4(1,1,1, 1) :
    (t == 2) ? // thinsolid
      vec4(0.709,0.709,0.709, 1) :
    (t == 3) ? // positive
      vec4(0.36,0.8,0.36, 1) :
    (t == 4) ? // negative
      vec4(0.839,0.341,0.16, 1) :
    (t == 5) ? // bridge
      vec4(0.18,0.588,0.839, 1)
    :
      vec4(1,0,0,1);

  highp int pid = v.g * 256 + v.b;
  int p = (pid == 0) ? 0 : int(texture2D(pressure, vec2(float(pid) / float(psize))).r * 256.0);

  gl_FragColor = (p == 0) ? color :
    (p == 1) ? color * 0.8 + vec4(0.2, 0, 0, 0.2) :
    (p == 2) ? color * 0.8 + vec4(0, 0.2, 0, 0.2) :
    vec4(1,0,0,1);

  // gl_FragColor = vec4(tilexy.xyx, 1);
}
