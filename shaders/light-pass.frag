precision highp float;

#define MAX_OCCLUDERS 16

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

void toLocal(in vec3 p, in mat4 matrix, inout vec3 newP)
{
	float a = matrix[0][0], b = matrix[0][1], c = matrix[0][2];
	float d = matrix[1][0], e = matrix[1][1], f = matrix[1][2];
	float g = matrix[2][0], h = matrix[2][1], j = matrix[2][2];
	float k = matrix[3][0], l = matrix[3][1], m = matrix[3][2];

	newP.x = a*p.x + b*p.y + c*p.z + (a*-k + b*-l + c*-m);
	newP.y = d*p.x + e*p.y + f*p.z + (d*-k + e*-l + f*-m);
	newP.z = g*p.x + h*p.y + j*p.z + (g*-k + h*-l + j*-m);
}

float calcAO(vec3 pos, float sphereID)
{
	if (sphereID < 0.0) {
		return 1.0;
	}

	float ao = 0.0;

	float texWidth = uOccludersTextureSize.x;
	float texHeight = uOccludersTextureSize.y;

	float yOcc = floor(sphereID / texWidth);
	float xOcc = sphereID - (yOcc * texWidth);

	vec2 uvOccluders;
	uvOccluders.x = (xOcc + 0.5) / texWidth;

	vec3 localPos;
	toLocal(pos, uModelViewMatrix, localPos);

	for(int i = 0; i < MAX_OCCLUDERS; i++)
	{
		float yo = float(i + (int(yOcc) * MAX_OCCLUDERS));
		uvOccluders.y = (yo + 0.5) / texHeight;

		vec4 sphere = texture2D(uOccludersTexture, uvOccluders);

		if(int(sphere.w) == 0)
			break;

		vec3 dir = sphere.xyz - localPos;
		float len = length(dir);
		float sphereLen = sphere.w / (len + 0.05); // add .05 hack to fix flickering

		ao += 1.0 - sqrt(1.0 - (sphereLen * sphereLen));
	}

	return clamp(1.0 - (ao * uAOIntensity), 0.0, 1.0);
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

	float ao = calcAO(positionTexel.xyz, positionTexel.w);

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

		if (NdotL > 0.0)
		{
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
