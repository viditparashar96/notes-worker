const dotenv = require("dotenv");
dotenv.config();

module.exports.env_config = {
  azure_endpoint: process.env.OPENAI_AZURE_ENDPOINT || "",
  openai_key: process.env.OPENAI_KEY || "",
  azure_region: process.env.AZURE_REGION || "",
  azure_deployment_name: process.env.OPENAI_MODEL_DEPLOYMENT_NAME || "",
  openai_model_name: process.env.OPENAI_MODEL_NAME || "",
  openai_chat_model_name: process.env.OPENAI_CHAT_MODEL_NAME || "",
  azureBlobConnectionString: process.env.AZURE_BLOB_CONNECTION_STRING || "",
};
