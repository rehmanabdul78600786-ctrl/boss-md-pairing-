{
  "version": 2,
  "builds": [
    {
      "src": "boss.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/public/(.*)",
      "dest": "/public/$1"
    },
    {
      "src": "/(.*)",
      "dest": "boss.js"
    }
  ],
  "outputDirectory": "public"
}
