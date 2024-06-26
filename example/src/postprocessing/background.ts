import {
  BackSide,
  Camera,
  Color,
  ColorRepresentation,
  DataTexture,
  FloatType,
  GLSL3,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  NearestFilter,
  RawShaderMaterial,
  RedFormat,
  RepeatWrapping,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

const Noise = (size = 256) => {
  const data = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    data[i] = Math.random();
  }
  const texture = new DataTexture(data, size, size, RedFormat, FloatType);
  texture.needsUpdate = true;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
};

class BackgroundMaterial extends RawShaderMaterial {
  private static readonly vertexShader = /* glsl */`
    precision mediump float;

    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;

    in vec3 position;
    in vec2 uv;

    out float vAltitude;
    out vec2 vNoiseUV;

    void main()	{
      vAltitude = (normalize(position).y + 1.0) * 0.5;
      vNoiseUV = uv * 8.0;
      gl_Position = (projectionMatrix * modelViewMatrix * vec4(position, 1.0)).xyww;
    }
  `;

  private static readonly fragmentShader = /* glsl */`
    precision mediump float;
  
    uniform vec3 color;
    uniform sampler2D noise;

    in float vAltitude;
    in vec2 vNoiseUV;
    out vec4 outputColor;

    void main()	{
      vec3 granularity = color * 0.02;
      outputColor = vec4(mix(color * 0.2, color * 2.0, vAltitude), 1.0);
      outputColor.rgb += mix(-granularity, granularity, texture(noise, vNoiseUV).r);
    }
  `;

  constructor() {
		super({
      glslVersion: GLSL3,
      side: BackSide,
      uniforms: {
        color: { value: new Color() },
        noise: { value: Noise() },
      },
      vertexShader: BackgroundMaterial.vertexShader,
      fragmentShader: BackgroundMaterial.fragmentShader,
    });
	}
}

class Background extends Mesh {
  private static readonly geometry = new IcosahedronGeometry(512, 3);
  private readonly target: WebGLRenderTarget;

  declare material: BackgroundMaterial;

	constructor(color: ColorRepresentation) {
    const target = new WebGLRenderTarget(
      1,
      1,
      {
        depthBuffer: false,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
      }
    );
		super(
      Background.geometry,
      new BackgroundMaterial()
    );
    this.frustumCulled = false;
    this.target = target;
    this.setColor(color);
	}

  getTexture() {
    return this.target.texture;
  }

	render(renderer: WebGLRenderer, camera: Camera) {
    camera.getWorldPosition(this.position);
    const currentRenderTarget = renderer.getRenderTarget();
		renderer.setRenderTarget(this.target);
    renderer.render(this, camera);
		renderer.setRenderTarget(currentRenderTarget);
	}

  setColor(color: ColorRepresentation) {
    const { material } = this;
    material.uniforms.color.value.set(color);
  }

  setSize(width: number, height: number) {
    const { target } = this;
    target.setSize(width, height);
  }
}

export default Background;
