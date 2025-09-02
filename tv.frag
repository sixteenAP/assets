#version 330 core
in vec2 v_TexCoord; // если есть, иначе используйте fragCoord/u_resolution
out vec4 FragColor;

uniform sampler2D u_Texture;
uniform vec2 u_resolution;
uniform vec4 u_rect; // x, y, w, h (в пикселях)
uniform float u_time;
uniform float u_strength;      // 0.0..1.0
uniform float u_scanIntensity; // 0.0..1.0
uniform float u_chroma;        // примерно 0.5..2.0 (в пикселях)

vec2 toUV(vec2 px){
    return px / u_resolution;
}

float ease(float x){
    return x*x*(3.0-2.0*x);
}

vec4 sampleChromatic(sampler2D tex, vec2 uv, vec2 off){
    // смещаем R,G,B по-разному
    vec3 c;
    c.r = texture(tex, uv + off * 1.0).r;
    c.g = texture(tex, uv).g;
    c.b = texture(tex, uv - off * 1.0).b;
    return vec4(c,1.0);
}

void main(){
    // координаты в пикселях
    vec2 fragPx = gl_FragCoord.xy;
    // тест попадания в прямоугольник
    vec2 rMin = u_rect.xy;
    vec2 rMax = u_rect.xy + u_rect.zw;
    if( fragPx.x < rMin.x || fragPx.x > rMax.x || fragPx.y < rMin.y || fragPx.y > rMax.y ){
        // вне области — обычный вывод
        FragColor = texture(u_Texture, toUV(fragPx));
        return;
    }

    // локальные координаты внутри rect, центр в (0,0), нормированные по половинам
    vec2 center = (rMin + rMax) * 0.5;
    vec2 half = u_rect.zw * 0.5;
    vec2 local = (fragPx - center) / half; // теперь x,y в [-1,1]
    // корректируем по аспекту rect, чтобы искажение было круглым по отношению к области
    local.x *= u_rect.z / u_rect.w;

    // радиус (0..~1.4)
    float r = length(local);
    // знак по вертикали: +1 если выше центра (y>0), -1 если ниже
    float signY = local.y >= 0.0 ? 1.0 : -1.0;

    // эффект выпуклости: модифицируем Y компонент сильнее, X чуть поменьше
    float fall = ease(clamp(r, 0.0, 1.0)); // сглаживание по радиусу
    float strength = clamp(u_strength, 0.0, 1.5);

    // коэффициенты: y изменяем с учётом signY, x — обычная бочкообразность
    float kx = 1.0 + 0.25 * strength * fall * r;
    float ky = 1.0 + 0.8 * strength * fall * r * signY;

    vec2 distortedLocal = vec2(local.x * kx, local.y * ky);

    // вернуть x аспект назад
    distortedLocal.x /= (u_rect.z / u_rect.w);

    // из локальных в пиксели, затем в UV texture
    vec2 distortedPx = center + distortedLocal * half;
    vec2 uv = toUV(distortedPx);

    // хроматическая аберрация: оффсет в UV (переводим px->uv)
    vec2 offUV = vec2(u_chroma / u_resolution.x, 0.0); // по горизонтали
    vec4 color = sampleChromatic(u_Texture, uv, offUV);

    // сканлайны (вертикальная ориентация как в старых телевизорах)
    float scanFreq = 800.0 * (u_rect.w / u_resolution.x); // подгон по ширине
    float scan = sin((fragPx.y + u_time * 40.0) * (scanFreq / u_resolution.y) * 2.0 * 3.14159);
    float scanMod = 1.0 - u_scanIntensity * 0.15 * (0.5 + 0.5 * scan);

    // старение — шум/зерно
    float noise = (fract(sin(dot(fragPx.xy ,vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.02;

    // виньетка по краям области
    float vign = 1.0 - 0.6 * fall * r;

    color.rgb *= scanMod * vign + noise;

    // гамма лёгкая коррекция
    color.rgb = pow(color.rgb, vec3(1.0/1.1));

    FragColor = color;
}
