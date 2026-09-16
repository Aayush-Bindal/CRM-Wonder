import type {NextConfig} from 'next';

// The Supabase origin is needed by connect-src (PostgREST + GoTrue + Realtime).
// NEXT_PUBLIC_* values are inlined at build time, so this is present wherever
// the app is built with its environment configured.
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const {origin} = new URL(url);
    return origin;
  } catch {
    return null;
  }
})();

const isDev = process.env.NODE_ENV !== 'production';
const supabaseSources = supabaseOrigin
  ? `${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, 'wss:')}`
  : '';

// Next injects its bootstrap and hydration payloads as inline scripts and the
// UI uses inline style attributes (e.g. the conic-gradient donut), so
// 'unsafe-inline' cannot be dropped without a nonce pipeline. Everything else
// is locked to the same origin: no object/embed, no framing, no off-origin
// script or style, and network access only to this origin and Supabase.
const contentSecurityPolicy = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseSources ? ` ${supabaseSources}` : ''}${isDev ? ' ws: wss:' : ''}`,
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lint errors must fail the build: the repo already lints clean.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Do not advertise the framework version.
  poweredByHeader: false,
  output: 'standalone',
  transpilePackages: ['motion'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {key: 'Content-Security-Policy', value: contentSecurityPolicy},
          // Belt and braces for browsers that predate frame-ancestors.
          {key: 'X-Frame-Options', value: 'DENY'},
          {key: 'X-Content-Type-Options', value: 'nosniff'},
          {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
          {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()'},
          // Sessions live in localStorage and drive a privileged admin console;
          // an accidental plain-HTTP load must not be able to strip the app.
          {key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains'},
        ],
      },
    ];
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify - file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
