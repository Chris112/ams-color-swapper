// Hologram Vertex Shader
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform float currentLayer;
uniform float explodeAmount;
uniform vec3 cameraPosition;

attribute vec3 position;
attribute float layer;
attribute vec3 color;
attribute float voxelDensity;

varying vec3 vColor;
varying float vOpacity;
varying vec3 vWorldPos;
varying float vLayer;
varying float vDepth;

// Noise function for holographic distortion
float noise(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.543))) * 43758.5453);
}

void main() {
  vColor = color;
  vLayer = layer;
  
  // Calculate world position
  vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  
  // Apply exploded view offset
  vec3 explodedPos = position;
  if (explodeAmount > 0.0) {
    float layerOffset = (layer - currentLayer) * 0.5;
    explodedPos.y += layerOffset * explodeAmount;
  }
  
  // Holographic displacement effect
  float hologramNoise = noise(position * 10.0 + vec3(time * 2.0));
  vec3 displaced = explodedPos;
  
  // Scanning line effect
  float scanLine = sin(position.y * 50.0 + time * 5.0);
  displaced.x += sin(time * 3.0 + position.y * 20.0) * 0.001;
  displaced.z += cos(time * 2.0 + position.y * 20.0) * 0.001;
  
  // Layer-based opacity with smooth falloff
  float layerDiff = abs(layer - currentLayer);
  float layerOpacity = smoothstep(20.0, 0.0, layerDiff);
  
  // Distance-based opacity
  float distanceFromCamera = length(cameraPosition - position);
  float distanceOpacity = smoothstep(50.0, 10.0, distanceFromCamera);
  
  // Combine opacities
  vOpacity = layerOpacity * voxelDensity * 0.8;
  vOpacity *= (1.0 + scanLine * 0.1);
  
  // Edge glow factor
  vec3 viewDir = normalize(cameraPosition - position);
  float edgeFactor = 1.0 - abs(dot(normalize(position), viewDir));
  vOpacity += edgeFactor * 0.2;
  
  // Store depth for fragment shader
  vDepth = -worldPos.z;
  
  // Final position
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  
  // Point size with perspective scaling
  float perspectiveScale = 300.0 / gl_Position.w;
  gl_PointSize = mix(2.0, 8.0, vOpacity) * perspectiveScale * 0.1;
}