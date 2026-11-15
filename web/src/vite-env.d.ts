/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// three.js ships without bundled types; these two imports are only used for the globe's bloom glow.
declare module "three";
declare module "three/examples/jsm/postprocessing/UnrealBloomPass.js";
