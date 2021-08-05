#extension GL_EXT_draw_buffers : enable

precision highp float;

uniform vec3 uColour;

varying vec3 vPosition;

void main(void)
{
    gl_FragData[0] = vec4(vec3(0.0, 1.0, 0.0), 1.0); // todo
    gl_FragData[1] = vec4(vPosition, -1.0);
    gl_FragData[2] = vec4(uColour, 1.0);
}
