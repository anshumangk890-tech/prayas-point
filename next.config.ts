import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ["firebase-admin", "jose"],
}
export default nextConfig