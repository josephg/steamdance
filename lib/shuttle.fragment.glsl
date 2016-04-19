precision mediump float;
uniform vec3 color;

void main(void) {
  // vec4(0.58, 0.16, 0.749, 1);
  gl_FragColor = vec4(color, 1);
}
