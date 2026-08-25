module.exports = {
  apps: [
    {
      name: "nova-call-crm",
      script: "npm",
      args: "start",
      cwd: "./server",
      env_production: {
        NODE_ENV: "production",
        PORT: 3050, // O'zgartirishingiz mumkin, boshqa loyihalarga xalaqit bermaydi
      }
    }
  ]
};
