/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/control",
        destination: "/tasks?view=commands",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
