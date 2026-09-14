import type { MediaAsset } from "./projection-types";
import { SHADER_PRESETS } from "./shader-source";

/** Built-in assets used to exercise every in-app media source without uploads. */
export function getBuiltinTestAssets(): Array<Omit<MediaAsset, "id">> {
  const plasma = SHADER_PRESETS.find((p) => p.id === "plasma")!;
  const tunnel = SHADER_PRESETS.find((p) => p.id === "tunnel")!;
  const spectrum = SHADER_PRESETS.find((p) => p.id === "spectrum")!;
  const ripple = SHADER_PRESETS.find((p) => p.id === "ripple")!;

  const shaders: Array<Omit<MediaAsset, "id">> = [
    { name: "Butterchurn • Neon Plasma", kind: "shader", url: "builtin://butterchurn-neon", source: "butterchurn compatibility preset", code: plasma.code },
    { name: "Butterchurn • Warp Tunnel", kind: "shader", url: "builtin://butterchurn-tunnel", source: "butterchurn compatibility preset", code: tunnel.code },
    { name: "Butterchurn • Audio Ripple", kind: "shader", url: "builtin://butterchurn-ripple", source: "butterchurn compatibility preset", code: ripple.code },
    { name: "MilkDrop • Spectrum", kind: "shader", url: "builtin://milkdrop-spectrum", source: "milkdrop compatibility preset", code: spectrum.code },
    { name: "MilkDrop • Plasma", kind: "shader", url: "builtin://milkdrop-plasma", source: "milkdrop compatibility preset", code: plasma.code },
    { name: "MilkDrop • Vortex", kind: "shader", url: "builtin://milkdrop-vortex", source: "milkdrop compatibility preset", code: ripple.code },
  ];

  // 96x96 transparent animated GIF. Three named copies deliberately exercise
  // independent image asset instances and GIF decoding in the media cache.
  const gif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  // Tiny 0.75s VP9 WebM generated for the app's local test pack.
  const webm = "data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAANWEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEnTbuMU6uEHFO7a1OsggNA7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAh3AAAAAAABZUrmvMrgEAAAAAAABD14EBc8WItnQGM6RMihecgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QHc1lA4JSwgSC6gSCagQJTwIEBVbCEVbmBARJUw2dAf3Nzn2PAgGfImUWjh0VOQ09ERVJEh4xMYXZmNjEuNy4xMDNzc9pjwItjxYj0nQGM6RMiheXIpUWjh0VOQ09ERVJEh5hMYXZjNjEuMTkuMTAxIGxpYnZweC12cDlnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAwLjc1MDAwMDAwMAAfQ7Z1QY7ngQCgQImh4IEAAACCSYNCAAHwAfYIOCQcGEoAAHB8sWzwAAAAeE////ka8vnIonilZMoJWnOBUyvqWc4JQEgR9rsShxfCAW9HVB7y/a+I2XvUiB68wno+s/bkSPFW7i2pNqjP9qxzAHWhpKai7oEBpZ2CSYNCAAHwAfYAOCQcGEoAADBgAAAQ3//9cEsAAKCxoZOBAH0AhgBAkpwQUAAAAyAAAENAdaGWppTugQGlj4YAQJKcAFAAAAMgAABDQPuBg6CxoZOBAPoAhgBAkpwQTuAAAyAAAENAdaGWppTugQGlj4YAQJKcAE7gAAMgAABDQPuBg6CxoZOBAXcAhgBAkpwQUAAAAyAAAENAdaGWppTugQGlj4YAQJKcAFAAAAMgAABDQPuBg6CxoZOBAfQAhgBAkpwQTUAAAyAAAENAdaGWppTugQGlj4YAQJKcAE1AAAMgAABDQPuBg6CxoZOBAnEAhgBAkpwQUAAAAyAAAENAdaGWppTugQGlj4YAQJKcAFAAAAMgAABDQPuBgxxTu2uRu4+zgQC3iveBAfGCAazwgQM=";

  return [
    ...shaders,
    { name: "Transparent GIF • 1", kind: "image", url: gif, source: "local built-in GIF test" },
    { name: "Transparent GIF • 2", kind: "image", url: gif, source: "local built-in GIF test" },
    { name: "Transparent GIF • 3", kind: "image", url: gif, source: "local built-in GIF test" },
    { name: "Short transparent WebM • 1", kind: "video", url: webm, source: "local built-in video test" },
    { name: "Short transparent WebM • 2", kind: "video", url: webm, source: "local built-in video test" },
    { name: "Short transparent WebM • 3", kind: "video", url: webm, source: "local built-in video test" },
  ];
}
