module.exports = {
  "apps": [
    {
      "name": "3hour-cache-refresh",
      "script": "./scripts/3hour-scheduler.js",
      "cwd": "/Users/macbook/piotr",
      "instances": 1,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "200M",
      "env": {
        "NODE_ENV": "production"
      },
      "log_file": "./logs/3hour-refresh.log",
      "out_file": "./logs/3hour-refresh-out.log",
      "error_file": "./logs/3hour-refresh-error.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};