attribute vec2 pos;

uniform mat3 proj;

void main(void) {
  gl_Position = vec4((vec3(pos, 1) * proj).xy, 0, 1);
}
