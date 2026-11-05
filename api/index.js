const { app, ready } = require("../backend/server");

module.exports = async (req, res) => {
  await ready;
  return app(req, res);
};
