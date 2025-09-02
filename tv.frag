#version 120
uniform sampler2D u_Texture;
uniform vec2 u_resolution;
uniform vec4 u_rect;        // x,y,w,h в пикселях
uniform float u_time;
uniform float u_strength;   // сила выпуклости 0..1
uniform float u_scanIntensity;
uniform float u_chroma;

float ease(float x){
    return x*x*(3.0-2.0*x);
}

vec4 sampleChromatic(sampler2D tex, vec2 uv, vec2 off){
    vec3 c;
    c.r = texture2D(tex, uv + off).r;
    c.g = texture2D(tex, uv).g;
    c.b = texture2D(tex, uv - off).b;
    return vec4(c,1.0);
}

void main(){
    vec2 fragPx = gl_FragCoord.xy;
    vec2 rMin = u_rect.xy;
    vec2 rMax = u_rect.xy + u_rect.zw;

    if( fragPx.x < rMin.x || fragPx.x > rMax.x ||
        fragPx.y < rMin.y || fragPx.y > rMax.y ){
        gl_FragColor = texture2D(u_Texture, fragPx / u_resolution);
        return;
    }

    vec2 center = (rMin + rMax) * 0.5;
    vec2 halfR  = u_rect.zw * 0.5;
    vec2 local  = (fragPx - center) / halfR;

    local.x *= u_rect.z / u_rect.w;

    float r = length(local);
    float signY = local.y >= 0.0 ? 1.0 : -1.0;
    float fall = ease(clamp(r, 0.0, 1.0));
    float kx = 1.0 + 0.25 * u_strength * fall * r;
    float ky = 1.0 + 0.8  * u_strength * fall * r * signY;

    vec2 distorted = vec2(local.x * kx, local.y * ky);
    distorted.x /= (u_rect.z / u_rect.w);

    vec2 uv = (center + distorted * halfR) / u_resolution;

    vec2 offUV = vec2(u_chroma / u_resolution.x, 0.0);
    vec4 color = sampleChromatic(u_Texture, uv, offUV);

    float scan = sin((fragPx.y + u_time*40.0) * 3.14159 / 2.0);
    float scanMod = 1.0 - u_scanIntensity * 0.15 * (0.5 + 0.5 * scan);

    float vign = 1.0 - 0.6 * fall * r;

    float noise = (fract(sin(dot(fragPx.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.02;

    color.rgb *= scanMod * vign + noise;
    color.rgb = pow(color.rgb, vec3(1.0/1.1));

    gl_FragColor = color;
}
