module.exports = {
  apps: [
    {
      name: "fishtokri-api",
      script: "./artifacts/api-server/dist/index.mjs",
      cwd: "/var/www/fishtokri",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
        MONGODB_URI: "REPLACE_WITH_YOUR_MONGODB_URI",
        SESSION_SECRET: "REPLACE_WITH_YOUR_SESSION_SECRET",
        CLOUDINARY_CLOUD_NAME: "dbkmmxnzd",
        CLOUDINARY_API_KEY: "935594792745712",
        CLOUDINARY_API_SECRET: "REPLACE_WITH_YOUR_CLOUDINARY_API_SECRET",
      },
    },
  ],
};
