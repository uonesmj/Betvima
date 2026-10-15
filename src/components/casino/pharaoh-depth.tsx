'use client';
import { useEffect, useRef } from 'react';

/**
 * Tiny dependency-free WebGL depth layer. Each golden particle has a 3D
 * position and is projected through perspective in the fragment shader.
 * Rendering is optional: the original SVG environment always remains visible.
 */
export function PharaohDepth({ disabled }: { disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (disabled || !canvasRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;
    const vertex = [
      'attribute vec2 position;',
      'varying vec2 uv;',
      'void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}',
    ].join('\n');
    const fragment = [
      'precision mediump float;',
      'varying vec2 uv;',
      'uniform float time;',
      'uniform vec2 resolution;',
      'float rand(float n){return fract(sin(n*127.1+43.3)*43758.5453);}',
      'void main(){',
      ' vec2 p=uv; p.x*=resolution.x/max(1.0,resolution.y);',
      ' vec3 light=vec3(0.0);',
      ' for(int i=0;i<42;i++){',
      '  float n=float(i);',
      '  float z=fract(rand(n+31.0)+time*(0.012+rand(n+12.0)*0.021));',
      '  float depth=0.22+z*1.8;',
      '  vec2 source=vec2(rand(n+1.0)*2.1-0.95,rand(n+8.0)*1.65-0.45);',
      '  vec2 projected=(source-vec2(0.55,0.45))/depth+vec2(0.55,0.45);',
      '  projected.x*=resolution.x/max(1.0,resolution.y);',
      '  float radius=mix(0.015,0.002,z);',
      '  float d=length(p-projected);',
      '  float glow=0.004/(1.0+15000.0*d*d);',
      '  float center=1.0-smoothstep(radius*0.25,radius,d);',
      '  float twinkle=0.7+0.3*sin(time*2.0+n);',
      '  light+=vec3(1.0,0.73,0.32)*(glow+center*0.4)*twinkle;',
      ' }',
      ' float intensity=min(length(light),1.0);',
      ' gl_FragColor=vec4(light,min(0.6,intensity));',
      '}',
    ].join('\n');
    const shader = (type: number, source: string) => {
      const item = gl.createShader(type);
      if (!item) return null;
      gl.shaderSource(item, source); gl.compileShader(item);
      if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) { gl.deleteShader(item); return null; }
      return item;
    };
    const vs = shader(gl.VERTEX_SHADER, vertex);
    const fs = shader(gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return; }
    const program = gl.createProgram();
    if (!program) { gl.deleteShader(vs);gl.deleteShader(fs);return; }
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {
      gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return;
    }
    const buffer = gl.createBuffer();
    if (!buffer) {gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return;}
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    gl.useProgram(program);
    const attribute = gl.getAttribLocation(program,'position');
    const uniformTime = gl.getUniformLocation(program,'time');
    const uniformResolution = gl.getUniformLocation(program,'resolution');
    if(attribute >= 0){gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);}
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    let frame = 0;
    let lastFrame = 0;
    let isActive = true;
    const animate = (stamp: number) => {
      if (!isActive) return;
      frame = requestAnimationFrame(animate);
      if (document.hidden || stamp-lastFrame < 34) return;
      lastFrame = stamp;
      const ratio = Math.min(window.devicePixelRatio || 1,1.25);
      const width = Math.max(1,Math.round(canvas.clientWidth*ratio));
      const height = Math.max(1,Math.round(canvas.clientHeight*ratio));
      if (canvas.width !== width || canvas.height !== height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniformTime,stamp/1000);
      gl.uniform2f(uniformResolution,width,height);
      gl.drawArrays(gl.TRIANGLES,0,6);
    };
    frame=requestAnimationFrame(animate);
    return () => {
      isActive=false;cancelAnimationFrame(frame);
      if(attribute>=0)gl.disableVertexAttribArray(attribute);
      gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    };
  },[disabled]);
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-70" />;
}
