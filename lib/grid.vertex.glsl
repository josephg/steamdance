attribute vec2 pos;

uniform mat3 proj;

varying vec2 tilexy;

void main(void) {
  tilexy = pos;
  gl_Position = vec4((vec3(pos, 1) * proj).xy, 0, 1);
}
