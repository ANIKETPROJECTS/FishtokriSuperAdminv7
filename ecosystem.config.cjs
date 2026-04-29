module.exports = {
  apps: [
    {
      name: "fishtokri-api",
      script: "./artifacts/api-server/dist/index.mjs",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 8080,
        MONGODB_URI: process.env.MONGODB_URI,
        SESSION_SECRET: process.env.SESSION_SECRET,
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
      },
    },
  ],
};
