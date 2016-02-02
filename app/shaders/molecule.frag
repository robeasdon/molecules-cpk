#extension GL_EXT_frag_depth : enable
#extension GL_EXT_draw_buffers : enable

precision highp float;

uniform mat4 uProjectionMatrix;

uniform float uRadius;
uniform float uAtomId;
uniform vec3 uColour;

varying vec3 vPosition;
varying vec3 vSpherePosition;

vec3 intersectSphere(vec3 center, float radius, vec3 pos) {
    float a = dot(pos, pos);
    float b = 2.0 * dot(pos, center);
    float c = dot(center, center) - radius * radius;
    float discriminant = b * b - 4.0 * a * c;

    if(discriminant <= 0.0) {
        discard;
    }

    float t = (b - sqrt(discriminant)) / (2.0 * a);

    return t * pos;
}

float fragDepthFromEyePos(vec3 eyePos) {
    float far = gl_DepthRange.far;
    float near = gl_DepthRange.near;
    vec4 clipSpacePos = uProjectionMatrix * vec4(eyePos, 1.0);
    float ndcDepth = clipSpacePos.z / clipSpacePos.w;

    return (((far - near) * ndcDepth) + near + far) / 2.0;
}

vec3 sphereNormal(vec3 pos, vec3 spherePos, float rad)
{
    return (pos - spherePos) / rad;
}

void main(void)
{
    vec3 surface = intersectSphere(vSpherePosition, uRadius, vPosition);
    vec3 n = sphereNormal(surface, vSpherePosition, uRadius);

    gl_FragData[0] = vec4(n, 1.0);
    gl_FragData[1] = vec4(surface, uAtomId);
    gl_FragData[2] = vec4(uColour, 1.0);
    gl_FragDepthEXT = fragDepthFromEyePos(surface);
}
