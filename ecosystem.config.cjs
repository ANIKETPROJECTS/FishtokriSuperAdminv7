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
        PORT: 3015,
        MONGODB_URI: "mongodb+srv://raneaniket23_db_user:0lEZL6KqIATNmZsj@fishtokricluster.vhw7jp9.mongodb.net/?appName=Fishtokricluster",
        SESSION_SECRET: "N+sLoTPRIVALoyG9KZg8BEhKC9NNxOSlqfNCDEyxEMIej55cNCHOE1bjIaGh+VFlDXgg9Oh8Wbtgr73PTjkfDQ==",
        CLOUDINARY_CLOUD_NAME: "dbkmmxnzd",
        CLOUDINARY_API_KEY: "935594792745712",
        CLOUDINARY_API_SECRET: "ouFPGE7SlNoQAG_OR7IT5sdFiiU",
        QZ_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgdh+9y6DjN6nURLYc
h3r49tnn7Us2Wz26TcEtUZl7psahRANCAAQD6c7IMRGw8JI5vtF09N1yqUTRJXe8
1RpDsjOLjK0Q9aL1KxOiPph7fRAi3k6pGl4f82JJkNsRVudKNFLySf2P
-----END PRIVATE KEY-----`,
        QZ_CERTIFICATE: `-----BEGIN CERTIFICATE-----
          MIIDkTCCAxegAwIBAgISBoU7FZebsSvxR4Ouc05wqp42MAoGCCqGSM49BAMDMDMx
          CzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQDEwNZ
          RTIwHhcNMjYwNTI5MDkwNTU4WhcNMjYwODI3MDkwNTU3WjAdMRswGQYDVQQDExJh
          ZG1pbi5maXNodG9rcmkuaW4wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQD6c7I
          MRGw8JI5vtF09N1yqUTRJXe81RpDsjOLjK0Q9aL1KxOiPph7fRAi3k6pGl4f82JJ
          kNsRVudKNFLySf2Po4ICHzCCAhswDgYDVR0PAQH/BAQDAgeAMBMGA1UdJQQMMAoG
          CCsGAQUFBwMBMAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFPZ/jyh9fWJ+mZjytLE1
          7EoQ2zkHMB8GA1UdIwQYMBaAFLlZ8o7PIvCG0zdI/3YUGLqC2FWHMDMGCCsGAQUF
          BwEBBCcwJTAjBggrBgEFBQcwAoYXaHR0cDovL3llMi5pLmxlbmNyLm9yZy8wHQYD
          VR0RBBYwFIISYWRtaW4uZmlzaHRva3JpLmluMBMGA1UdIAQMMAowCAYGZ4EMAQIB
          MC4GA1UdHwQnMCUwI6AhoB+GHWh0dHA6Ly95ZTIuYy5sZW5jci5vcmcvNTUuY3Js
          MIIBCwYKKwYBBAHWeQIEAgSB/ASB+QD3AHUAr2eIO1ewTt2Pptl+9i6o64EKx3Fg
          8CReVdYML+eFhzoAAAGeczFFcQAABAMARjBEAiAWixHU/1iOk7RjhKuDGaiz/0Pp
          eB25QVM8AxK4o7U0nQIgT8tdSNgF3CshAHS+eOD2Ixe3yrLxAUAFU00rdiYXYLUA
          fgAai51rD/6/gbR5OcbSMQqG1tEC1PBG4hgsneNfXiYl7wAAAZ5zMUaEAAgAAAUA
          GC0tSgQDAEcwRQIhAKzILmue7m5mWsOqSWEORJgl6nDRw3ETZnAqhYFu/1WCAiAi
          RzDCCc0deoAIBid1jp8FojnFR7Xa9yksi/3mLl9vVzAKBggqhkjOPQQDAwNoADBl
          AjAyMUgGKt6Z40TK1+Mq1wAirpHKslOa7oiNKSCJX6yPgW7l1reMWWGXKEE50FDC
          wMcCMQCgFaIIU+YzuuAMUnyFmtN9F0aJoc2O/C21Yq2koiive+pLAXVcKKGSS0UK
          PZNp6p0=
          -----END CERTIFICATE-----`,
      },
    },
  ],
};
