precision highp float;

uniform sampler2D uDepthTexture;
uniform sampler2D uPositionTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uColorTexture;

varying vec2 vTexCoords;

void main()
{
    gl_FragColor = vec4(texture2D(uColorTexture, vTexCoords).xyz, 1.0);
}
