precision highp float;

#define MAX_OCCLUDERS 64

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelViewMatrix;

uniform int uRenderMode;
uniform vec3 uLightPos;
uniform float uAOIntensity;
uniform vec2 uOccludersTextureSize;

uniform sampler2D uDepthTexture;
uniform sampler2D uPositionTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uColorTexture;
uniform sampler2D uOccludersTexture;

varying vec2 vTexCoords;

// http://iquilezles.org/www/articles/sphereao/sphereao.htm
float sphereOcclusion(vec3 pos, vec3 normal, vec4 sphere)
{
    vec3 r = sphere.xyz - pos;
    float l = length(r);
    float d = dot(normal, r);
    float res = d;

    if (d < sphere.w) {
        res = pow(clamp((d + sphere.w) / (2.0 * sphere.w), 0.0, 1.0), 1.5) * sphere.w;
    }
    
    return clamp(res * (sphere.w * sphere.w) / (l * l * l), 0.0, 1.0);
}

float calcAO(vec3 pos, vec3 normal, float sphereID)
{
    if (sphereID < 0.0) {
        return 1.0;
    }

    float ao = 1.0;

    float texWidth = uOccludersTextureSize.x;
    float texHeight = uOccludersTextureSize.y;

    float yOcc = floor(sphereID / texWidth);
    float xOcc = sphereID - (yOcc * texWidth);

    vec2 uvOccluders;
    uvOccluders.x = (xOcc + 0.5) / texWidth;

    for (int i = 0; i < MAX_OCCLUDERS; i++) {
        float yo = float(i + (int(yOcc) * MAX_OCCLUDERS));
        uvOccluders.y = (yo + 0.5) / texHeight;

        vec4 sphere = texture2D(uOccludersTexture, uvOccluders);

        if (int(sphere.w) == 0) {
            break;
        }

        vec4 sphereEyePosition = uModelViewMatrix * vec4(sphere.xyz, 1.0);
        
        ao *= 1.0 - uAOIntensity * sphereOcclusion(pos, normal, vec4(sphereEyePosition.xyz, sphere.w));
    }

    return clamp(ao, 0.0, 1.0);
}

void main()
{
    vec4 positionTexel = texture2D(uPositionTexture, vTexCoords);

    if(positionTexel.xyz == vec3(1.0)) {
        discard;
    }

    vec4 diffuseTexel = texture2D(uColorTexture, vTexCoords);
    vec4 normalTexel = texture2D(uNormalTexture, vTexCoords);

    vec3 color = vec3(0.0);

    vec3 n = normalize(normalTexel.xyz);

    float ao = calcAO(positionTexel.xyz, n, positionTexel.w);

    vec3 l = normalize(uLightPos - positionTexel.xyz);
    float NdotL = max(0.0, dot(n, l));

    /*
    A way to show each stage of the rendering for demo
    1: positions
    2: normals
    3: colours
    4: ao
    5: ao + colour
    6: phong but no shadows
    */
    if (uRenderMode == 1) {
        color = positionTexel.xyz;
    } else if (uRenderMode == 2) {
        color = normalTexel.xyz;
    } else if (uRenderMode == 3) {
        color = diffuseTexel.xyz;
    } else if (uRenderMode == 4) {
        color = vec3(ao);
        color = pow(color, vec3(0.45));
    } else if (uRenderMode == 5) {
        color = diffuseTexel.xyz * 0.8 * (normalTexel.z * 0.5 + 1.0) * ao;
        color = pow(color, vec3(0.45));
    } else {
        color += diffuseTexel.xyz * 0.2 * (normalTexel.z * 0.5 + 1.0) * ao;

        if (NdotL > 0.0) {
            color += diffuseTexel.xyz * 0.5 * NdotL;

            vec3 v = normalize(-positionTexel.xyz);
            vec3 r = normalize(-reflect(l, n));
            float RdotV = max(0.0, dot(r, v));

            color += 1.0 * 0.7 * pow(RdotV, 100.0);
        }

        color = pow(color, vec3(0.45));
    }

    gl_FragColor = vec4(color, 1.0);
}
