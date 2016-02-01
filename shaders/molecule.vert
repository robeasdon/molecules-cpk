precision highp float;

uniform vec3 uInstancePosition;
uniform float uRadius;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

attribute vec3 aPosition;

varying vec3 vPosition;
varying vec3 vSpherePosition;

void main(void)
{
    vec3 pos = uInstancePosition + (aPosition * uRadius);

    mat4 mvMatrix = uViewMatrix * uModelMatrix;

    vec4 vertexEyePosition = mvMatrix * vec4(pos, 1.0);
    vec4 sphereEyePosition = mvMatrix * vec4(uInstancePosition, 1.0);

    vPosition = vertexEyePosition.xyz;
    vSpherePosition = sphereEyePosition.xyz;

    gl_Position = uProjectionMatrix * vertexEyePosition;
}
