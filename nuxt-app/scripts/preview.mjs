// Preview serves the same unauthenticated API as the standalone launcher.
process.env.NITRO_HOST = "127.0.0.1";
process.env.HOST = "127.0.0.1";
process.argv.splice(2, 0, "preview");
await import("@nuxt/cli/cli");
