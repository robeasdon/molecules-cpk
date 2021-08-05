precision highp float;

uniform vec3 uInstancePosition;
uniform float uCellSize;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

attribute vec3 aPosition;

varying vec3 vPosition;

void main()
{
    vec3 pos = uInstancePosition + (aPosition * uCellSize);
    vec4 vertexEyePosition = uViewMatrix * uModelMatrix * vec4(pos, 1.0);

    vPosition = vertexEyePosition.xyz;

    gl_Position = uProjectionMatrix * vertexEyePosition;
}
