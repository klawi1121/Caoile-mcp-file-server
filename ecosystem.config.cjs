module.exports = {
  apps: [
    {
      name: "caoile-server",
      script: "dist/index.js",
      cwd: "C:\\Users\\Quennie\\Documents\\3rd year\\CSE2\\MCP\\Caoile-mcp-file-server"
    },
    {
      name: "caoile-tunnel",
      script: "C:\\Users\\Quennie\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\\ngrok.exe",
      args: "http --url=retiree-buzz-duckbill.ngrok-free.dev 3000",
      interpreter: "none"
    }
  ]
};