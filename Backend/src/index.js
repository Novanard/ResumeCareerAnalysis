require("dotenv").config();

const { createApp } = require("./app");

const app = createApp();
const port = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
