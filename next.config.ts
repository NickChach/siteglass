import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	headers() {
		return [{
			source: "/",
			headers: [{
				key: "Permissions-Policy",
				value: "local-network=(), loopback-network=(), local-network-access=()",
			}],
		}];
	},
};

export default nextConfig;
