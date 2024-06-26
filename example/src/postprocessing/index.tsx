import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  Camera,
  Color,
  DepthTexture,
  Float32BufferAttribute,
  FogExp2,
  GLSL3,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RawShaderMaterial,
  ShaderChunk,
  Texture,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import Background from './background';

ShaderChunk.normal_pars_fragment += /* glsl */`
#ifdef USE_OUTPUT_NORMAL
layout(location = 1) out vec4 pc_fragNormal;
varying vec3 fragNormal;
#endif
`;
ShaderChunk.emissivemap_fragment += /* glsl */`
#ifdef USE_OUTPUT_NORMAL
pc_fragNormal = vec4(normal, 0.0);
#endif
`;

class RenderBufferGeometry extends BufferGeometry {
	constructor() {
		super();
		this.setAttribute('position', new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
		this.setAttribute('uv', new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
	}
}

class RenderBufferMaterial extends RawShaderMaterial {
  private static readonly vertexShader = /* glsl */`
    precision mediump float;

    uniform mat4 projectionMatrix;

    in vec3 position;
    in vec2 uv;

    out vec2 vUV;

    void main()	{
      vUV = uv;
      gl_Position = projectionMatrix * vec4(position, 1.0);
    }
  `;

  private static readonly fragmentShader = /* glsl */`
    precision mediump float;
  
    uniform sampler2D backgroundTexture;
    uniform sampler2D colorTexture;
    uniform sampler2D depthTexture;
    uniform sampler2D normalTexture;
    uniform vec2 resolution;

    in vec2 vUV;
    out vec4 color;

    float perspectiveDepthToViewZ(const in float depth) {
      const float near = 0.1;
      const float far = 1000.0;
      return (near * far) / ((far - near) * depth - far);
    }

    vec3 SobelSample(const in sampler2D tex, const in vec2 uv, const in vec3 offset) {
      vec3 pixelCenter = texture(tex, uv).rgb;
      vec3 pixelLeft   = texture(tex, uv - offset.xz).rgb;
      vec3 pixelRight  = texture(tex, uv + offset.xz).rgb;
      vec3 pixelUp     = texture(tex, uv + offset.zy).rgb;
      vec3 pixelDown   = texture(tex, uv - offset.zy).rgb;
      return (
        abs(pixelLeft    - pixelCenter)
        + abs(pixelRight - pixelCenter)
        + abs(pixelUp    - pixelCenter)
        + abs(pixelDown  - pixelCenter)
      );
    }

    float SobelSampleDepth(const in sampler2D tex, const in vec2 uv, const in vec3 offset) {
      float pixelCenter = perspectiveDepthToViewZ(texture(tex, uv).x);
      float pixelLeft   = perspectiveDepthToViewZ(texture(tex, uv - offset.xz).x);
      float pixelRight  = perspectiveDepthToViewZ(texture(tex, uv + offset.xz).x);
      float pixelUp     = perspectiveDepthToViewZ(texture(tex, uv + offset.zy).x);
      float pixelDown   = perspectiveDepthToViewZ(texture(tex, uv - offset.zy).x);
      return (
        abs(pixelLeft    - pixelCenter)
        + abs(pixelRight - pixelCenter)
        + abs(pixelUp    - pixelCenter)
        + abs(pixelDown  - pixelCenter)
      );
    }

    float edge(const in vec2 uv) {
      const float depthBias = 1.0;
      const float depthScale = 1.0;
      const float normalBias = 1.0;
      const float normalScale = 1.0;

      vec3 offset = vec3((1.0 / resolution.x), (1.0 / resolution.y), 0.0);
      float sobelDepth = SobelSampleDepth(depthTexture, uv, offset);
      sobelDepth = pow(clamp(sobelDepth, 0.0, 1.0) * depthScale, depthBias);
      vec3 sobelNormalVec = SobelSample(normalTexture, uv, offset);
      float sobelNormal = sobelNormalVec.x + sobelNormalVec.y + sobelNormalVec.z;
      sobelNormal = pow(sobelNormal * normalScale, normalBias);
      return clamp(max(sobelDepth, sobelNormal), 0.0, 1.0);
    }

    vec4 sRGBTransferOETF(in vec4 value) {
      return vec4(mix(pow(value.rgb, vec3( 0.41666 )) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);
    }

    const float fogDensity = 0.015;

    void main()	{
      float depth = texture(depthTexture, vUV).x;
      float viewZ = perspectiveDepthToViewZ(depth);
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * viewZ * viewZ);

      vec4 blur;
      blur = texture(colorTexture, vUV);
      blur += texture(colorTexture, vUV + vec2(1.0, 1.0) / resolution);
      blur += texture(colorTexture, vUV + vec2(1.0, -1.0) / resolution);
      blur += texture(colorTexture, vUV + vec2(-1.0, 1.0) / resolution);
      blur += texture(colorTexture, vUV + vec2(-1.0, -1.0) / resolution);
      blur.rgb /= 5.0;

      vec3 background = texture(backgroundTexture, vUV).rgb;
      color = texture(colorTexture, vUV);
      color = mix(color, blur, fogFactor);
      color = mix(color, vec4(background, 1.0), fogFactor);
      color = mix(color, vec4(1.0, 1.0, 1.0, 1.0), edge(vUV) * (1.0 - fogFactor) * 0.15);

      color = sRGBTransferOETF(color);

      gl_FragDepth = depth;
    }
  `;

  constructor(backgroundTexture: Texture, colorTexture: Texture, depthTexture: DepthTexture, normalTexture: Texture) {
		super({
      glslVersion: GLSL3,
      uniforms: {
        backgroundTexture: { value: backgroundTexture },
        colorTexture: { value: colorTexture },
        depthTexture: { value: depthTexture },
        normalTexture: { value: normalTexture },
        resolution: { value: new Vector2() },
      },
      vertexShader: RenderBufferMaterial.vertexShader,
      fragmentShader: RenderBufferMaterial.fragmentShader,
    });
	}
}

class RenderBuffer extends Mesh {
  private static readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private static readonly geometry = new RenderBufferGeometry();
  private readonly background: Background;
  private readonly fog: FogExp2;
  private readonly target: WebGLRenderTarget;

  declare material: RenderBufferMaterial;

	constructor(samples: number) {
    const target = new WebGLRenderTarget(
      1,
      1,
      {
        samples,
        count: 2,
        depthTexture: new DepthTexture(1, 1),
        minFilter: NearestFilter,
        magFilter: NearestFilter,
      }
    );
    const color = new Color(0, 0.529, 0.808);
    const background = new Background(color);
		super(
      RenderBuffer.geometry,
      new RenderBufferMaterial(background.getTexture(), target.textures[0], target.depthTexture!, target.textures[1])
    );
    this.frustumCulled = false;
    this.background = background;
    this.fog = new FogExp2(color, 0.001);
    this.target = target;
	}

  bind(renderer: WebGLRenderer) {
		renderer.setRenderTarget(this.target);
	}

  getFog() {
    return this.fog;
  }

	render(renderer: WebGLRenderer, camera: Camera) {
    this.background.render(renderer, camera);
    renderer.render(this, RenderBuffer.camera);
	}

  resize(width: number, height: number) {
    const { background, material, target } = this;
    material.uniforms.resolution.value.set(width, height);
    background.setSize(width, height);
    target.setSize(width, height);
  }
}

export const Postprocessing = () => {
  const gl = useThree(({ gl }) => gl);
  const renderbuffer = useRef<RenderBuffer>(null!);
  if (!renderbuffer.current) {
    renderbuffer.current = new RenderBuffer(gl.capabilities.maxSamples);
  }
  useFrame(({ gl, scene, camera, size }) => {
    const { current: buffer } = renderbuffer;
    camera.layers.set(0);
    buffer.resize(size.width, size.height);
    buffer.bind(gl);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    buffer.render(gl, camera);

    camera.layers.set(1);
    gl.autoClear = false;
    scene.fog = buffer.getFog();
    gl.render(scene, camera);
    gl.autoClear = true;
    scene.fog = null;
  }, 1);
  return null;
};
