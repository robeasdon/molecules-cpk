precision highp float;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

attribute vec3 aPosition;

varying vec3 vPosition;

void main(void)
{
    vec4 vertexEyePosition = uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);

    vPosition = vertexEyePosition.xyz;

    gl_Position = uProjectionMatrix * vertexEyePosition;
}
