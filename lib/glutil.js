
// Type is gl.FRAGMENT_SHADER or gl.VERTEX_SHADER
function compile(gl, type, code) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, code);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
}

exports.compileProgram = function compileProgram(gl, uniformNames, attrNames, source) {
  const program = gl.createProgram();

  const vert = compile(gl, gl.VERTEX_SHADER, source.vertex);
  const frag = compile(gl, gl.FRAGMENT_SHADER, source.fragment);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.validateProgram(program);
  let message = gl.getProgramInfoLog(program);
  if (message) console.warn(message);
  //gl.useProgram(program);

  const uniforms = {};
  if (uniformNames) uniformNames.forEach(u => {
    uniforms[u] = gl.getUniformLocation(program, u);
  });

  const attrs = {};
  if (attrNames) attrNames.forEach(name => {
    attrs[name] = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attrs[name]);
  })

  return {
    program,
    uniforms,
    attrs,
    draw() {

    }

  };
};
