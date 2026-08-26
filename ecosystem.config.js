module.exports = {
  apps: [
    {
      name: "nova-call-crm",
      script: "npm",
      args: "start",
      cwd: "./server",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      }
    }
  ]
};
