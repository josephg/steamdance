precision mediump float;
uniform sampler2D tile;
varying vec2 tilexy;

/* I generated the colors from here: http://www.cssportal.com/css-color-converter/
function round(x) { return Math.floor(x * 1000) / 1000; }
function rgb(r, g, b) { console.log("vec4(" + round(r/255) + ", " + round(g/255) + ", " + round(b/255) + ", 1)");}
 */
void main(void) {
  ivec3 v = ivec3(texture2D(tile, tilexy) * 256.0);
  int t = v.r;
  bool neg = (t >= 0x80);
  if (neg) t -= 0x80;

  bool pos = (t >= 0x40);
  if (pos) t -= 0x40;

  vec4 color =
    (t == 0) ? // solid
      vec4(0.035, 0.098, 0.105, 1) :
    (t == 1) ? // nothing
      vec4(1,1,1, 1) :
    (t == 2) ? // thinsolid
      vec4(0.709, 0.709, 0.709, 1) :
    (t == 3) ? // positive
      vec4(0.36, 0.8, 0.36, 1) :
    (t == 4) ? // negative
      vec4(0.839, 0.341, 0.16, 1) :
    (t == 5) ? // bridge
      vec4(0.101, 0.494, 0.835, 1) :
    (t == 6) ? // Ribbon
      vec4(0.725, 0.235, 0.682, 1) :
    (t == 7) ? // Ribbonbridge
      vec4(0.423, 0.117, 0.85, 1)
    :
      vec4(1, 0.411, 0.705, 1); // hotpink for anything else.

  gl_FragColor =
    neg ? color * 0.8 + vec4(0.2, 0, 0, 0.2) :
    pos ? color * 0.8 + vec4(0, 0.2, 0, 0.2) :
    color;

  // gl_FragColor = vec4(tilexy.xyx, 1);
}
