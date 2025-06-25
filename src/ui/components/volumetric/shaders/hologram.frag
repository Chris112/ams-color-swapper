// Hologram Fragment Shader
precision highp float;

uniform float time;
uniform bool xrayMode;
uniform vec3 cameraPosition;
uniform float glowIntensity;
uniform sampler2D noiseTexture;

varying vec3 vColor;
varying float vOpacity;
varying vec3 vWorldPos;
varying float vLayer;
varying float vDepth;

// Holographic interference pattern
float interference(vec2 uv, float t) {
  float pattern1 = sin(uv.x * 100.0 + t * 2.0) * sin(uv.y * 100.0 - t * 1.5);
  float pattern2 = sin(length(uv - 0.5) * 50.0 - t * 3.0);
  return mix(pattern1, pattern2, 0.5) * 0.1 + 0.9;
}

// Chromatic aberration effect
vec3 chromaticAberration(vec3 color, vec2 uv, float amount) {
  vec2 offset = vec2(sin(time), cos(time)) * amount;
  vec3 aberrated;
  aberrated.r = color.r * (1.0 + sin(uv.x * 10.0 + time) * amount);
  aberrated.g = color.g;
  aberrated.b = color.b * (1.0 + cos(uv.y * 10.0 + time) * amount);
  return aberrated;
}

// Digital noise/glitch effect
float digitalNoise(vec2 uv, float t) {
  float noise = fract(sin(dot(uv * t, vec2(12.9898, 78.233))) * 43758.5453);
  return step(0.98, noise) * 0.5;
}

void main() {
  vec2 uv = gl_PointCoord;
  
  // Create circular point shape
  float dist = length(uv - 0.5) * 2.0;
  if (dist > 1.0) discard;
  
  // Soft edge falloff
  float alpha = smoothstep(1.0, 0.5, dist) * vOpacity;
  
  // Base color with glow
  vec3 color = vColor;
  
  // Add emission glow
  vec3 glowColor = color * glowIntensity;
  color += glowColor * (1.0 - dist);
  
  // Holographic interference
  float interferenceAmount = interference(gl_FragCoord.xy * 0.01, time);
  color *= interferenceAmount;
  
  // X-ray mode - invert opacity based on depth
  if (xrayMode) {
    alpha *= 0.3;
    color = mix(color, vec3(0.0, 1.0, 1.0), 0.5);
    // Make deeper voxels more visible
    alpha *= (1.0 + vDepth * 0.01);
  }
  
  // Chromatic aberration on edges
  float edgeAmount = smoothstep(0.7, 1.0, dist);
  color = chromaticAberration(color, uv, edgeAmount * 0.02);
  
  // Scanning line effect
  float scanline = sin(gl_FragCoord.y * 0.5 + time * 10.0) * 0.05 + 0.95;
  color *= scanline;
  
  // Digital noise/glitch
  float noise = digitalNoise(gl_FragCoord.xy * 0.001, time);
  color += vec3(0.0, 1.0, 1.0) * noise * 0.5;
  
  // Depth-based fog
  float fogAmount = smoothstep(10.0, 50.0, vDepth);
  color = mix(color, vec3(0.0, 0.05, 0.1), fogAmount * 0.3);
  
  // Edge glow enhancement
  float edgeGlow = pow(dist, 2.0);
  color += vColor * edgeGlow * 0.5;
  
  // HDR-like bloom effect
  float brightness = dot(color, vec3(0.299, 0.587, 0.114));
  if (brightness > 0.8) {
    color += (color - 0.8) * 2.0;
  }
  
  // Final color with premultiplied alpha
  gl_FragColor = vec4(color * alpha, alpha);
}